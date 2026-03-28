import type { PrismaClient, Prisma } from '@prisma/client';

const memberWithRelationsInclude = {
  _count: { select: { submissions: true } },
  blogPostsLatest: { orderBy: { publishedAt: 'desc' as const } },
  submissions: {
    orderBy: { submittedAt: 'desc' as const },
    include: { missionRepo: { select: { name: true, track: true } } },
  },
} satisfies Prisma.MemberInclude;

export function createMemberRepository(db: PrismaClient) {
  return {
    findWithFilters: (
      workspaceId: number,
      filters?: { q?: string; cohort?: number; hasBlog?: boolean; track?: string; role?: string },
    ) =>
      db.member.findMany({
        where: {
          workspaceId,
          ...(filters?.cohort ? { cohort: filters.cohort } : {}),
          // roles is JSON array string — check if it contains the role value
          ...(filters?.role ? { roles: { contains: `"${filters.role}"` } } : {}),
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
        orderBy: [{ cohort: 'desc' }, { nickname: 'asc' }],
        include: memberWithRelationsInclude,
      }),

    findMany: <T extends Prisma.MemberFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.MemberFindManyArgs>) =>
      db.member.findMany<T>(args),

    findByGithubId: (githubId: string, workspaceId: number) =>
      db.member.findUnique({
        where: { githubId_workspaceId: { githubId, workspaceId } },
        select: {
          id: true,
          githubUserId: true,
          githubId: true,
          previousGithubIds: true,
          nickname: true,
          manualNickname: true,
          nicknameStats: true,
          avatarUrl: true,
          profileFetchedAt: true,
          profileRefreshError: true,
          blog: true,
          rssStatus: true,
          rssUrl: true,
          rssCheckedAt: true,
          rssError: true,
        },
      }),

    findByGithubUserId: (githubUserId: number, workspaceId: number) =>
      db.member.findUnique({
        where: { githubUserId_workspaceId: { githubUserId, workspaceId } },
        select: {
          id: true,
          githubUserId: true,
          githubId: true,
          previousGithubIds: true,
          nickname: true,
          manualNickname: true,
          nicknameStats: true,
          avatarUrl: true,
          profileFetchedAt: true,
          profileRefreshError: true,
          blog: true,
          rssStatus: true,
          rssUrl: true,
          rssCheckedAt: true,
          rssError: true,
        },
      }),

    create: (data: Prisma.MemberUncheckedCreateInput) =>
      db.member.create({ data, include: memberWithRelationsInclude }),

    update: (id: number, data: Prisma.MemberUncheckedUpdateInput) => db.member.update({ where: { id }, data }),

    updateWithRelations: (
      id: number,
      data: {
        manualNickname?: string | null;
        githubId?: string;
        githubUserId?: number | null;
        previousGithubIds?: string | null;
        avatarUrl?: string | null;
        profileFetchedAt?: Date | null;
        profileRefreshError?: string | null;
        blog?: string | null;
        roles?: string;
        rssStatus?: string;
        rssUrl?: string | null;
        rssCheckedAt?: Date | null;
        rssError?: string | null;
        lastPostedAt?: Date | null;
      },
    ) => db.member.update({ where: { id }, data, include: memberWithRelationsInclude }),

    patch: (
      id: number,
      data: {
        githubId?: string;
        githubUserId?: number | null;
        previousGithubIds?: string | null;
        blog?: string | null;
        avatarUrl?: string | null;
        profileFetchedAt?: Date | null;
        profileRefreshError?: string | null;
        rssStatus?: string;
        rssUrl?: string | null;
        rssCheckedAt?: Date | null;
        rssError?: string | null;
        lastPostedAt?: Date | null;
      },
    ) => db.member.update({ where: { id }, data }),

    findPublicDetail: (githubId: string, workspaceId: number) =>
      db.member.findFirst({
        where: { workspaceId, OR: [{ githubId }, { previousGithubIds: { contains: `"${githubId}"` } }] },
        include: {
          submissions: {
            include: {
              missionRepo: { select: { name: true, track: true, level: true, tabCategory: true } },
            },
            orderBy: { submittedAt: 'desc' },
          },
          blogPostsLatest: {
            orderBy: { publishedAt: 'desc' },
            take: 10,
          },
        },
      }),

    findByIdWithRelations: (id: number) => db.member.findUnique({ where: { id }, include: memberWithRelationsInclude }),

    listStaleProfiles: (workspaceId: number, options?: { limit?: number; cohort?: number; staleBefore?: Date }) =>
      db.member.findMany({
        where: {
          workspaceId,
          ...(options?.cohort != null ? { cohort: options.cohort } : {}),
          OR: [
            { profileFetchedAt: null },
            ...(options?.staleBefore ? [{ profileFetchedAt: { lt: options.staleBefore } }] : []),
            { avatarUrl: null },
          ],
        },
        orderBy: [{ profileFetchedAt: 'asc' }, { id: 'asc' }],
        take: options?.limit ?? 30,
        select: {
          id: true,
          githubId: true,
          githubUserId: true,
          previousGithubIds: true,
          avatarUrl: true,
          blog: true,
          profileFetchedAt: true,
        },
      }),

    count: () => db.member.count(),

    deleteWithRelations: (id: number) =>
      db.$transaction([
        db.blogPost.deleteMany({ where: { memberId: id } }),
        db.blogPostLatest.deleteMany({ where: { memberId: id } }),
        db.submission.deleteMany({ where: { memberId: id } }),
        db.member.delete({ where: { id } }),
      ]),

    deleteAllWithRelations: (workspaceId: number) =>
      db.$transaction([
        db.blogPost.deleteMany({ where: { member: { workspaceId } } }),
        db.blogPostLatest.deleteMany({ where: { member: { workspaceId } } }),
        db.submission.deleteMany({ where: { member: { workspaceId } } }),
        db.member.deleteMany({ where: { workspaceId } }),
      ]),
  };
}

export type MemberRepository = ReturnType<typeof createMemberRepository>;
