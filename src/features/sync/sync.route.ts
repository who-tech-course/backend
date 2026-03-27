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
    asyncHandler(async (req, res) => {
      const cohort = typeof req.body?.cohort === 'number' ? req.body.cohort : undefined;
      res.json(await service.syncAdminWorkspace(cohort));
    }),
  );

  router.get('/sync/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const cohort = typeof req.query['cohort'] === 'string' ? Number(req.query['cohort']) : undefined;

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    service
      .syncAdminWorkspaceStream((step) => send('progress', step), cohort && !Number.isNaN(cohort) ? cohort : undefined)
      .then((result) => {
        send('done', result);
        res.end();
      })
      .catch((err: unknown) => {
        send('error', { message: err instanceof Error ? err.message : 'sync failed' });
        res.end();
      });
  });

  return router;
}
