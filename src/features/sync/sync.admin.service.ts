import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { SyncService } from './sync.service.js';

export function createSyncAdminService(deps: {
  memberRepo: MemberRepository;
  missionRepoRepo: MissionRepoRepository;
  workspaceService: WorkspaceService;
  syncService: SyncService;
  octokit: Octokit;
}) {
  const { memberRepo, missionRepoRepo, workspaceService, syncService, octokit } = deps;

  return {
    getAdminStatus: async (): Promise<{ memberCount: number; repoCount: number; lastSyncAt: Date | null }> => {
      const workspace = await workspaceService.getOrThrow().catch(() => null);
      const [memberCount, repoCount] = await Promise.all([memberRepo.count(), missionRepoRepo.count()]);
      return { memberCount, repoCount, lastSyncAt: workspace?.updatedAt ?? null };
    },

    syncAdminWorkspace: async () => {
      const workspace = await workspaceService.getOrThrow();
      return syncService.syncWorkspace(octokit, workspace.id);
    },
  };
}

export type SyncAdminService = ReturnType<typeof createSyncAdminService>;
