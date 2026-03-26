import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import type { SyncAdminService } from './sync.admin.service.js';

export function createSyncRouter(service: SyncAdminService) {
  const router = Router();

  router.get(
    '/status',
    asyncHandler(async (_req, res) => {
      res.json(await service.getAdminStatus());
    }),
  );

  router.post(
    '/sync',
    asyncHandler(async (_req, res) => {
      res.json(await service.syncAdminWorkspace());
    }),
  );

  return router;
}
