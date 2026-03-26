import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import { normalizeBlogUrl } from '../../shared/blog.js';
import { resolveDisplayNickname } from '../../shared/nickname.js';

export function createMemberService(deps: { memberRepo: MemberRepository; workspaceService: WorkspaceService }) {
  const { memberRepo, workspaceService } = deps;

  const toResponse = (member: Awaited<ReturnType<MemberRepository['findWithFilters']>>[number]) => ({
    ...member,
    nickname: resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname),
    tracks: [...new Set(member.submissions.map((s) => s.missionRepo.track))],
  });

  return {
    listMembers: async (filters?: { q?: string; cohort?: number; hasBlog?: boolean }) => {
      const workspace = await workspaceService.getOrThrow();
      const members = await memberRepo.findWithFilters(workspace.id, filters);
      return members.map(toResponse);
    },

    updateMember: async (id: number, input: { manualNickname?: string | null; blog?: string | null }) => {
      const member = await memberRepo.updateWithRelations(id, {
        ...(input.manualNickname !== undefined ? { manualNickname: input.manualNickname } : {}),
        ...(input.blog !== undefined ? { blog: normalizeBlogUrl(input.blog) } : {}),
      });
      return toResponse(member);
    },

    deleteMember: (id: number) => memberRepo.deleteWithRelations(id),
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
