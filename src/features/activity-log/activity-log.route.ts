import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import type { ActivityLogService } from './activity-log.service.js';

export function createActivityLogRouter(service: ActivityLogService) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await service.getLogs());
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { type, message } = req.body as { type: string; message: string };
      res.json(await service.addLog(type, message));
    }),
  );

  router.delete(
    '/',
    asyncHandler(async (_req, res) => {
      await service.clearLogs();
      res.status(204).end();
    }),
  );

  return router;
}
