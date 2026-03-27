import { Router } from 'express';
import { asyncHandler, badRequest } from '../../shared/http.js';
import type { BlogAdminService } from './blog.admin.service.js';

export function createBlogRouter(service: BlogAdminService) {
  const router = Router();

  router.post(
    '/blog/sync',
    asyncHandler(async (_req, res) => {
      res.json(await service.syncWorkspaceBlogs());
    }),
  );

  router.post(
    '/blog/backfill',
    asyncHandler(async (req, res) => {
      const limitValue = req.query['limit'];
      const limit = typeof limitValue === 'string' ? Number(limitValue) : 30;
      if (Number.isNaN(limit) || limit < 1 || limit > 50) badRequest('invalid limit');
      const cohortValue = req.query['cohort'];
      const cohort = typeof cohortValue === 'string' ? Number(cohortValue) : undefined;
      res.json(await service.backfillWorkspaceBlogLinks(limit, cohort && !Number.isNaN(cohort) ? cohort : undefined));
    }),
  );

  return router;
}
