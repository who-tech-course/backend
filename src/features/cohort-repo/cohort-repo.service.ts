import type { CohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

export function createCohortRepoService(deps: {
  cohortRepoRepo: CohortRepoRepository;
  workspaceService: WorkspaceService;
}) {
  const { cohortRepoRepo, workspaceService } = deps;

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
  };
}

export type CohortRepoService = ReturnType<typeof createCohortRepoService>;
