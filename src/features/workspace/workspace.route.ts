import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseWorkspaceUpdateInput } from '../../shared/validation.js';
import type { WorkspaceService } from './workspace.service.js';

export function createWorkspaceRouter(service: WorkspaceService) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await service.getSettings());
    }),
  );

  router.put(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await service.updateSettings(parseWorkspaceUpdateInput(req.body)));
    }),
  );

  return router;
}
