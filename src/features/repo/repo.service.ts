import type { Octokit } from '@octokit/rest';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { SyncService } from '../sync/sync.service.js';
import {
  parseCohortRegexRules,
  parseCohorts,
  stringifyCohortRegexRules,
  findNicknameRegexByCohort,
} from '../../shared/cohort-regex.js';
import type { CohortRegexRule, CohortRule } from '../../shared/types/index.js';
import { discoverMissionRepos, fetchOrgRepos } from './repo-discovery.service.js';
import { fetchRepoPRs, detectCohort } from '../sync/github.service.js';
import { detectRegexFromTitles } from '../../shared/regex-detector.js';

function groupTitlesByCohort(
  prs: { title: string; created_at: string }[],
  cohortRules: CohortRule[],
): Map<number | null, string[]> {
  const map = new Map<number | null, string[]>();
  for (const pr of prs) {
    const cohort = detectCohort(new Date(pr.created_at), cohortRules);
    const titles = map.get(cohort) ?? [];
    titles.push(pr.title);
    map.set(cohort, titles);
  }
  return map;
}

function computeRegexSuggestion(
  cohortMap: Map<number | null, string[]>,
  titlesPerCohort: number,
): { nicknameRegex: string | null; cohortRegexRules: CohortRegexRule[] } {
  const perCohort = [...cohortMap.entries()].map(([cohort, titles]) => ({
    cohort,
    detectedRegex: detectRegexFromTitles(titles.slice(0, titlesPerCohort)),
  }));
  const regexValues = perCohort.map((c) => c.detectedRegex).filter((r): r is string => r !== null);
  const allSame = regexValues.length > 0 && regexValues.every((r) => r === regexValues[0]);

  if (allSame) {
    return { nicknameRegex: regexValues[0]!, cohortRegexRules: [] };
  }
  return {
    nicknameRegex: null,
    cohortRegexRules: perCohort
      .filter((c): c is { cohort: number; detectedRegex: string } => c.cohort !== null && c.detectedRegex !== null)
      .map((c) => ({ cohort: c.cohort, nicknameRegex: c.detectedRegex })),
  };
}

export function createRepoService(deps: {
  missionRepoRepo: MissionRepoRepository;
  workspaceService: WorkspaceService;
  syncService: SyncService;
  octokit: Octokit;
}) {
  const { missionRepoRepo, workspaceService, syncService, octokit } = deps;

  const toResponse = (repo: Awaited<ReturnType<MissionRepoRepository['findByIdOrThrow']>>) => ({
    ...repo,
    cohortRegexRules: parseCohortRegexRules(repo.cohortRegexRules),
    cohorts: parseCohorts(repo.cohorts),
  });

  return {
    listRepos: async (status?: string) => {
      const workspace = await workspaceService.getOrThrow();
      const repos = await missionRepoRepo.findMany({ workspaceId: workspace.id, ...(status ? { status } : {}) }, [
        { name: 'asc' },
      ]);
      return repos.map(toResponse);
    },

    createRepo: async (input: {
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
    }) => {
      const workspace = await workspaceService.getOrThrow();
      const repo = await missionRepoRepo.create({
        githubRepoId: input.githubRepoId ?? null,
        name: input.name,
        repoUrl: input.repoUrl,
        description: input.description ?? null,
        track: input.track,
        type: input.type ?? 'individual',
        tabCategory: input.tabCategory ?? (input.track === null ? 'common' : 'base'),
        status: input.status ?? 'active',
        syncMode: input.syncMode ?? 'continuous',
        candidateReason: input.candidateReason ?? null,
        nicknameRegex: input.nicknameRegex ?? null,
        cohortRegexRules: stringifyCohortRegexRules(input.cohortRegexRules),
        ...(input.cohorts?.length ? { cohorts: JSON.stringify(input.cohorts) } : {}),
        ...(input.level !== undefined ? { level: input.level } : {}),
        workspaceId: workspace.id,
      });
      return toResponse(repo);
    },

    updateRepoMatchingRules: async (
      id: number,
      input: {
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
      },
    ) => {
      const repo = await missionRepoRepo.update(id, {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.track !== undefined ? { track: input.track } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.tabCategory !== undefined ? { tabCategory: input.tabCategory } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.syncMode !== undefined ? { syncMode: input.syncMode } : {}),
        ...(input.candidateReason !== undefined ? { candidateReason: input.candidateReason } : {}),
        ...(input.nicknameRegex !== undefined ? { nicknameRegex: input.nicknameRegex } : {}),
        ...(input.cohortRegexRules !== undefined
          ? { cohortRegexRules: stringifyCohortRegexRules(input.cohortRegexRules) }
          : {}),
        ...(input.cohorts !== undefined
          ? { cohorts: input.cohorts === null ? null : JSON.stringify(input.cohorts) }
          : {}),
        ...(input.level !== undefined ? { level: input.level } : {}),
      });
      return toResponse(repo);
    },

    syncRepoById: async (
      id: number,
    ): Promise<{ synced: number; failures: { prNumber: number; prUrl: string; error: string }[] }> => {
      const context = await workspaceService.getSyncContext();
      const repo = await missionRepoRepo.findByIdOrThrow(id);
      return syncService.syncRepo(
        octokit,
        context.id,
        context.githubOrg,
        repo,
        context.workspaceRegex,
        context.cohortRules,
      );
    },

    refreshRepoCandidates: async (): Promise<{ discovered: number; created: number; updated: number }> => {
      const workspace = await workspaceService.getOrThrow();
      const orgRepos = await fetchOrgRepos(octokit, workspace.githubOrg);
      const candidates = discoverMissionRepos(orgRepos);
      let created = 0;
      let updated = 0;

      for (const candidate of candidates) {
        const existing = await missionRepoRepo.findFirst({
          workspaceId: workspace.id,
          OR: [{ githubRepoId: candidate.githubRepoId }, { name: candidate.name }],
        });

        if (existing) {
          await missionRepoRepo.update(existing.id, {
            githubRepoId: candidate.githubRepoId,
            repoUrl: candidate.repoUrl,
            description: candidate.description,
            track: existing.track ?? candidate.track,
            type: existing.type || candidate.type,
            tabCategory: existing.tabCategory ?? candidate.tabCategory,
            candidateReason: candidate.candidateReason,
            ...(existing.status === 'active' ? {} : { status: candidate.status }),
          });
          updated += 1;
        } else {
          await missionRepoRepo.create({
            githubRepoId: candidate.githubRepoId,
            name: candidate.name,
            repoUrl: candidate.repoUrl,
            description: candidate.description,
            track: candidate.track,
            type: candidate.type,
            tabCategory: candidate.tabCategory,
            status: candidate.status,
            syncMode: 'once',
            candidateReason: candidate.candidateReason,
            workspaceId: workspace.id,
          });
          created += 1;
        }
      }

      return { discovered: candidates.length, created, updated };
    },

    detectRepoRegex: async (id: number) => {
      const workspace = await workspaceService.getOrThrow();
      const cohortRules = JSON.parse(workspace.cohortRules) as CohortRule[];
      const repo = await missionRepoRepo.findByIdOrThrow(id);
      const prs = await fetchRepoPRs(octokit, workspace.githubOrg, repo.name);

      const cohortMap = groupTitlesByCohort(prs, cohortRules);
      const samples = [...cohortMap.entries()]
        .map(([cohort, titles]) => ({
          cohort,
          titles: titles.slice(0, 3),
          detectedRegex: detectRegexFromTitles(titles.slice(0, 3)),
        }))
        .sort((a, b) => {
          if (a.cohort === null && b.cohort === null) return 0;
          if (a.cohort === null) return 1;
          if (b.cohort === null) return -1;
          return a.cohort - b.cohort;
        });

      return { samples, suggestion: computeRegexSuggestion(cohortMap, 3) };
    },

    validateRepoRegex: async (id: number) => {
      const workspace = await workspaceService.getOrThrow();
      const cohortRules = JSON.parse(workspace.cohortRules) as CohortRule[];
      const workspaceRegex = new RegExp(workspace.nicknameRegex);
      const repo = await missionRepoRepo.findByIdOrThrow(id);
      const prs = await fetchRepoPRs(octokit, workspace.githubOrg, repo.name, { maxPages: 1 });
      const cohortRegexRulesParsed = parseCohortRegexRules(repo.cohortRegexRules);

      const samples = prs.slice(0, 30).map((pr) => {
        const cohort = detectCohort(new Date(pr.created_at), cohortRules);
        const regexByCohort = findNicknameRegexByCohort(cohortRegexRulesParsed, cohort);
        const effectiveRegex = regexByCohort
          ? new RegExp(regexByCohort)
          : repo.nicknameRegex
            ? new RegExp(repo.nicknameRegex)
            : workspaceRegex;
        const match = pr.title.match(effectiveRegex);
        return { title: pr.title, matched: !!match, extracted: match?.[1]?.trim() ?? null, cohort };
      });

      const matchedCount = samples.filter((s) => s.matched).length;
      return {
        id: repo.id,
        name: repo.name,
        total: samples.length,
        matched: matchedCount,
        unmatched: samples.length - matchedCount,
        nicknameRegex: repo.nicknameRegex,
        cohortRegexRules: parseCohortRegexRules(repo.cohortRegexRules),
        samples,
      };
    },

    detectAndApplyAllRegex: async (): Promise<
      { id: number; name: string; applied: string | null; cohortRegexRules: CohortRegexRule[]; skipped?: boolean }[]
    > => {
      const workspace = await workspaceService.getOrThrow();
      const cohortRules = JSON.parse(workspace.cohortRules) as CohortRule[];
      const repos = await missionRepoRepo.findMany({ workspaceId: workspace.id, status: 'active' });
      const results = [];

      for (const repo of repos) {
        const prs = await fetchRepoPRs(octokit, workspace.githubOrg, repo.name, { maxPages: 1 });
        if (prs.length === 0) {
          results.push({ id: repo.id, name: repo.name, applied: null, cohortRegexRules: [], skipped: true });
          continue;
        }

        const { nicknameRegex, cohortRegexRules } = computeRegexSuggestion(groupTitlesByCohort(prs, cohortRules), 5);

        await missionRepoRepo.update(repo.id, {
          nicknameRegex,
          cohortRegexRules: stringifyCohortRegexRules(cohortRegexRules.length ? cohortRegexRules : null),
        });

        results.push({ id: repo.id, name: repo.name, applied: nicknameRegex, cohortRegexRules });
      }

      return results;
    },

    deleteRepo: (id: number) => missionRepoRepo.deleteWithSubmissions(id),

    deleteAllRepos: async () => {
      const workspace = await workspaceService.getOrThrow();
      return missionRepoRepo.deleteAllWithSubmissions(workspace.id);
    },
  };
}

export type RepoService = ReturnType<typeof createRepoService>;
