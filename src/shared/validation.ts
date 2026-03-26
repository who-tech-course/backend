import type { CohortRule } from './types/index.js';
import { badRequest } from './http.js';

export function parseId(value: string | string[] | undefined): number {
  if (Array.isArray(value)) {
    badRequest('invalid id');
  }

  const id = Number(value);
  if (Number.isNaN(id)) {
    badRequest('invalid id');
  }

  return id;
}

export function parseNullableString(value: unknown, fieldName: string): string | null {
  if (typeof value === 'string' || value === null) {
    return value;
  }

  badRequest(`invalid ${fieldName}`);
}

export function parseWorkspaceUpdateInput(body: unknown): {
  nicknameRegex?: string;
  cohortRules?: CohortRule[];
} {
  if (!isRecord(body)) {
    badRequest('invalid body');
  }

  const { nicknameRegex, cohortRules } = body;

  if (nicknameRegex !== undefined && typeof nicknameRegex !== 'string') {
    badRequest('invalid nicknameRegex');
  }

  if (cohortRules !== undefined && !isCohortRules(cohortRules)) {
    badRequest('invalid cohortRules');
  }

  return {
    ...(nicknameRegex !== undefined ? { nicknameRegex } : {}),
    ...(cohortRules !== undefined ? { cohortRules } : {}),
  };
}

export function parseRepoCreateInput(body: unknown): {
  name: string;
  repoUrl: string;
  track: string;
  type?: string;
  nicknameRegex?: string;
} {
  if (!isRecord(body)) {
    badRequest('invalid body');
  }

  const { name, repoUrl, track, type, nicknameRegex } = body;

  if (typeof name !== 'string' || typeof repoUrl !== 'string' || typeof track !== 'string') {
    badRequest('invalid repo payload');
  }

  if (type !== undefined && typeof type !== 'string') {
    badRequest('invalid type');
  }

  if (nicknameRegex !== undefined && typeof nicknameRegex !== 'string') {
    badRequest('invalid nicknameRegex');
  }

  return {
    name,
    repoUrl,
    track,
    ...(type !== undefined ? { type } : {}),
    ...(nicknameRegex !== undefined ? { nicknameRegex } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCohortRules(value: unknown): value is CohortRule[] {
  return (
    Array.isArray(value) &&
    value.every((rule) => isRecord(rule) && typeof rule['year'] === 'number' && typeof rule['cohort'] === 'number')
  );
}
