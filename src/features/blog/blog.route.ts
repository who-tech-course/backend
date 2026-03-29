import { Router } from 'express';
import { asyncHandler, badRequest } from '../../shared/http.js';
import type { BlogAdminService } from './blog.admin.service.js';

export function createBlogRouter(service: BlogAdminService) {
  const router = Router();

  // 1. 블로그 동기화 (30일 저장 / 조회는 7일 필터링)
  router.post(
    '/blog/sync',
    asyncHandler(async (_req, res) => {
      res.json(await service.syncWorkspaceBlogs());
    }),
  );

  // 2. 블로그 링크 백필 (RSS 후보 검사 및 자동 등록)
  router.post(
    '/blog/backfill',
    asyncHandler(async (req, res) => {
      // Limit 처리
      const limitValue = req.query['limit'];
      const limit = typeof limitValue === 'string' ? Number(limitValue) : 30;
      if (Number.isNaN(limit) || limit < 1 || limit > 50) {
        return badRequest('invalid limit');
      }

      // Cohort 처리 (Exact Optional 대응)
      const cohortValue = req.query['cohort'];
      const cohortNum = typeof cohortValue === 'string' ? Number(cohortValue) : NaN;

      // NaN이거나 값이 없으면 undefined를 확실히 넘김
      const cohort = !Number.isNaN(cohortNum) ? cohortNum : undefined;

      // 서비스 호출
      // 서비스 내부에서 ...(cohort !== undefined ? { cohort } : {}) 로 처리되므로
      // 여기서 undefined를 넘겨도 안전합니다.
      res.json(await service.backfillWorkspaceBlogLinks(limit, cohort));
    }),
  );

  return router;
}
