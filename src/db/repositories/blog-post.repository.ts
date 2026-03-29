import type { PrismaClient, Prisma } from '@prisma/client';

const blogPostWithMemberInclude = {
  member: {
    include: {
      memberCohorts: {
        include: {
          cohort: true,
          role: true,
        },
      },
      submissions: {
        select: {
          missionRepo: {
            select: { track: true },
          },
        },
      },
    },
  },
};

export type BlogPostWithMember = Prisma.BlogPostLatestGetPayload<{
  include: typeof blogPostWithMemberInclude;
}>;

export function createBlogPostRepository(db: PrismaClient) {
  return {
    upsert: (args: Prisma.BlogPostUpsertArgs) => db.blogPost.upsert(args),
    deleteBefore: (date: Date) => db.blogPost.deleteMany({ where: { publishedAt: { lt: date } } }),

    findByMember: (memberId: number) =>
      Promise.all([
        db.blogPost.findMany({
          where: { memberId },
          orderBy: { publishedAt: 'desc' },
          select: { url: true, title: true, publishedAt: true },
        }),
        db.blogPostLatest.findMany({
          where: { memberId },
          orderBy: { publishedAt: 'desc' },
          select: { url: true, title: true, publishedAt: true },
        }),
      ]).then(([archive, latest]) => ({ archive, latest })),

    findFeed: (workspaceId: number, filters?: { cohort?: number; track?: string }) =>
      db.blogPostLatest.findMany({
        where: {
          member: {
            workspaceId,
            ...(filters?.cohort ? { memberCohorts: { some: { cohort: { number: filters.cohort } } } } : {}),
            ...(filters?.track ? { submissions: { some: { missionRepo: { track: filters.track } } } } : {}),
          },
        },
        orderBy: { publishedAt: 'desc' },
        include: blogPostWithMemberInclude,
      }),

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
