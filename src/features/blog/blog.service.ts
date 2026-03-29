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

// 1. 타입 정의 수정 ('latest_refresh' 단계 제거)
type BlogSyncFailure = {
  githubId: string;
  blog: string;
  rssUrl?: string;
  step: 'rss_fetch' | 'blog_post_upsert' | 'cleanup';
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
  if (!normalized) return null;

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
  if (isFeedPath(url.pathname)) return [normalizedBlogUrl];

  if (url.hostname === 'velog.io') {
    const match = url.pathname.match(/^\/@[^/]+/);
    if (match) return [`https://v2.velog.io/rss${match[0]}`];
  }

  if (url.hostname.endsWith('.tistory.com')) return [`${normalizedBlogUrl}/rss`];

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
    if (response.status === 404) throw new Error('404');
    if (!response.ok) throw new Error(`Status code ${response.status}`);
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
      if (message.includes('404')) continue;

      if (
        message.includes('Feed not recognized') ||
        message.includes('Invalid character in entity name') ||
        message.includes('Non-whitespace before first tag')
      ) {
        lastError = { rssUrl, error: message };
        continue;
      }

      // 수정 포인트: 객체 전개 연산자(...)를 사용하여 rssUrl이 있을 때만 속성을 추가합니다.
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
          error: message,
          ...(rssUrl ? { rssUrl } : {}),
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
      // 수정 포인트: lastError가 있을 때만 failure 객체를 생성하고 내부 속성도 조건부로 넣습니다.
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

  return { items: [], rssCheck: { status: 'error', error: 'invalid blog url' } };
}

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
      // 기준 날짜를 상단으로 이동 (루프 내 참조 에러 방지)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const members = await memberRepo.findWithFilters(workspaceId, { hasBlog: true });

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

          // 30일보다 오래된 글 스킵
          if (isNaN(publishedAt.getTime()) || publishedAt < thirtyDaysAgo) continue;

          try {
            // 모든 글은 원본 BlogPost 테이블 하나에만 저장/업데이트
            await blogPostRepo.upsert({
              where: { url: item.link },
              create: { url: item.link, title: item.title, publishedAt, memberId: member.id },
              update: { title: item.title, publishedAt },
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

      // [통합 완료] refreshLatest는 더 이상 필요 없으므로 삭제했습니다.
      // 이제 데이터를 가져오는 API에서 직접 7일 필터를 걸어주면 됩니다.

      return { synced, deleted, failures };
    },
  };
}

export type BlogService = ReturnType<typeof createBlogService>;
