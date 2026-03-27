import type { CohortRegexRule, CohortRule } from './types/index.js';
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
  githubRepoId?: number;
  name: string;
  repoUrl: string;
  description?: string | null;
  track: string | null;
  type?: string;
  status?: string;
  syncMode?: string;
  candidateReason?: string | null;
  nicknameRegex?: string;
  cohortRegexRules?: CohortRegexRule[];
} {
  if (!isRecord(body)) {
    badRequest('invalid body');
  }

  const {
    githubRepoId,
    name,
    repoUrl,
    description,
    track,
    type,
    status,
    syncMode,
    candidateReason,
    nicknameRegex,
    cohortRegexRules,
  } = body;

  if (githubRepoId !== undefined && typeof githubRepoId !== 'number') {
    badRequest('invalid githubRepoId');
  }

  if (typeof name !== 'string' || typeof repoUrl !== 'string') {
    badRequest('invalid repo payload');
  }

  if (track !== undefined && track !== null && typeof track !== 'string') {
    badRequest('invalid track');
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    badRequest('invalid description');
  }

  if (type !== undefined && typeof type !== 'string') {
    badRequest('invalid type');
  }

  if (status !== undefined && typeof status !== 'string') {
    badRequest('invalid status');
  }

  if (syncMode !== undefined && typeof syncMode !== 'string') {
    badRequest('invalid syncMode');
  }

  if (candidateReason !== undefined && candidateReason !== null && typeof candidateReason !== 'string') {
    badRequest('invalid candidateReason');
  }

  if (nicknameRegex !== undefined && typeof nicknameRegex !== 'string') {
    badRequest('invalid nicknameRegex');
  }

  if (cohortRegexRules !== undefined && !isCohortRegexRules(cohortRegexRules)) {
    badRequest('invalid cohortRegexRules');
  }

  return {
    ...(githubRepoId !== undefined ? { githubRepoId } : {}),
    name,
    repoUrl,
    ...(description !== undefined ? { description } : {}),
    track: track ?? null,
    ...(type !== undefined ? { type } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(syncMode !== undefined ? { syncMode } : {}),
    ...(candidateReason !== undefined ? { candidateReason } : {}),
    ...(nicknameRegex !== undefined ? { nicknameRegex } : {}),
    ...(cohortRegexRules !== undefined ? { cohortRegexRules } : {}),
  };
}

export function parseRepoUpdateInput(body: unknown): {
  description?: string | null;
  track?: string | null;
  type?: string;
  status?: string;
  syncMode?: string;
  candidateReason?: string | null;
  nicknameRegex?: string | null;
  cohortRegexRules?: CohortRegexRule[] | null;
} {
  if (!isRecord(body)) {
    badRequest('invalid body');
  }

  const { description, track, type, status, syncMode, candidateReason, nicknameRegex, cohortRegexRules } = body;

  if (description !== undefined && description !== null && typeof description !== 'string') {
    badRequest('invalid description');
  }

  if (track !== undefined && track !== null && typeof track !== 'string') {
    badRequest('invalid track');
  }

  if (type !== undefined && typeof type !== 'string') {
    badRequest('invalid type');
  }

  if (status !== undefined && typeof status !== 'string') {
    badRequest('invalid status');
  }

  if (syncMode !== undefined && typeof syncMode !== 'string') {
    badRequest('invalid syncMode');
  }

  if (candidateReason !== undefined && candidateReason !== null && typeof candidateReason !== 'string') {
    badRequest('invalid candidateReason');
  }

  if (nicknameRegex !== undefined && typeof nicknameRegex !== 'string' && nicknameRegex !== null) {
    badRequest('invalid nicknameRegex');
  }

  if (cohortRegexRules !== undefined && cohortRegexRules !== null && !isCohortRegexRules(cohortRegexRules)) {
    badRequest('invalid cohortRegexRules');
  }

  return {
    ...(description !== undefined ? { description } : {}),
    ...(track !== undefined ? { track } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(syncMode !== undefined ? { syncMode } : {}),
    ...(candidateReason !== undefined ? { candidateReason } : {}),
    ...(nicknameRegex !== undefined ? { nicknameRegex } : {}),
    ...(cohortRegexRules !== undefined ? { cohortRegexRules } : {}),
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

function isCohortRegexRules(value: unknown): value is CohortRegexRule[] {
  return (
    Array.isArray(value) &&
    value.every(
      (rule) => isRecord(rule) && typeof rule['cohort'] === 'number' && typeof rule['nicknameRegex'] === 'string',
    )
  );
}
