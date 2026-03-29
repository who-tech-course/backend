import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

const memberWithRelationsInclude = Prisma.validator<Prisma.MemberInclude>()({
  _count: { select: { submissions: true } },
  blogPostsLatest: { orderBy: { publishedAt: 'desc' as const } },
  memberCohorts: {
    include: {
      cohort: true,
      role: true,
    },
  },
  submissions: {
    orderBy: { submittedAt: 'desc' as const },
    include: { missionRepo: { select: { id: true, name: true, track: true, level: true, tabCategory: true } } },
  },
});

export type MemberWithRelations = Prisma.MemberGetPayload<{
  include: typeof memberWithRelationsInclude;
}>;

export function createMemberRepository(db: PrismaClient) {
  return {
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

    findMany: <T extends Prisma.MemberFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.MemberFindManyArgs>) =>
      db.member.findMany<T>(args),

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

    create: (data: Prisma.MemberUncheckedCreateInput): Promise<MemberWithRelations> =>
      db.member.create({ data, include: memberWithRelationsInclude }),

    update: (id: number, data: Prisma.MemberUncheckedUpdateInput): Promise<MemberWithRelations> =>
      db.member.update({ where: { id }, data, include: memberWithRelationsInclude }),

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
        rssStatus?: string;
        rssUrl?: string | null;
        rssCheckedAt?: Date | null;
        rssError?: string | null;
        lastPostedAt?: Date | null;
      },
    ): Promise<MemberWithRelations> => db.member.update({ where: { id }, data, include: memberWithRelationsInclude }),

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

    findPublicDetail: (githubId: string, workspaceId: number): Promise<MemberWithRelations | null> =>
      db.member.findFirst({
        where: {
          workspaceId,
          OR: [{ githubId }, { previousGithubIds: { contains: `"${githubId}"` } }],
        },
        include: memberWithRelationsInclude,
      }),

    findByIdWithRelations: (id: number): Promise<MemberWithRelations | null> =>
      db.member.findUnique({ where: { id }, include: memberWithRelationsInclude }),

    listStaleProfiles: (
      workspaceId: number,
      options?: { limit?: number; cohort?: number; staleBefore?: Date },
    ): Promise<MemberWithRelations[]> =>
      db.member.findMany({
        where: {
          workspaceId,
          ...(options?.cohort != null ? { memberCohorts: { some: { cohort: { number: options.cohort } } } } : {}),
          OR: [
            { profileFetchedAt: null },
            ...(options?.staleBefore ? [{ profileFetchedAt: { lt: options.staleBefore } }] : []),
            { avatarUrl: null },
          ],
        },
        orderBy: [{ profileFetchedAt: 'asc' }, { id: 'asc' }],
        take: options?.limit ?? 30,
        include: memberWithRelationsInclude,
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
