import type { PrismaClient, Prisma } from '@prisma/client';

export function createMissionRepoRepository(db: PrismaClient) {
  return {
    findMany: (where: Prisma.MissionRepoWhereInput, orderBy?: Prisma.MissionRepoOrderByWithRelationInput[]) =>
      db.missionRepo.findMany({ where, ...(orderBy !== undefined ? { orderBy } : {}) }),

    findByIdOrThrow: (id: number) => db.missionRepo.findUniqueOrThrow({ where: { id } }),

    findFirst: (where: Prisma.MissionRepoWhereInput) => db.missionRepo.findFirst({ where }),

    create: (data: Prisma.MissionRepoUncheckedCreateInput) => db.missionRepo.create({ data }),

    update: (id: number, data: Prisma.MissionRepoUpdateInput) => db.missionRepo.update({ where: { id }, data }),

    touch: (id: number) => db.missionRepo.update({ where: { id }, data: { lastSyncAt: new Date() } }),

    count: () => db.missionRepo.count(),

    deleteWithSubmissions: (id: number) =>
      db.$transaction([
        db.submission.deleteMany({ where: { missionRepoId: id } }),
        db.missionRepo.delete({ where: { id } }),
      ]),

    deleteAllWithSubmissions: (workspaceId: number) =>
      db.$transaction([
        db.submission.deleteMany({ where: { missionRepo: { workspaceId } } }),
        db.missionRepo.deleteMany({ where: { workspaceId } }),
      ]),
  };
}

export type MissionRepoRepository = ReturnType<typeof createMissionRepoRepository>;
