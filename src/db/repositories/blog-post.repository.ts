import type { PrismaClient, Prisma } from '@prisma/client';

export function createBlogPostRepository(db: PrismaClient) {
  return {
    upsert: (args: Prisma.BlogPostUpsertArgs) => db.blogPost.upsert(args),
    deleteBefore: (date: Date) => db.blogPost.deleteMany({ where: { publishedAt: { lt: date } } }),
  };
}

export type BlogPostRepository = ReturnType<typeof createBlogPostRepository>;
