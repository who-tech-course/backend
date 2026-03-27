import type { PrismaClient } from '@prisma/client';

export function createCohortRepoRepository(db: PrismaClient) {
  return {
    findByCohort: (workspaceId: number, cohort: number) =>
      db.cohortRepo.findMany({
        where: { workspaceId, cohort },
        orderBy: { order: 'asc' },
        include: { missionRepo: { select: { id: true, name: true, repoUrl: true, track: true, level: true } } },
      }),

    findById: (id: number) => db.cohortRepo.findUnique({ where: { id } }),

    create: (data: { cohort: number; order: number; missionRepoId: number; workspaceId: number }) =>
      db.cohortRepo.create({
        data,
        include: { missionRepo: { select: { id: true, name: true, repoUrl: true, track: true, level: true } } },
      }),

    update: (id: number, data: { order?: number }) =>
      db.cohortRepo.update({
        where: { id },
        data,
        include: { missionRepo: { select: { id: true, name: true, repoUrl: true, track: true, level: true } } },
      }),

    delete: (id: number) => db.cohortRepo.delete({ where: { id } }),

    findExistingIds: (workspaceId: number, cohort: number) =>
      db.cohortRepo.findMany({ where: { workspaceId, cohort }, select: { missionRepoId: true } }),

    createMany: (rows: { cohort: number; order: number; missionRepoId: number; workspaceId: number }[]) =>
      db.$transaction(rows.map((data) => db.cohortRepo.create({ data }))),

    listCohorts: (workspaceId: number) =>
      db.cohortRepo.findMany({
        where: { workspaceId },
        select: { cohort: true },
        distinct: ['cohort'],
        orderBy: { cohort: 'desc' },
      }),
  };
}

export type CohortRepoRepository = ReturnType<typeof createCohortRepoRepository>;
