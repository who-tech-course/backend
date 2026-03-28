import { Router } from 'express';
import { asyncHandler, HttpError } from '../../shared/http.js';
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
    '/detect-regex-all',
    asyncHandler(async (_req, res) => {
      res.json(await service.detectAndApplyAllRegex());
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

  router.get(
    '/:id/validate-regex',
    asyncHandler(async (req, res) => {
      res.json(await service.validateRepoRegex(parseId(req.params['id'])));
    }),
  );

  router.get(
    '/:id/detect-regex',
    asyncHandler(async (req, res) => {
      res.json(await service.detectRepoRegex(parseId(req.params['id'])));
    }),
  );

  router.post(
    '/:id/sync',
    asyncHandler(async (req, res) => {
      res.status(202).json(await service.enqueueRepoSyncById(parseId(req.params['id'])));
    }),
  );

  router.get(
    '/sync-jobs/:jobId',
    asyncHandler(async (req, res) => {
      const jobId = req.params['jobId'];
      if (!jobId || Array.isArray(jobId)) {
        throw new HttpError(400, 'invalid job id');
      }
      res.json(await service.getRepoSyncJob(jobId));
    }),
  );

  router.delete(
    '/',
    asyncHandler(async (_req, res) => {
      await service.deleteAllRepos();
      res.status(204).end();
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
