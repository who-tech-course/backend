import type { PrismaClient, Prisma } from '@prisma/client';

export function createBlogPostRepository(db: PrismaClient) {
  return {
    upsert: (args: Prisma.BlogPostUpsertArgs) => db.blogPost.upsert(args),
    deleteBefore: (date: Date) => db.blogPost.deleteMany({ where: { publishedAt: { lt: date } } }),

    refreshLatest: async (since: Date) => {
      const recent = await db.blogPost.findMany({ where: { publishedAt: { gte: since } } });
      await db.blogPostLatest.deleteMany({});
      if (recent.length === 0) return;
      await db.blogPostLatest.createMany({
        data: recent.map(({ url, title, publishedAt, memberId }) => ({ url, title, publishedAt, memberId })),
      });
    },
  };
}

export type BlogPostRepository = ReturnType<typeof createBlogPostRepository>;
