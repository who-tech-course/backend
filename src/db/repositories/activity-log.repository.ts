import type { PrismaClient } from '@prisma/client';

const RETENTION_DAYS = 7;

export function createActivityLogRepository(db: PrismaClient) {
  return {
    findMany: (workspaceId: number, limit = 200) =>
      db.activityLog.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, type: true, message: true, createdAt: true },
      }),

    create: async (data: { type: string; message: string; workspaceId: number }) => {
      const [log] = await db.$transaction([
        db.activityLog.create({ data }),
        db.activityLog.deleteMany({
          where: {
            workspaceId: data.workspaceId,
            createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);
      return log;
    },

    deleteAll: (workspaceId: number) => db.activityLog.deleteMany({ where: { workspaceId } }),
  };
}

export type ActivityLogRepository = ReturnType<typeof createActivityLogRepository>;
