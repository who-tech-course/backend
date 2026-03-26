import prisma from '../../db/prisma.js';
import { WORKSPACE_NAME } from '../../shared/constants.js';
import type { CohortRule } from '../../shared/types/index.js';

export async function getWorkspaceOrThrow() {
  return prisma.workspace.findFirstOrThrow({ where: { name: WORKSPACE_NAME } });
}

export async function getWorkspaceSettings(): Promise<{ nicknameRegex: string; cohortRules: CohortRule[] }> {
  const workspace = await getWorkspaceOrThrow();

  return {
    nicknameRegex: workspace.nicknameRegex,
    cohortRules: JSON.parse(workspace.cohortRules) as CohortRule[],
  };
}

export async function updateWorkspaceSettings(input: {
  nicknameRegex?: string;
  cohortRules?: CohortRule[];
}): Promise<{ nicknameRegex: string; cohortRules: CohortRule[] }> {
  const workspace = await getWorkspaceOrThrow();

  const updated = await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      ...(input.nicknameRegex !== undefined ? { nicknameRegex: input.nicknameRegex } : {}),
      ...(input.cohortRules !== undefined ? { cohortRules: JSON.stringify(input.cohortRules) } : {}),
    },
  });

  return {
    nicknameRegex: updated.nicknameRegex,
    cohortRules: JSON.parse(updated.cohortRules) as CohortRule[],
  };
}

export async function getWorkspaceSyncContext(): Promise<{
  id: number;
  githubOrg: string;
  cohortRules: CohortRule[];
  workspaceRegex: RegExp;
}> {
  const workspace = await getWorkspaceOrThrow();

  return {
    id: workspace.id,
    githubOrg: workspace.githubOrg,
    cohortRules: JSON.parse(workspace.cohortRules) as CohortRule[],
    workspaceRegex: new RegExp(workspace.nicknameRegex),
  };
}
