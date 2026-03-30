import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

// 1. 포함할 관계 정의 (타입 추론의 핵심)
const memberWithRelationsInclude = Prisma.validator<Prisma.MemberInclude>()({
  _count: { select: { submissions: true } },
  blogPosts: { orderBy: { publishedAt: 'desc' as const }, take: 10 },
  person: {
    include: {
      members: {
        select: { id: true, githubId: true, nickname: true, manualNickname: true, avatarUrl: true },
      },
    },
  },
  memberCohorts: {
    include: {
      cohort: true,
      role: true,
    },
  },
  submissions: {
    orderBy: { submittedAt: 'desc' as const },
    select: {
      id: true,
      prNumber: true,
      prUrl: true,
      title: true,
      status: true,
      submittedAt: true,
      memberId: true,
      missionRepoId: true,
      missionRepo: { select: { id: true, name: true, track: true, level: true, tabCategory: true } },
    },
  },
});

// 2. 외부에서 사용할 타입 정의
export type MemberWithRelations = Prisma.MemberGetPayload<{
  include: typeof memberWithRelationsInclude;
}>;

export function createMemberRepository(db: PrismaClient) {
  return {
    // 필터 기반 조회
    findWithFilters: (
      workspaceId: number,
      filters?: { q?: string; cohort?: number; hasBlog?: boolean; track?: string; role?: string },
    ): Promise<MemberWithRelations[]> =>
      db.member.findMany({
        where: {
          workspaceId,
          ...(filters?.cohort ? { memberCohorts: { some: { cohort: { number: filters.cohort } } } } : {}),
          ...(filters?.role ? { memberCohorts: { some: { role: { name: { contains: filters.role } } } } } : {}),
          ...(filters?.hasBlog === true ? { blog: { not: null } } : {}),
          ...(filters?.hasBlog === false ? { blog: null } : {}),
          ...(filters?.track ? { submissions: { some: { missionRepo: { track: filters.track } } } } : {}),
          ...(filters?.q
            ? {
                OR: [
                  { githubId: { contains: filters.q } },
                  { previousGithubIds: { contains: `"${filters.q}"` } },
                  { nickname: { contains: filters.q } },
                  { manualNickname: { contains: filters.q } },
                ] satisfies Prisma.MemberWhereInput[],
              }
            : {}),
        },
        orderBy: [{ nickname: 'asc' }],
        include: memberWithRelationsInclude,
      }),

    // 기본 조회 메서드들
    findByGithubId: (githubId: string, workspaceId: number): Promise<MemberWithRelations | null> =>
      db.member.findUnique({
        where: { githubId_workspaceId: { githubId, workspaceId } },
        include: memberWithRelationsInclude,
      }),

    findByGithubUserId: (githubUserId: number, workspaceId: number): Promise<MemberWithRelations | null> =>
      db.member.findUnique({
        where: { githubUserId_workspaceId: { githubUserId, workspaceId } },
        include: memberWithRelationsInclude,
      }),

    findByIdWithRelations: (id: number): Promise<MemberWithRelations | null> =>
      db.member.findUnique({ where: { id }, include: memberWithRelationsInclude }),

    // 생성 및 업데이트
    create: (data: Prisma.MemberUncheckedCreateInput): Promise<MemberWithRelations> =>
      db.member.create({ data, include: memberWithRelationsInclude }),

    update: (id: number, data: Prisma.MemberUncheckedUpdateInput): Promise<MemberWithRelations> =>
      db.member.update({ where: { id }, data, include: memberWithRelationsInclude }),

    // MemberRepository.ts 내부

    listStaleProfiles: (
      workspaceId: number,
      params: { staleBefore: Date; cohort?: number; limit: number }, // 👈 객체 타입으로 변경
    ): Promise<MemberWithRelations[]> =>
      db.member.findMany({
        where: {
          workspaceId,
          // 1. 특정 날짜(staleBefore) 이전에 업데이트된 사람만
          profileFetchedAt: { lt: params.staleBefore },
          // 2. 기수(cohort) 필터가 있다면 추가
          ...(params.cohort ? { memberCohorts: { some: { cohort: { number: params.cohort } } } } : {}),
        },
        orderBy: { profileFetchedAt: 'asc' },
        take: params.limit, // 👈 넘겨받은 limit 적용
        include: memberWithRelationsInclude,
      }),

    // 2. Public Service에서 에러 났던 상세 조회 (필요하다면 별칭으로 추가)
    findPublicDetail: (githubId: string, workspaceId: number): Promise<MemberWithRelations | null> =>
      db.member.findUnique({
        where: { githubId_workspaceId: { githubId, workspaceId } },
        include: memberWithRelationsInclude,
      }),

    // 3. 닉네임으로 찾기 (보통 다른 서비스에서 많이 씁니다)
    findByNickname: (nickname: string, workspaceId: number): Promise<MemberWithRelations | null> =>
      db.member.findFirst({
        where: {
          workspaceId,
          OR: [{ nickname }, { manualNickname: nickname }],
        },
        include: memberWithRelationsInclude,
      }),
    // ★ [핵심] Race Condition 방지를 위한 upsert 메서드
    // member.repository.ts

    upsert: async (
      workspaceId: number,
      githubUserId: number,
      data: Prisma.MemberUncheckedCreateInput,
    ): Promise<MemberWithRelations> => {
      // exactOptionalPropertyTypes 대응: undefined 필드를 명시적으로 처리
      const updateData: Prisma.MemberUncheckedUpdateInput = {
        githubId: data.githubId,
        previousGithubIds: data.previousGithubIds ?? null, // undefined 대신 null 처리
        nickname: data.nickname ?? null,
        avatarUrl: data.avatarUrl ?? null,
        nicknameStats: data.nicknameStats ?? null,
        profileFetchedAt: data.profileFetchedAt ?? null,
        profileRefreshError: data.profileRefreshError ?? null,
        blog: data.blog ?? null,
      };

      const result = await db.member.upsert({
        where: {
          githubUserId_workspaceId: { githubUserId, workspaceId },
        },
        update: updateData,
        create: {
          ...data,
          workspaceId,
        },
        include: memberWithRelationsInclude,
      });

      return result as unknown as MemberWithRelations;
    },

    // 기수 참여 정보 관리
    upsertParticipation: async (memberId: number, cohortNumber: number, roleName: string) => {
      const cohort = await db.cohort.upsert({
        where: { number: cohortNumber },
        create: { number: cohortNumber },
        update: {},
      });

      const role = await db.role.upsert({
        where: { name: roleName },
        create: { name: roleName },
        update: {},
      });

      return db.memberCohort.upsert({
        where: { memberId_cohortId_roleId: { memberId, cohortId: cohort.id, roleId: role.id } },
        create: { memberId, cohortId: cohort.id, roleId: role.id },
        update: {},
      });
    },

    // 삭제 로직 (트랜잭션으로 연관 데이터까지 깔끔하게)
    deleteWithRelations: (id: number) =>
      db.$transaction([
        db.blogPost.deleteMany({ where: { memberId: id } }),
        db.submission.deleteMany({ where: { memberId: id } }),
        db.member.delete({ where: { id } }),
      ]),

    deleteAllWithRelations: (workspaceId: number) =>
      db.$transaction([
        db.blogPost.deleteMany({ where: { member: { workspaceId } } }),
        db.submission.deleteMany({ where: { member: { workspaceId } } }),
        db.member.deleteMany({ where: { workspaceId } }),
      ]),

    // 기타 편의 메서드
    patch: (id: number, data: Partial<Prisma.MemberUpdateInput>) => db.member.update({ where: { id }, data }),

    count: () => db.member.count(),
  };
}

export type MemberRepository = ReturnType<typeof createMemberRepository>;
