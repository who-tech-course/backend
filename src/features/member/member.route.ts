import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { listMembers } from './member.service.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listMembers());
  }),
);

export default router;
