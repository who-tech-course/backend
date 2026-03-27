import type { PrismaClient } from '@prisma/client';
import { WORKSPACE_NAME } from '../../shared/constants.js';

export function createWorkspaceRepository(db: PrismaClient) {
  return {
    findOrThrow: () => db.workspace.findFirstOrThrow({ where: { name: WORKSPACE_NAME } }),
    find: () => db.workspace.findFirst({ where: { name: WORKSPACE_NAME } }),
    findByIdOrThrow: (id: number) => db.workspace.findUniqueOrThrow({ where: { id } }),
    update: (id: number, data: { nicknameRegex?: string; cohortRules?: string }) =>
      db.workspace.update({ where: { id }, data }),
    touch: (id: number) => db.workspace.update({ where: { id }, data: {} }),
  };
}

export type WorkspaceRepository = ReturnType<typeof createWorkspaceRepository>;
