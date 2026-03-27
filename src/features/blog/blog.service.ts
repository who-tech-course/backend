import Parser from 'rss-parser';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import { normalizeBlogUrl } from '../../shared/blog.js';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

function resolveRSSUrl(blogUrl: string): string[] {
  const normalizedBlogUrl = normalizeBlogUrl(blogUrl);
  if (!normalizedBlogUrl) return [];

  const url = new URL(normalizedBlogUrl);

  if (url.hostname === 'velog.io') return [`https://v2.velog.io/rss${url.pathname}`];
  if (url.hostname.endsWith('.tistory.com')) return [`${normalizedBlogUrl}/rss`];

  const base = normalizedBlogUrl;
  return [`${base}/feed.xml`, `${base}/rss.xml`, `${base}/feed`, `${base}/rss`];
}

async function fetchRSSItems(blogUrl: string): Promise<{ title?: string; link?: string; pubDate?: string }[]> {
  for (const rssUrl of resolveRSSUrl(blogUrl)) {
    try {
      return (await parser.parseURL(rssUrl)).items;
    } catch {
      continue;
    }
  }
  return [];
}

export function createBlogService(deps: { memberRepo: MemberRepository; blogPostRepo: BlogPostRepository }) {
  const { memberRepo, blogPostRepo } = deps;

  return {
    syncBlogs: async (workspaceId: number): Promise<{ synced: number; deleted: number }> => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const members = await memberRepo.findMany({
        where: { workspaceId, blog: { not: null } },
        select: { id: true, blog: true },
      });

      let synced = 0;
      for (const member of members) {
        for (const item of await fetchRSSItems(member.blog!)) {
          if (!item.link || !item.title || !item.pubDate) continue;
          const publishedAt = new Date(item.pubDate);
          if (isNaN(publishedAt.getTime()) || publishedAt < thirtyDaysAgo) continue;
          await blogPostRepo.upsert({
            where: { url: item.link },
            create: { url: item.link, title: item.title, publishedAt, memberId: member.id },
            update: {},
          });
          synced++;
        }
      }

      const { count: deleted } = await blogPostRepo.deleteBefore(thirtyDaysAgo);
      await blogPostRepo.refreshLatest(sevenDaysAgo);
      return { synced, deleted };
    },
  };
}

export type BlogService = ReturnType<typeof createBlogService>;
