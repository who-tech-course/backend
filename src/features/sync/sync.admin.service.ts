import prisma from '../../db/prisma.js';
import { createOctokit } from './github.service.js';
import { syncWorkspace } from './sync.service.js';
import { getWorkspaceOrThrow } from '../workspace/workspace.service.js';

export async function getAdminStatus(): Promise<{
  memberCount: number;
  repoCount: number;
  lastSyncAt: Date | null;
}> {
  const workspace = await prisma.workspace.findFirst({ where: { name: 'woowacourse' } });
  const [memberCount, repoCount] = await Promise.all([prisma.member.count(), prisma.missionRepo.count()]);

  return {
    memberCount,
    repoCount,
    lastSyncAt: workspace?.updatedAt ?? null,
  };
}

export async function syncAdminWorkspace() {
  const workspace = await getWorkspaceOrThrow();
  const octokit = createOctokit(process.env['GITHUB_TOKEN']);

  return syncWorkspace(octokit, workspace.id);
}
