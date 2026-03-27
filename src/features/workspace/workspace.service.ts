import type { WorkspaceRepository } from '../../db/repositories/workspace.repository.js';
import type { CohortRule } from '../../shared/types/index.js';

export function createWorkspaceService(deps: { workspaceRepo: WorkspaceRepository }) {
  const { workspaceRepo } = deps;

  return {
    getOrThrow: () => workspaceRepo.findOrThrow(),

    getSettings: async (): Promise<{ nicknameRegex: string; cohortRules: CohortRule[] }> => {
      const workspace = await workspaceRepo.findOrThrow();
      return {
        nicknameRegex: workspace.nicknameRegex,
        cohortRules: JSON.parse(workspace.cohortRules) as CohortRule[],
      };
    },

    updateSettings: async (input: {
      nicknameRegex?: string;
      cohortRules?: CohortRule[];
    }): Promise<{ nicknameRegex: string; cohortRules: CohortRule[] }> => {
      const workspace = await workspaceRepo.findOrThrow();
      const updated = await workspaceRepo.update(workspace.id, {
        ...(input.nicknameRegex !== undefined ? { nicknameRegex: input.nicknameRegex } : {}),
        ...(input.cohortRules !== undefined ? { cohortRules: JSON.stringify(input.cohortRules) } : {}),
      });
      return {
        nicknameRegex: updated.nicknameRegex,
        cohortRules: JSON.parse(updated.cohortRules) as CohortRule[],
      };
    },

    getSyncContext: async (): Promise<{
      id: number;
      githubOrg: string;
      cohortRules: CohortRule[];
      workspaceRegex: RegExp;
    }> => {
      const workspace = await workspaceRepo.findOrThrow();
      return {
        id: workspace.id,
        githubOrg: workspace.githubOrg,
        cohortRules: JSON.parse(workspace.cohortRules) as CohortRule[],
        workspaceRegex: new RegExp(workspace.nicknameRegex),
      };
    },
  };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
