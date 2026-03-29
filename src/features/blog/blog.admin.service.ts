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
        return { synced: 0, deleted: 0, failures: [], skipped: true };
      }
      return blogService.syncBlogs(workspace.id);
    },

    // 1. limit 인자 다시 추가
    backfillWorkspaceBlogLinks: async (limit = 30, cohort?: number) => {
      const workspace = await workspaceService.getOrThrow();

      // 2. findWithFilters에 limit(take) 전달
      const members = await memberRepo.findWithFilters(workspace.id, {
        hasBlog: false,
        limit, // 👈 리포지토리에 limit 전달
        ...(cohort !== undefined ? { cohort } : {}),
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
            await memberRepo.patch(member.id, {
              ...baseFields,
            });
            missing++;
          }
        } catch (error) {
          const reason =
            typeof error === 'object' && error !== null && 'status' in error
              ? `github_api_${String((error as any).status)}`
              : 'github_api_error';
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
