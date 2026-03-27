import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import { normalizeBlogUrl } from '../../shared/blog.js';
import { resolveDisplayNickname } from '../../shared/nickname.js';

export function createMemberService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
  workspaceService: WorkspaceService;
}) {
  const { memberRepo, blogPostRepo, workspaceService } = deps;

  const toResponse = (member: Awaited<ReturnType<MemberRepository['findWithFilters']>>[number]) => ({
    ...member,
    nickname: resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname),
    tracks: [...new Set(member.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null))],
    roles: parseRoles(member.roles),
  });

  function parseRoles(raw: string | null | undefined): string[] {
    if (!raw) return ['crew'];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : ['crew'];
    } catch {
      return ['crew'];
    }
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
        ...(input.nickname ? { nickname: input.nickname, manualNickname: input.nickname } : {}),
        ...(input.cohort != null ? { cohort: input.cohort } : {}),
        ...(input.blog ? { blog: normalizeBlogUrl(input.blog) } : {}),
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
        ...(input.blog !== undefined ? { blog: normalizeBlogUrl(input.blog) } : {}),
        ...(input.roles !== undefined ? { roles: JSON.stringify(input.roles) } : {}),
      });
      return toResponse(member);
    },

    getMemberBlogPosts: (id: number) => blogPostRepo.findByMember(id),

    deleteMember: (id: number) => memberRepo.deleteWithRelations(id),

    deleteAllMembers: async () => {
      const workspace = await workspaceService.getOrThrow();
      return memberRepo.deleteAllWithRelations(workspace.id);
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
