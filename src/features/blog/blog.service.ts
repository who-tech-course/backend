import Parser from 'rss-parser';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import { HttpError } from '../../shared/http.js';
import { normalizeBlogUrl } from '../../shared/blog.js';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

type BlogSyncFailure = {
  githubId: string;
  blog: string;
  rssUrl?: string;
  step: 'rss_fetch' | 'blog_post_upsert' | 'cleanup' | 'latest_refresh';
  error: string;
};

type RssCheckResult = {
  status: 'available' | 'unavailable' | 'error';
  rssUrl?: string;
  error?: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isFeedPath(pathname: string): boolean {
  return /\/(feed|rss|rss\.xml|feed\.xml|atom\.xml|index\.xml)$/i.test(pathname);
}

function sanitizeXml(xml: string): string {
  return xml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;');
}

async function resolveBlogUrl(blogUrl: string): Promise<string | null> {
  const normalized = normalizeBlogUrl(blogUrl);
  if (!normalized) {
    return null;
  }

  const url = new URL(normalized);
  if (!['bit.ly', 't.co', 'tinyurl.com'].includes(url.hostname)) {
    return normalized;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(normalized, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    return normalizeBlogUrl(response.url) ?? normalized;
  } catch {
    return normalized;
  } finally {
    clearTimeout(timeout);
  }
}

export function resolveRSSUrlsForBlog(blogUrl: string): string[] {
  const normalizedBlogUrl = normalizeBlogUrl(blogUrl);
  if (!normalizedBlogUrl) return [];

  const url = new URL(normalizedBlogUrl);
  if (isFeedPath(url.pathname)) {
    return [normalizedBlogUrl];
  }

  if (url.hostname === 'velog.io') {
    const match = url.pathname.match(/^\/@[^/]+/);
    if (match) {
      return [`https://v2.velog.io/rss${match[0]}`];
    }
  }

  if (url.hostname.endsWith('.tistory.com')) {
    return [`${normalizedBlogUrl}/rss`];
  }

  if (url.hostname === 'medium.com' || url.hostname.endsWith('.medium.com')) {
    return [`https://medium.com/feed${url.pathname}`];
  }

  const base = normalizedBlogUrl;
  return [
    ...new Set([
      `${base}/feed.xml`,
      `${base}/rss.xml`,
      `${base}/atom.xml`,
      `${base}/feed`,
      `${base}/rss`,
      `${base}/index.xml`,
    ]),
  ];
}

async function fetchFeedText(rssUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(rssUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      throw new Error('404');
    }

    if (!response.ok) {
      throw new Error(`Status code ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRSSItems(blogUrl: string): Promise<{
  items: { title?: string; link?: string; pubDate?: string }[];
  failure?: Pick<BlogSyncFailure, 'blog' | 'rssUrl' | 'step' | 'error'>;
  rssCheck: RssCheckResult;
}> {
  const resolvedBlogUrl = await resolveBlogUrl(blogUrl);
  const candidates = resolvedBlogUrl ? resolveRSSUrlsForBlog(resolvedBlogUrl) : [];
  let lastError: { rssUrl?: string; error: string } | null = null;

  for (const rssUrl of candidates) {
    try {
      const xml = await fetchFeedText(rssUrl);
      const feed = await parser.parseString(sanitizeXml(xml));
      return { items: feed.items, rssCheck: { status: 'available', rssUrl } };
    } catch (error) {
      const message = errorMessage(error);
      if (message.includes('404')) {
        continue;
      }

      if (
        message.includes('Feed not recognized') ||
        message.includes('Invalid character in entity name') ||
        message.includes('Non-whitespace before first tag')
      ) {
        lastError = { rssUrl, error: message };
        continue;
      }

      return {
        items: [],
        failure: {
          blog: blogUrl,
          step: 'rss_fetch',
          error: message,
          ...(rssUrl ? { rssUrl } : {}),
        },
        rssCheck: {
          status: 'error',
          ...(rssUrl ? { rssUrl } : {}),
          error: message,
        },
      };
    }
  }

  if (candidates.length > 0) {
    return {
      items: [],
      rssCheck: {
        status: lastError ? 'error' : 'unavailable',
        ...(lastError?.rssUrl ? { rssUrl: lastError.rssUrl } : {}),
        ...(lastError?.error ? { error: lastError.error } : {}),
      },
      ...(lastError
        ? {
            failure: {
              blog: blogUrl,
              step: 'rss_fetch',
              error: lastError.error,
              ...(lastError.rssUrl ? { rssUrl: lastError.rssUrl } : {}),
            },
          }
        : {}),
    };
  }

  return {
    items: [],
    rssCheck: { status: 'error', error: 'invalid blog url' },
  };
}

// 단일 URL에 RSS가 있는지 확인 (backfill 시 후보 검사용)
export async function probeRss(blogUrl: string): Promise<RssCheckResult> {
  const { rssCheck } = await fetchRSSItems(blogUrl);
  return rssCheck;
}

export function createBlogService(deps: { memberRepo: MemberRepository; blogPostRepo: BlogPostRepository }) {
  const { memberRepo, blogPostRepo } = deps;

  return {
    syncBlogs: async (
      workspaceId: number,
    ): Promise<{ synced: number; deleted: number; failures: BlogSyncFailure[] }> => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const members = await memberRepo.findMany({
        where: { workspaceId, blog: { not: null } },
        select: { id: true, githubId: true, blog: true },
      });

      let synced = 0;
      const failures: BlogSyncFailure[] = [];

      for (const member of members) {
        const result = await fetchRSSItems(member.blog!);
        const latestDate = result.items
          .map((item) => (item.pubDate ? new Date(item.pubDate) : null))
          .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
          .sort((a, b) => b.getTime() - a.getTime())[0];

        await memberRepo.patch(member.id, {
          rssStatus: result.rssCheck.status,
          rssUrl: result.rssCheck.rssUrl ?? null,
          rssCheckedAt: new Date(),
          rssError: result.rssCheck.error ?? null,
          ...(latestDate ? { lastPostedAt: latestDate } : {}),
        });
        if (result.failure) {
          failures.push({ githubId: member.githubId, ...result.failure });
          continue;
        }

        for (const item of result.items) {
          if (!item.link || !item.title || !item.pubDate) continue;
          const publishedAt = new Date(item.pubDate);
          if (isNaN(publishedAt.getTime()) || publishedAt < thirtyDaysAgo) continue;

          try {
            await blogPostRepo.upsert({
              where: { url: item.link },
              create: { url: item.link, title: item.title, publishedAt, memberId: member.id },
              update: {},
            });
            synced++;
          } catch (error) {
            failures.push({
              githubId: member.githubId,
              blog: member.blog!,
              rssUrl: item.link,
              step: 'blog_post_upsert',
              error: errorMessage(error),
            });
          }
        }
      }

      let deleted = 0;

      try {
        ({ count: deleted } = await blogPostRepo.deleteBefore(thirtyDaysAgo));
      } catch (error) {
        throw new HttpError(500, `blog sync cleanup failed: ${errorMessage(error)}`);
      }

      try {
        await blogPostRepo.refreshLatest(sevenDaysAgo);
      } catch (error) {
        throw new HttpError(500, `blog latest refresh failed: ${errorMessage(error)}`);
      }

      return { synced, deleted, failures };
    },
  };
}

export type BlogService = ReturnType<typeof createBlogService>;
