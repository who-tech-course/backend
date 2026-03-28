import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import { normalizeBlogUrl } from '../../shared/blog.js';
import { mergePreviousGithubIds, shouldRefreshProfile } from '../../shared/github-profile.js';
import { resolveDisplayNickname } from '../../shared/nickname.js';
import { fetchUserProfile } from '../sync/github.service.js';

export function createMemberService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
  workspaceService: WorkspaceService;
  octokit: Octokit;
}) {
  const { memberRepo, blogPostRepo, workspaceService, octokit } = deps;

  const toResponse = (member: Awaited<ReturnType<MemberRepository['findWithFilters']>>[number]) => {
    const rawMember = member as typeof member & {
      githubUserId?: number | null;
      previousGithubIds?: string | null;
    };
    const safeMember = Object.fromEntries(
      Object.entries(rawMember).filter(([key]) => key !== 'githubUserId' && key !== 'previousGithubIds'),
    );
    return {
      ...safeMember,
      nickname: resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname),
      tracks: [...new Set(member.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null))],
      roles: parseRoles(member.roles),
    };
  };

  function parseRoles(raw: string | null | undefined): string[] {
    if (!raw) return ['crew'];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : ['crew'];
    } catch {
      return ['crew'];
    }
  }

  async function refreshMemberProfileById(id: number) {
    const member = await memberRepo.findByIdWithRelations(id);
    if (!member) {
      throw new Error('member not found');
    }

    const profile = await fetchUserProfile(octokit, {
      githubUserId: member.githubUserId,
      username: member.githubId,
    });

    const updated = await memberRepo.updateWithRelations(id, {
      githubId: profile.githubId,
      githubUserId: profile.githubUserId,
      previousGithubIds: mergePreviousGithubIds(member.previousGithubIds, member.githubId, profile.githubId),
      avatarUrl: profile.avatarUrl ?? member.avatarUrl ?? null,
      ...(member.blog ? {} : { blog: profile.blog }),
      profileFetchedAt: new Date(),
      profileRefreshError: null,
    });

    return toResponse(updated);
  }

  return {
    listMembers: async (filters?: {
      q?: string;
      cohort?: number;
      hasBlog?: boolean;
      track?: string;
      role?: string;
    }) => {
      const workspace = await workspaceService.getOrThrow();
      const members = await memberRepo.findWithFilters(workspace.id, filters);
      return members.map(toResponse);
    },

    createMember: async (input: {
      githubId: string;
      nickname?: string | null;
      cohort?: number | null;
      blog?: string | null;
      roles?: string[];
    }) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.create({
        githubId: input.githubId,
        githubUserId: null,
        previousGithubIds: null,
        ...(input.nickname ? { nickname: input.nickname, manualNickname: input.nickname } : {}),
        ...(input.cohort != null ? { cohort: input.cohort } : {}),
        ...(input.blog
          ? {
              blog: normalizeBlogUrl(input.blog),
              rssStatus: 'unknown',
              rssUrl: null,
              rssCheckedAt: null,
              rssError: null,
            }
          : {}),
        roles: JSON.stringify(input.roles?.length ? input.roles : ['crew']),
        workspaceId: workspace.id,
      });
      return toResponse(member);
    },

    updateMember: async (
      id: number,
      input: { manualNickname?: string | null; blog?: string | null; roles?: string[] },
    ) => {
      const member = await memberRepo.updateWithRelations(id, {
        ...(input.manualNickname !== undefined ? { manualNickname: input.manualNickname } : {}),
        ...(input.blog !== undefined
          ? {
              blog: normalizeBlogUrl(input.blog),
              rssStatus: 'unknown',
              rssUrl: null,
              rssCheckedAt: null,
              rssError: null,
            }
          : {}),
        ...(input.roles !== undefined ? { roles: JSON.stringify(input.roles) } : {}),
      });
      return toResponse(member);
    },

    getMemberBlogPosts: (id: number) => blogPostRepo.findByMember(id),

    refreshMemberProfile: async (id: number) => {
      try {
        return await refreshMemberProfileById(id);
      } catch (error) {
        if (error instanceof Error && error.message === 'member not found') {
          throw error;
        }
        await memberRepo.patch(id, {
          profileFetchedAt: new Date(),
          profileRefreshError: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },

    refreshWorkspaceProfiles: async (input?: { limit?: number; cohort?: number; staleHours?: number }) => {
      const workspace = await workspaceService.getOrThrow();
      const staleBefore = new Date(Date.now() - (input?.staleHours ?? 24) * 60 * 60 * 1000);
      const members = await memberRepo.listStaleProfiles(workspace.id, {
        ...(input?.limit !== undefined ? { limit: input.limit } : { limit: 30 }),
        ...(input?.cohort !== undefined ? { cohort: input.cohort } : {}),
        staleBefore,
      });

      let checked = 0;
      let refreshed = 0;
      const failures: { githubId: string; reason: string }[] = [];

      for (const member of members) {
        checked += 1;
        try {
          if (!shouldRefreshProfile(member.profileFetchedAt, input?.staleHours ?? 24) && member.avatarUrl) {
            continue;
          }
          await refreshMemberProfileById(member.id);
          refreshed += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await memberRepo.patch(member.id, {
            profileFetchedAt: new Date(),
            profileRefreshError: reason,
          });
          failures.push({ githubId: member.githubId, reason });
        }
      }

      return { checked, refreshed, failed: failures.length, failures: failures.slice(0, 10) };
    },

    deleteMember: (id: number) => memberRepo.deleteWithRelations(id),

    deleteAllMembers: async () => {
      const workspace = await workspaceService.getOrThrow();
      return memberRepo.deleteAllWithRelations(workspace.id);
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
