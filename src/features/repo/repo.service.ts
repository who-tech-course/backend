import prisma from '../../db/prisma.js';
import { createOctokit } from '../sync/github.service.js';
import { syncRepo } from '../sync/sync.service.js';
import { getWorkspaceOrThrow, getWorkspaceSyncContext } from '../workspace/workspace.service.js';

export async function listRepos() {
  const workspace = await getWorkspaceOrThrow();

  return prisma.missionRepo.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: 'asc' },
  });
}

export async function createRepo(input: {
  name: string;
  repoUrl: string;
  track: string;
  type?: string;
  nicknameRegex?: string;
}) {
  const workspace = await getWorkspaceOrThrow();

  return prisma.missionRepo.create({
    data: {
      name: input.name,
      repoUrl: input.repoUrl,
      track: input.track,
      type: input.type ?? 'individual',
      nicknameRegex: input.nicknameRegex ?? null,
      workspaceId: workspace.id,
    },
  });
}

export async function updateRepoNicknameRegex(id: number, nicknameRegex: string | null) {
  return prisma.missionRepo.update({
    where: { id },
    data: { nicknameRegex },
  });
}

export async function syncRepoById(id: number): Promise<{ synced: number }> {
  const context = await getWorkspaceSyncContext();
  const repo = await prisma.missionRepo.findUniqueOrThrow({ where: { id } });
  const nicknameRegex = repo.nicknameRegex ? new RegExp(repo.nicknameRegex) : context.workspaceRegex;
  const octokit = createOctokit(process.env['GITHUB_TOKEN']);

  return syncRepo(octokit, context.id, context.githubOrg, repo, nicknameRegex, context.cohortRules);
}

export async function deleteRepo(id: number): Promise<void> {
  await prisma.$transaction([
    prisma.submission.deleteMany({ where: { missionRepoId: id } }),
    prisma.missionRepo.delete({ where: { id } }),
  ]);
}
