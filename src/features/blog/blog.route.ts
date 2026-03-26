import { Router } from 'express';
import prisma from '../../db/prisma.js';
import { syncBlogs } from './blog.service.js';
import { WORKSPACE_NAME } from '../../shared/constants.js';

const router = Router();

router.post('/blog/sync', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: WORKSPACE_NAME } });
  const result = await syncBlogs(workspace.id);
  res.json(result);
});

export default router;
