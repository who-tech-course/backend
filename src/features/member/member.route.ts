import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseId } from '../../shared/validation.js';
import type { MemberService } from './member.service.js';

export function createMemberRouter(service: MemberService) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
      const cohort = typeof req.query['cohort'] === 'string' ? Number(req.query['cohort']) : undefined;
      const hasBlog = req.query['hasBlog'] === 'true' ? true : req.query['hasBlog'] === 'false' ? false : undefined;
      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
      const role = typeof req.query['role'] === 'string' ? req.query['role'] : undefined;
      res.json(
        await service.listMembers({
          ...(q ? { q } : {}),
          ...(cohort && !Number.isNaN(cohort) ? { cohort } : {}),
          ...(hasBlog !== undefined ? { hasBlog } : {}),
          ...(track ? { track } : {}),
          ...(role ? { role } : {}),
        }),
      );
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = req.body as {
        githubId: string;
        nickname?: string | null;
        cohort?: number | null;
        blog?: string | null;
        roles?: string[];
      };
      if (!body.githubId || typeof body.githubId !== 'string') {
        res.status(400).json({ error: 'githubId required' });
        return;
      }
      res.status(201).json(await service.createMember(body));
    }),
  );

  router.get(
    '/:id/blog-posts',
    asyncHandler(async (req, res) => {
      res.json(await service.getMemberBlogPosts(parseId(req.params['id'])));
    }),
  );

  router.post(
    '/refresh-profiles',
    asyncHandler(async (req, res) => {
      const limitValue = req.query['limit'];
      const limit = typeof limitValue === 'string' ? Number(limitValue) : 30;
      const cohortValue = req.query['cohort'];
      const cohort = typeof cohortValue === 'string' ? Number(cohortValue) : undefined;
      const staleHoursValue = req.query['staleHours'];
      const staleHours = typeof staleHoursValue === 'string' ? Number(staleHoursValue) : undefined;
      res.json(
        await service.refreshWorkspaceProfiles({
          ...(Number.isFinite(limit) ? { limit } : {}),
          ...(cohort && !Number.isNaN(cohort) ? { cohort } : {}),
          ...(staleHours && !Number.isNaN(staleHours) ? { staleHours } : {}),
        }),
      );
    }),
  );

  router.post(
    '/:id/refresh-profile',
    asyncHandler(async (req, res) => {
      res.json(await service.refreshMemberProfile(parseId(req.params['id'])));
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params['id']);
      const body = req.body as { manualNickname?: string | null; blog?: string | null; roles?: string[] };
      res.json(await service.updateMember(id, body));
    }),
  );

  router.delete(
    '/',
    asyncHandler(async (_req, res) => {
      await service.deleteAllMembers();
      res.status(204).end();
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await service.deleteMember(parseId(req.params['id']));
      res.status(204).end();
    }),
  );

  return router;
}
