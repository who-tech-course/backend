import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { syncWorkspaceBlogs } from './blog.admin.service.js';

const router = Router();

router.post(
  '/blog/sync',
  asyncHandler(async (_req, res) => {
    res.json(await syncWorkspaceBlogs());
  }),
);

export default router;
