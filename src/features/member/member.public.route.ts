import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import type { MemberPublicService } from './member.public.service.js';

export function createMemberPublicRouter(service: MemberPublicService) {
  const router = Router();

  // GET /members?q=&cohort=&track=&role=
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
      const cohort = typeof req.query['cohort'] === 'string' ? Number(req.query['cohort']) : undefined;
      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
      const role = typeof req.query['role'] === 'string' ? req.query['role'] : undefined;
      res.json(
        await service.searchMembers({
          ...(q ? { q } : {}),
          ...(cohort && !Number.isNaN(cohort) ? { cohort } : {}),
          ...(track ? { track } : {}),
          ...(role ? { role } : {}),
        }),
      );
    }),
  );

  // GET /members/feed?cohort=&track=
  // [수정된 라우터 코드]

  router.get(
    '/feed',
    asyncHandler(async (req, res) => {
      const cohort = typeof req.query['cohort'] === 'string' ? Number(req.query['cohort']) : undefined;
      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;

      // 🚨 수정: 'range' 대신 프론트가 보내는 'days' 파라미터를 직접 읽습니다.
      const daysParam = typeof req.query['days'] === 'string' ? req.query['days'] : undefined;

      // 기본값은 7일, 파라미터가 있으면 해당 숫자를 사용
      let days = 7;
      if (daysParam) {
        const parsedDays = parseInt(daysParam, 10);
        if (!isNaN(parsedDays)) {
          days = parsedDays; // 30일 제한을 풀고 싶으면 Math.min 제거
        }
      }

      const limit = days <= 7 ? 50 : 200;

      res.json(
        await service.getFeed({
          ...(cohort && !Number.isNaN(cohort) ? { cohort } : {}),
          ...(track ? { track } : {}),
          days,
          limit,
        }),
      );
    }),
  );
  // GET /members/:githubId
  router.get(
    '/:githubId',
    asyncHandler(async (req, res) => {
      const githubId = typeof req.params['githubId'] === 'string' ? req.params['githubId'] : '';
      const member = await service.getMemberDetail(githubId);
      if (!member) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      res.json(member);
    }),
  );

  return router;
}
