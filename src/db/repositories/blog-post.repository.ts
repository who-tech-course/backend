import type { PrismaClient, Prisma } from '@prisma/client';

// 1. 공통 Include 설정 (멤버, 기수, 트랙 정보 포함)
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

// 타입 정의
export type BlogPostWithMember = Prisma.BlogPostGetPayload<{
  include: typeof blogPostWithMemberInclude;
}>;

export function createBlogPostRepository(db: PrismaClient) {
  return {
    // [기본] 저장 및 업데이트 (30일치 데이터 관리용)
    upsert: (args: Prisma.BlogPostUpsertArgs) => db.blogPost.upsert(args),

    // [기본] 오래된 데이터 삭제 (30일 기준 청소용)
    deleteBefore: (date: Date) => db.blogPost.deleteMany({ where: { publishedAt: { lt: date } } }),

    /**
     * [조회] 특정 멤버의 블로그 포스트 목록
     * 이제 별도 테이블이 없으므로, 7일 기준(Latest)과 전체(Archive)를
     * 원본 테이블에서 날짜 필터로 구분해서 가져옵니다.
     */
    findByMember: async (memberId: number) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // 전체 포스트 조회 (최신순)
      const allPosts = await db.blogPost.findMany({
        where: { memberId },
        orderBy: { publishedAt: 'desc' },
        select: { url: true, title: true, publishedAt: true },
      });

      // 자바스크립트 단에서 7일 기준 필터링 (DB 재조회보다 빠름)
      const latest = allPosts.filter((post) => post.publishedAt >= sevenDaysAgo);

      return { archive: allPosts, latest };
    },

    /**
     * [조회] 메인 피드 목록 (필터링 포함)
     * 이제 BlogPostLatest를 쓰지 않고 BlogPost 원본에서 직접 7일(또는 days)치를 가져옵니다.
     */
    findFeed: (workspaceId: number, filters?: { limit?: number; cohort?: number; track?: string; days?: number }) => {
      const days = filters?.days ?? 7;
      const since = new Date();
      since.setDate(since.getDate() - days);

      return db.blogPost.findMany({
        where: {
          publishedAt: { gte: since }, // 7일 필터링 핵심!
          member: {
            workspaceId,
            ...(filters?.cohort ? { memberCohorts: { some: { cohort: { number: filters.cohort } } } } : {}),
            ...(filters?.track ? { submissions: { some: { missionRepo: { track: filters.track } } } } : {}),
          },
        },
        take: filters?.limit ?? 30,
        orderBy: { publishedAt: 'desc' },
        include: blogPostWithMemberInclude,
      });
    },

    /**
     * [중요] refreshLatest는 이제 더 이상 필요하지 않습니다.
     * 스키마에서 BlogPostLatest 모델을 삭제할 것이기 때문입니다.
     * 하지만 다른 코드와의 호환성을 위해 빈 함수로 두거나, 점진적으로 제거하세요.
     */
    refreshLatest: async (_since: Date) => {
      // 이제 단일 테이블 구조이므로 복사 로직이 필요 없습니다.
      return Promise.resolve();
    },
  };
}

export type BlogPostRepository = ReturnType<typeof createBlogPostRepository>;
