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
  blogSyncEnabled?: boolean;
} {
  if (!isRecord(body)) {
    badRequest('invalid body');
  }

  const { nicknameRegex, cohortRules, blogSyncEnabled } = body;

  if (nicknameRegex !== undefined && typeof nicknameRegex !== 'string') {
    badRequest('invalid nicknameRegex');
  }

  if (cohortRules !== undefined && !isCohortRules(cohortRules)) {
    badRequest('invalid cohortRules');
  }

  if (blogSyncEnabled !== undefined && typeof blogSyncEnabled !== 'boolean') {
    badRequest('invalid blogSyncEnabled');
  }

  return {
    ...(nicknameRegex !== undefined ? { nicknameRegex } : {}),
    ...(cohortRules !== undefined ? { cohortRules } : {}),
    ...(blogSyncEnabled !== undefined ? { blogSyncEnabled } : {}),
  };
}

export function parseRepoCreateInput(body: unknown): {
  githubRepoId?: number;
  name: string;
  repoUrl: string;
  description?: string | null;
  track: string | null;
  type?: string;
  tabCategory?: string;
  status?: string;
  syncMode?: string;
  candidateReason?: string | null;
  nicknameRegex?: string;
  cohortRegexRules?: CohortRegexRule[];
  cohorts?: number[];
  level?: number | null;
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
    tabCategory,
    status,
    syncMode,
    candidateReason,
    nicknameRegex,
    cohortRegexRules,
    cohorts,
    level,
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

  if (tabCategory !== undefined && typeof tabCategory !== 'string') {
    badRequest('invalid tabCategory');
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

  if (cohorts !== undefined && !isNumberArray(cohorts)) {
    badRequest('invalid cohorts');
  }

  if (level !== undefined && level !== null && typeof level !== 'number') {
    badRequest('invalid level');
  }

  return {
    ...(githubRepoId !== undefined ? { githubRepoId } : {}),
    name,
    repoUrl,
    ...(description !== undefined ? { description } : {}),
    track: track ?? null,
    ...(type !== undefined ? { type } : {}),
    ...(tabCategory !== undefined ? { tabCategory } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(syncMode !== undefined ? { syncMode } : {}),
    ...(candidateReason !== undefined ? { candidateReason } : {}),
    ...(nicknameRegex !== undefined ? { nicknameRegex } : {}),
    ...(cohortRegexRules !== undefined ? { cohortRegexRules } : {}),
    ...(cohorts !== undefined ? { cohorts } : {}),
    ...(level !== undefined ? { level } : {}),
  };
}

export function parseRepoUpdateInput(body: unknown): {
  description?: string | null;
  track?: string | null;
  type?: string;
  tabCategory?: string;
  status?: string;
  syncMode?: string;
  candidateReason?: string | null;
  nicknameRegex?: string | null;
  cohortRegexRules?: CohortRegexRule[] | null;
  cohorts?: number[] | null;
  level?: number | null;
} {
  if (!isRecord(body)) {
    badRequest('invalid body');
  }

  const {
    description,
    track,
    type,
    tabCategory,
    status,
    syncMode,
    candidateReason,
    nicknameRegex,
    cohortRegexRules,
    cohorts,
    level,
  } = body;

  if (description !== undefined && description !== null && typeof description !== 'string') {
    badRequest('invalid description');
  }

  if (track !== undefined && track !== null && typeof track !== 'string') {
    badRequest('invalid track');
  }

  if (type !== undefined && typeof type !== 'string') {
    badRequest('invalid type');
  }

  if (tabCategory !== undefined && typeof tabCategory !== 'string') {
    badRequest('invalid tabCategory');
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

  if (cohorts !== undefined && cohorts !== null && !isNumberArray(cohorts)) {
    badRequest('invalid cohorts');
  }

  if (level !== undefined && level !== null && typeof level !== 'number') {
    badRequest('invalid level');
  }

  return {
    ...(description !== undefined ? { description } : {}),
    ...(track !== undefined ? { track } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(tabCategory !== undefined ? { tabCategory } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(syncMode !== undefined ? { syncMode } : {}),
    ...(candidateReason !== undefined ? { candidateReason } : {}),
    ...(nicknameRegex !== undefined ? { nicknameRegex } : {}),
    ...(cohortRegexRules !== undefined ? { cohortRegexRules } : {}),
    ...(cohorts !== undefined ? { cohorts } : {}),
    ...(level !== undefined ? { level } : {}),
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

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number');
}

function isCohortRegexRules(value: unknown): value is CohortRegexRule[] {
  return (
    Array.isArray(value) &&
    value.every(
      (rule) => isRecord(rule) && typeof rule['cohort'] === 'number' && typeof rule['nicknameRegex'] === 'string',
    )
  );
}
