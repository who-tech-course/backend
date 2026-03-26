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
      res.json(
        await service.listMembers({
          ...(q ? { q } : {}),
          ...(cohort && !Number.isNaN(cohort) ? { cohort } : {}),
          ...(hasBlog !== undefined ? { hasBlog } : {}),
        }),
      );
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params['id']);
      const body = req.body as { manualNickname?: string | null; blog?: string | null };
      res.json(await service.updateMember(id, body));
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
