import type { Octokit } from '@octokit/rest';
import type { MemberRepository, MemberWithRelations } from '../../db/repositories/member.repository.js';
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

  const toResponse = (member: MemberWithRelations) => {
    const cohortMap = new Map<number, string[]>();
    for (const mc of member.memberCohorts) {
      if (!cohortMap.has(mc.cohort.number)) cohortMap.set(mc.cohort.number, []);
      cohortMap.get(mc.cohort.number)!.push(mc.role.name);
    }

    const cohorts = [...cohortMap.entries()]
      .map(([cohort, roles]) => ({ cohort, roles }))
      .sort((a, b) => b.cohort - a.cohort);

    const primaryCohort = cohorts[0];

    return {
      id: member.id,
      githubId: member.githubId,
      githubUserId: member.githubUserId,
      nickname: resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname),
      manualNickname: member.manualNickname,
      avatarUrl: member.avatarUrl,
      blog: member.blog,
      lastPostedAt: member.lastPostedAt,
      profileFetchedAt: member.profileFetchedAt,
      profileRefreshError: member.profileRefreshError,
      rssStatus: member.rssStatus,
      rssUrl: member.rssUrl,
      rssCheckedAt: member.rssCheckedAt,
      rssError: member.rssError,
      cohorts,
      cohort: primaryCohort?.cohort ?? null,
      roles: primaryCohort?.roles ?? ['crew'],
      tracks: [...new Set(member.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null))],
      blogPostsLatest: member.blogPostsLatest,
      submissions: member.submissions,
      _count: member._count,
    };
  };

  async function refreshMemberProfileById(id: number) {
    const member = await memberRepo.findByIdWithRelations(id);
    if (!member) {
      throw new Error('member not found');
    }

    const profile = await fetchUserProfile(octokit, {
      githubUserId: member.githubUserId,
      username: member.githubId,
    });

    const updated = await memberRepo.update(id, {
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

    getByGithubId: async (githubId: string) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.findByGithubId(githubId, workspace.id);
      return member ? toResponse(member) : null;
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
        ...(input.blog
          ? {
              blog: normalizeBlogUrl(input.blog),
              rssStatus: 'unknown',
              rssUrl: null,
              rssCheckedAt: null,
              rssError: null,
            }
          : {}),
        workspaceId: workspace.id,
      });

      if (input.cohort != null) {
        const roles = input.roles?.length ? input.roles : ['crew'];
        for (const role of roles) {
          await memberRepo.upsertParticipation(member.id, input.cohort, role);
        }
      }

      const updated = await memberRepo.findByIdWithRelations(member.id);
      return updated ? toResponse(updated) : null;
    },

    updateMember: async (
      id: number,
      input: { manualNickname?: string | null; blog?: string | null; roles?: string[]; cohort?: number },
    ) => {
      await memberRepo.update(id, {
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
      });

      if (input.cohort != null && input.roles !== undefined) {
        for (const role of input.roles) {
          await memberRepo.upsertParticipation(id, input.cohort, role);
        }
      }

      const updated = await memberRepo.findByIdWithRelations(id);
      return updated ? toResponse(updated) : null;
    },

    get: async (id: number) => {
      const member = await memberRepo.findByIdWithRelations(id);
      return member ? toResponse(member) : null;
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
