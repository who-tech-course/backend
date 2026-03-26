import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { getAdminStatus, syncAdminWorkspace } from './sync.admin.service.js';

const router = Router();

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json(await getAdminStatus());
  }),
);

router.post(
  '/sync',
  asyncHandler(async (_req, res) => {
    res.json(await syncAdminWorkspace());
  }),
);

export default router;
