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
    findWithFilters: (workspaceId: number, filters?: { q?: string; cohort?: number; hasBlog?: boolean }) =>
      db.member.findMany({
        where: {
          workspaceId,
          ...(filters?.cohort ? { cohort: filters.cohort } : {}),
          ...(filters?.hasBlog === true ? { blog: { not: null } } : {}),
          ...(filters?.hasBlog === false ? { blog: null } : {}),
          ...(filters?.q
            ? {
                OR: [
                  { githubId: { contains: filters.q } },
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
        select: { id: true, manualNickname: true, nicknameStats: true, blog: true },
      }),

    upsert: (args: Prisma.MemberUpsertArgs) => db.member.upsert(args),

    updateWithRelations: (id: number, data: { manualNickname?: string | null; blog?: string | null }) =>
      db.member.update({ where: { id }, data, include: memberWithRelationsInclude }),

    patch: (id: number, data: { blog?: string | null }) => db.member.update({ where: { id }, data }),

    count: () => db.member.count(),

    deleteWithRelations: (id: number) =>
      db.$transaction([
        db.blogPost.deleteMany({ where: { memberId: id } }),
        db.submission.deleteMany({ where: { memberId: id } }),
        db.member.delete({ where: { id } }),
      ]),
  };
}

export type MemberRepository = ReturnType<typeof createMemberRepository>;
