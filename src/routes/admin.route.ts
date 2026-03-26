import { Router } from 'express';
import { createOctokit } from '../services/github.service.js';
import { syncWorkspace } from '../services/sync.service.js';
import prisma from '../db/prisma.js';
import { adminAuth } from '../middleware/auth.js';
import type { CohortRule } from '../types/index.js';

const router = Router();
router.use(adminAuth);

router.get('/status', async (_req, res) => {
  const workspace = await prisma.workspace.findFirst({ where: { name: 'woowacourse' } });
  const memberCount = await prisma.member.count();
  res.json({
    memberCount,
    lastSyncAt: workspace?.updatedAt ?? null,
  });
});

router.get('/workspace', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });
  res.json({
    nicknameRegex: workspace.nicknameRegex,
    cohortRules: JSON.parse(workspace.cohortRules),
  });
});

router.put('/workspace', async (req, res) => {
  const { nicknameRegex, cohortRules } = req.body as {
    nicknameRegex?: string;
    cohortRules?: CohortRule[];
  };

  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });

  const updated = await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      ...(nicknameRegex && { nicknameRegex }),
      ...(cohortRules && { cohortRules: JSON.stringify(cohortRules) }),
    },
  });

  res.json({
    nicknameRegex: updated.nicknameRegex,
    cohortRules: JSON.parse(updated.cohortRules),
  });
});

router.post('/sync', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });
  const octokit = createOctokit(process.env['GITHUB_TOKEN']);

  const { totalSynced, reposSynced } = await syncWorkspace(octokit, workspace.id);

  res.json({ totalSynced, reposSynced });
});

export default router;
