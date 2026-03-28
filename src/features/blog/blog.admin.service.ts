import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { BlogService } from './blog.service.js';
import { probeRss } from './blog.service.js';
import { fetchUserBlogCandidates } from '../sync/github.service.js';
import { mergePreviousGithubIds } from '../../shared/github-profile.js';

export function createBlogAdminService(deps: {
  memberRepo: MemberRepository;
  workspaceService: WorkspaceService;
  blogService: BlogService;
  octokit: Octokit;
}) {
  const { memberRepo, workspaceService, blogService, octokit } = deps;

  return {
    syncWorkspaceBlogs: async () => {
      const workspace = await workspaceService.getOrThrow();
      if (!workspace.blogSyncEnabled) {
        return { synced: 0, deleted: 0, skipped: true };
      }
      return blogService.syncBlogs(workspace.id);
    },

    backfillWorkspaceBlogLinks: async (limit = 30, cohort?: number) => {
      const workspace = await workspaceService.getOrThrow();
      const members = await memberRepo.findMany({
        where: { workspaceId: workspace.id, blog: null, ...(cohort != null ? { cohort } : {}) },
        orderBy: [{ submissions: { _count: 'desc' } }, { id: 'asc' }],
        take: limit,
        select: { id: true, githubId: true, githubUserId: true, nickname: true, previousGithubIds: true },
      });

      let updated = 0;
      let missing = 0;
      const failures: { githubId: string; reason: string }[] = [];

      for (const member of members) {
        try {
          const { profile, candidates } = await fetchUserBlogCandidates(octokit, {
            githubUserId: member.githubUserId,
            username: member.githubId,
          });

          // 후보 URL들을 하나씩 RSS 검사 → 성공한 첫 번째를 블로그로 저장
          let confirmedBlog: string | null = null;
          let confirmedRssUrl: string | undefined;

          for (const candidate of candidates) {
            try {
              const rssCheck = await probeRss(candidate);
              if (rssCheck.status === 'available') {
                confirmedBlog = candidate;
                confirmedRssUrl = rssCheck.rssUrl;
                break;
              }
            } catch {
              // 이 후보는 skip
            }
          }

          const baseFields = {
            githubId: profile.githubId,
            githubUserId: profile.githubUserId,
            previousGithubIds: mergePreviousGithubIds(member.previousGithubIds, member.githubId, profile.githubId),
            avatarUrl: profile.avatarUrl,
            profileFetchedAt: new Date(),
            profileRefreshError: null,
          };

          if (confirmedBlog) {
            await memberRepo.patch(member.id, {
              ...baseFields,
              blog: confirmedBlog,
              rssStatus: 'available',
              rssUrl: confirmedRssUrl ?? null,
              rssCheckedAt: new Date(),
              rssError: null,
            });
            updated++;
          } else if (candidates.length > 0 && candidates[0]) {
            // 링크는 있으나 RSS 없음 — 일단 첫 번째 저장 (수동 확인용), 나중에 sync 때 재시도
            await memberRepo.patch(member.id, {
              ...baseFields,
              blog: candidates[0] as string,
              rssStatus: 'unavailable',
              rssUrl: null,
              rssCheckedAt: new Date(),
              rssError: null,
            });
            updated++;
          } else {
            // 링크 자체가 없음
            await memberRepo.patch(member.id, { ...baseFields, avatarUrl: profile.avatarUrl });
            missing++;
          }
        } catch (error) {
          const reason =
            typeof error === 'object' && error !== null && 'status' in error
              ? `github_api_${String(error.status)}`
              : 'github_api_error';
          failures.push({ githubId: member.githubId, reason });
        }
      }

      return { checked: members.length, updated, missing, failed: failures.length, failures: failures.slice(0, 10) };
    },
  };
}

export type BlogAdminService = ReturnType<typeof createBlogAdminService>;
