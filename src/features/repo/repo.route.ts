import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseId, parseNullableString, parseRepoCreateInput } from '../../shared/validation.js';
import { createRepo, deleteRepo, listRepos, syncRepoById, updateRepoNicknameRegex } from './repo.service.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listRepos());
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const repo = await createRepo(parseRepoCreateInput(req.body));
    res.status(201).json(repo);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params['id']);
    const nicknameRegex = parseNullableString((req.body as { nicknameRegex?: unknown }).nicknameRegex, 'nicknameRegex');
    res.json(await updateRepoNicknameRegex(id, nicknameRegex));
  }),
);

router.post(
  '/:id/sync',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params['id']);
    res.json(await syncRepoById(id));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params['id']);
    await deleteRepo(id);
    res.status(204).end();
  }),
);

export default router;
