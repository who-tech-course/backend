import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { BlogService } from './blog.service.js';
import { fetchUserProfile } from '../sync/github.service.js';
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
          const profile = await fetchUserProfile(octokit, {
            githubUserId: member.githubUserId,
            username: member.githubId,
          });
          if (!profile.blog && !profile.avatarUrl) {
            missing++;
            continue;
          }
          await memberRepo.patch(member.id, {
            githubId: profile.githubId,
            githubUserId: profile.githubUserId,
            previousGithubIds: mergePreviousGithubIds(member.previousGithubIds, member.githubId, profile.githubId),
            blog: profile.blog,
            avatarUrl: profile.avatarUrl,
            profileFetchedAt: new Date(),
            profileRefreshError: null,
            rssStatus: 'unknown',
            rssUrl: null,
            rssCheckedAt: null,
            rssError: null,
          });
          updated++;
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
