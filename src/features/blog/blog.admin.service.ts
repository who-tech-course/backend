import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { BlogService } from './blog.service.js';
import { probeRss } from './blog.service.js';
import { fetchUserBlogCandidates } from '../sync/github.service.js';
import { mergePreviousGithubIds } from '../../shared/github-profile.js';
// blog.admin.service.ts

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
        return { synced: 0, deleted: 0, failures: [], skipped: true };
      }
      return blogService.syncBlogs(workspace.id);
    },

    // 1. limit을 인자로 받긴 하되, 리포지토리에는 넘기지 않습니다.
    backfillWorkspaceBlogLinks: async (limit = 30, cohort?: number) => {
      const workspace = await workspaceService.getOrThrow();

      // 2. 리포지토리에는 limit을 빼고 호출하여 에러를 방지합니다.
      const allTargetMembers = await memberRepo.findWithFilters(workspace.id, {
        hasBlog: false,
        ...(cohort !== undefined ? { cohort } : {}),
      });

      // 3. 자바스크립트에서 요청받은 limit만큼만 자릅니다. (에러 원천 차단)
      const members = allTargetMembers.slice(0, limit);

      let updated = 0;
      let missing = 0;
      const failures: { githubId: string; reason: string }[] = [];

      for (const member of members) {
        try {
          // ... (이하 로직은 기존과 동일) ...
          const { profile, candidates } = await fetchUserBlogCandidates(octokit, {
            githubUserId: member.githubUserId,
            username: member.githubId,
          });

          let confirmedBlog: string | null = null;
          let confirmedRssUrl: string | null = null;

          for (const candidate of candidates) {
            if (!candidate) continue;
            try {
              const rssCheck = await probeRss(candidate);
              if (rssCheck.status === 'available') {
                confirmedBlog = candidate;
                confirmedRssUrl = rssCheck.rssUrl ?? null;
                break;
              }
            } catch {
              continue;
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
              rssUrl: confirmedRssUrl,
              rssCheckedAt: new Date(),
              rssError: null,
            });
            updated++;
          } else if (candidates.length > 0 && candidates[0]) {
            await memberRepo.patch(member.id, {
              ...baseFields,
              blog: candidates[0],
              rssStatus: 'unavailable',
              rssUrl: null,
              rssCheckedAt: new Date(),
              rssError: null,
            });
            updated++;
          } else {
            await memberRepo.patch(member.id, { ...baseFields });
            missing++;
          }
        } catch (error: unknown) {
          let reason = 'github_api_error';

          if (typeof error === 'object' && error !== null && 'status' in error) {
            reason = `github_api_${String((error as { status: number | string }).status)}`;
          }

          failures.push({ githubId: member.githubId, reason });
        }
      }

      return {
        checked: members.length,
        updated,
        missing,
        failed: failures.length,
        failures: failures.slice(0, 10),
      };
    },
  };
}
export type BlogAdminService = ReturnType<typeof createBlogAdminService>;
