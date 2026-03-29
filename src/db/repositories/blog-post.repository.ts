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
} satisfies Prisma.BlogPostInclude;

// 타입을 BlogPost(원본) 기준으로 설정해야 에러가 안 납니다.
export type BlogPostWithMember = Prisma.BlogPostGetPayload<{
  include: typeof blogPostWithMemberInclude;
}>;

export function createBlogPostRepository(db: PrismaClient) {
  return {
    // 1. 날아갔던 기본 메서드들 복구
    upsert: (args: Prisma.BlogPostUpsertArgs) => db.blogPost.upsert(args),
    deleteBefore: (date: Date) => db.blogPost.deleteMany({ where: { publishedAt: { lt: date } } }),

    // 2. 에러의 주범! findByMember 복구
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

    // 3. 우리가 수정한 findFeed (days 적용 버전)
    findFeed: (workspaceId: number, filters?: { cohort?: number; track?: string; days?: number }) => {
      const days = filters?.days ?? 7;
      const since = new Date();
      since.setDate(since.getDate() - days);

      return db.blogPost.findMany({
        where: {
          publishedAt: { gte: since },
          member: {
            workspaceId,
            ...(filters?.cohort ? { memberCohorts: { some: { cohort: { number: filters.cohort } } } } : {}),
            ...(filters?.track ? { submissions: { some: { missionRepo: { track: filters.track } } } } : {}),
          },
        },
        orderBy: { publishedAt: 'desc' },
        include: blogPostWithMemberInclude,
      });
    },

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
