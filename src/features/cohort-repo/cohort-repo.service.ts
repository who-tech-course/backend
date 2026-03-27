import type { CohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

export function createCohortRepoService(deps: {
  cohortRepoRepo: CohortRepoRepository;
  missionRepoRepo: MissionRepoRepository;
  workspaceService: WorkspaceService;
}) {
  const { cohortRepoRepo, missionRepoRepo, workspaceService } = deps;

  return {
    listByCohort: async (cohort: number) => {
      const workspace = await workspaceService.getOrThrow();
      return cohortRepoRepo.findByCohort(workspace.id, cohort);
    },

    listCohorts: async () => {
      const workspace = await workspaceService.getOrThrow();
      const rows = await cohortRepoRepo.listCohorts(workspace.id);
      return rows.map((r) => r.cohort);
    },

    create: async (input: { cohort: number; missionRepoId: number; order: number }) => {
      const workspace = await workspaceService.getOrThrow();
      return cohortRepoRepo.create({ ...input, workspaceId: workspace.id });
    },

    update: (id: number, input: { order: number }) => cohortRepoRepo.update(id, input),

    delete: (id: number) => cohortRepoRepo.delete(id),

    autoFill: async (cohort: number): Promise<{ added: number }> => {
      const workspace = await workspaceService.getOrThrow();
      const allRepos = await missionRepoRepo.findMany({ workspaceId: workspace.id, status: 'active' });

      // cohorts JSON에 해당 기수 포함된 레포만 필터
      const matching = allRepos.filter((r) => {
        if (!r.cohorts) return false;
        try {
          const cohorts: number[] = JSON.parse(r.cohorts);
          return cohorts.includes(cohort);
        } catch {
          return false;
        }
      });

      if (!matching.length) return { added: 0 };

      // 이미 등록된 것 제외
      const existing = await cohortRepoRepo.findExistingIds(workspace.id, cohort);
      const existingIds = new Set(existing.map((e) => e.missionRepoId));

      const toAdd = matching.filter((r) => !existingIds.has(r.id));
      if (!toAdd.length) return { added: 0 };

      // level asc → name asc 순으로 order 자동 부여
      const sorted = [...toAdd].sort((a, b) => {
        const la = a.level ?? 999;
        const lb = b.level ?? 999;
        return la !== lb ? la - lb : a.name.localeCompare(b.name);
      });

      // 기존 마지막 order 다음부터
      const existing2 = await cohortRepoRepo.findByCohort(workspace.id, cohort);
      const maxOrder = existing2.reduce((m, r) => Math.max(m, r.order), -1);

      const rows = sorted.map((r, i) => ({
        cohort,
        missionRepoId: r.id,
        order: maxOrder + 1 + i,
        workspaceId: workspace.id,
      }));

      await cohortRepoRepo.createMany(rows);
      return { added: rows.length };
    },
  };
}

export type CohortRepoService = ReturnType<typeof createCohortRepoService>;
