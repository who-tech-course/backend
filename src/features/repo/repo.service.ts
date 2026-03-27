import type { Octokit } from '@octokit/rest';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { SyncService } from '../sync/sync.service.js';
import { parseCohortRegexRules, stringifyCohortRegexRules } from '../../shared/cohort-regex.js';
import type { CohortRegexRule, CohortRule } from '../../shared/types/index.js';
import { discoverMissionRepos, fetchOrgRepos } from './repo-discovery.service.js';
import { fetchRepoPRs, detectCohort } from '../sync/github.service.js';
import { detectRegexFromTitles } from '../../shared/regex-detector.js';

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
  });

  return {
    listRepos: async (status?: string) => {
      const workspace = await workspaceService.getOrThrow();
      const repos = await missionRepoRepo.findMany({ workspaceId: workspace.id, ...(status ? { status } : {}) }, [
        { status: 'asc' },
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
      status?: string;
      syncMode?: string;
      candidateReason?: string | null;
      nicknameRegex?: string;
      cohortRegexRules?: CohortRegexRule[];
    }) => {
      const workspace = await workspaceService.getOrThrow();
      const repo = await missionRepoRepo.create({
        githubRepoId: input.githubRepoId ?? null,
        name: input.name,
        repoUrl: input.repoUrl,
        description: input.description ?? null,
        track: input.track,
        type: input.type ?? 'individual',
        status: input.status ?? 'active',
        syncMode: input.syncMode ?? 'continuous',
        candidateReason: input.candidateReason ?? null,
        nicknameRegex: input.nicknameRegex ?? null,
        cohortRegexRules: stringifyCohortRegexRules(input.cohortRegexRules),
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
        status?: string;
        syncMode?: string;
        candidateReason?: string | null;
        nicknameRegex?: string | null;
        cohortRegexRules?: CohortRegexRule[] | null;
      },
    ) => {
      const repo = await missionRepoRepo.update(id, {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.track !== undefined ? { track: input.track } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.syncMode !== undefined ? { syncMode: input.syncMode } : {}),
        ...(input.candidateReason !== undefined ? { candidateReason: input.candidateReason } : {}),
        ...(input.nicknameRegex !== undefined ? { nicknameRegex: input.nicknameRegex } : {}),
        ...(input.cohortRegexRules !== undefined
          ? { cohortRegexRules: stringifyCohortRegexRules(input.cohortRegexRules) }
          : {}),
      });
      return toResponse(repo);
    },

    syncRepoById: async (id: number): Promise<{ synced: number }> => {
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
            candidateReason: candidate.candidateReason,
            ...(existing.status === 'excluded' ? {} : { status: existing.status }),
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
            status: 'candidate',
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

      // Group PR titles by cohort
      const cohortMap = new Map<number | null, string[]>();
      for (const pr of prs) {
        const cohort = detectCohort(new Date(pr.created_at), cohortRules);
        const titles = cohortMap.get(cohort) ?? [];
        titles.push(pr.title);
        cohortMap.set(cohort, titles);
      }

      type SampleEntry = { cohort: number | null; titles: string[]; detectedRegex: string | null };
      const samples: SampleEntry[] = [];

      for (const [cohort, titles] of cohortMap.entries()) {
        const sample = titles.slice(0, 3);
        const detectedRegex = detectRegexFromTitles(sample);
        samples.push({ cohort, titles: sample, detectedRegex });
      }

      // Sort samples: known cohorts ascending, then null cohorts
      samples.sort((a, b) => {
        if (a.cohort === null && b.cohort === null) return 0;
        if (a.cohort === null) return 1;
        if (b.cohort === null) return -1;
        return a.cohort - b.cohort;
      });

      const regexValues = samples.map((s) => s.detectedRegex).filter((r): r is string => r !== null);
      const allSame = regexValues.length > 0 && regexValues.every((r) => r === regexValues[0]);

      let suggestion: {
        nicknameRegex: string | null;
        cohortRegexRules: CohortRegexRule[];
      };

      if (allSame) {
        suggestion = { nicknameRegex: regexValues[0]!, cohortRegexRules: [] };
      } else {
        const cohortRegexRules: CohortRegexRule[] = samples
          .filter(
            (s): s is SampleEntry & { cohort: number; detectedRegex: string } =>
              s.cohort !== null && s.detectedRegex !== null,
          )
          .map((s) => ({ cohort: s.cohort, nicknameRegex: s.detectedRegex }));
        suggestion = { nicknameRegex: null, cohortRegexRules };
      }

      return { samples, suggestion };
    },

    deleteRepo: (id: number) => missionRepoRepo.deleteWithSubmissions(id),
  };
}

export type RepoService = ReturnType<typeof createRepoService>;
