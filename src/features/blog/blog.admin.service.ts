import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { BlogService } from './blog.service.js';
import { fetchUserBlogUrl } from '../sync/github.service.js';

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
      return blogService.syncBlogs(workspace.id);
    },

    backfillWorkspaceBlogLinks: async (limit = 30) => {
      const workspace = await workspaceService.getOrThrow();
      const members = await memberRepo.findMany({
        where: { workspaceId: workspace.id, blog: null },
        orderBy: [{ submissions: { _count: 'desc' } }, { id: 'asc' }],
        take: limit,
        select: { id: true, githubId: true, nickname: true },
      });

      let updated = 0;
      let missing = 0;
      const failures: { githubId: string; reason: string }[] = [];

      for (const member of members) {
        try {
          const blog = await fetchUserBlogUrl(octokit, member.githubId);
          if (!blog) {
            missing++;
            continue;
          }
          await memberRepo.patch(member.id, { blog });
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
