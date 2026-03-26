import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseWorkspaceUpdateInput } from '../../shared/validation.js';
import { getWorkspaceSettings, updateWorkspaceSettings } from './workspace.service.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getWorkspaceSettings());
  }),
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const input = parseWorkspaceUpdateInput(req.body);
    res.json(await updateWorkspaceSettings(input));
  }),
);

export default router;
