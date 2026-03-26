import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseId, parseRepoCreateInput, parseRepoUpdateInput } from '../../shared/validation.js';
import type { RepoService } from './repo.service.js';

export function createRepoRouter(service: RepoService) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
      res.json(await service.listRepos(status));
    }),
  );

  router.post(
    '/discover',
    asyncHandler(async (_req, res) => {
      res.json(await service.refreshRepoCandidates());
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      res.status(201).json(await service.createRepo(parseRepoCreateInput(req.body)));
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      res.json(await service.updateRepoMatchingRules(parseId(req.params['id']), parseRepoUpdateInput(req.body)));
    }),
  );

  router.post(
    '/:id/sync',
    asyncHandler(async (req, res) => {
      res.json(await service.syncRepoById(parseId(req.params['id'])));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await service.deleteRepo(parseId(req.params['id']));
      res.status(204).end();
    }),
  );

  return router;
}
