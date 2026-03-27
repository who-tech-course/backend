import type { PrismaClient, Prisma } from '@prisma/client';

export function createSubmissionRepository(db: PrismaClient) {
  return {
    upsert: (args: Prisma.SubmissionUpsertArgs) => db.submission.upsert(args),
  };
}

export type SubmissionRepository = ReturnType<typeof createSubmissionRepository>;
