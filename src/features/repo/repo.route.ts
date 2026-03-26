import { Router } from 'express';
import prisma from '../../db/prisma.js';
import { WORKSPACE_NAME } from '../../shared/constants.js';
import { createOctokit } from '../sync/github.service.js';
import { syncRepo } from '../sync/sync.service.js';
import type { CohortRule } from '../../shared/types/index.js';

const router = Router();

router.get('/', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: WORKSPACE_NAME } });
  const repos = await prisma.missionRepo.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: 'asc' },
  });
  res.json(repos);
});

router.post('/', async (req, res) => {
  const { name, repoUrl, track, type, nicknameRegex } = req.body as {
    name: string;
    repoUrl: string;
    track: string;
    type?: string;
    nicknameRegex?: string;
  };

  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: WORKSPACE_NAME } });

  const repo = await prisma.missionRepo.create({
    data: {
      name,
      repoUrl,
      track,
      type: type ?? 'individual',
      nicknameRegex: nicknameRegex ?? null,
      workspaceId: workspace.id,
    },
  });

  res.status(201).json(repo);
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ message: 'invalid id' });
    return;
  }

  const { nicknameRegex } = req.body as { nicknameRegex: string | null };
  if (typeof nicknameRegex !== 'string' && nicknameRegex !== null) {
    res.status(400).json({ message: 'invalid nicknameRegex' });
    return;
  }

  const repo = await prisma.missionRepo.update({
    where: { id },
    data: { nicknameRegex: nicknameRegex ?? null },
  });

  res.json(repo);
});

router.post('/:id/sync', async (req, res) => {
  const id = Number(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ message: 'invalid id' });
    return;
  }

  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: WORKSPACE_NAME } });
  const repo = await prisma.missionRepo.findUniqueOrThrow({ where: { id } });

  const cohortRules: CohortRule[] = JSON.parse(workspace.cohortRules);
  const nicknameRegex = repo.nicknameRegex ? new RegExp(repo.nicknameRegex) : new RegExp(workspace.nicknameRegex);

  const octokit = createOctokit(process.env['GITHUB_TOKEN']);
  const { synced } = await syncRepo(octokit, workspace.id, workspace.githubOrg, repo, nicknameRegex, cohortRules);

  res.json({ synced });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ message: 'invalid id' });
    return;
  }

  await prisma.$transaction([
    prisma.submission.deleteMany({ where: { missionRepoId: id } }),
    prisma.missionRepo.delete({ where: { id } }),
  ]);

  res.status(204).end();
});

export default router;
