import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { SubmissionRepository } from '../../db/repositories/submission.repository.js';
import type { WorkspaceRepository } from '../../db/repositories/workspace.repository.js';
import { findNicknameRegexByCohort, parseCohortRegexRules } from '../../shared/cohort-regex.js';
import { mergeNicknameStat, resolveDisplayNickname } from '../../shared/nickname.js';
import { fetchRepoPRs, fetchUserBlogUrl, parseNickname, detectCohort } from './github.service.js';
import type { CohortRegexRule, CohortRule, ParsedSubmission } from '../../shared/types/index.js';

type RawPR = {
  number: number;
  html_url: string;
  title: string;
  user: { login: string } | null;
  base: { ref: string };
  created_at: string;
};

export function parsePRsToSubmissions(
  prs: RawPR[],
  nicknameRegex: RegExp,
  cohortRules: CohortRule[],
  cohortRegexRules: CohortRegexRule[] = [],
): ParsedSubmission[] {
  const results: ParsedSubmission[] = [];

  for (const pr of prs) {
    if (!pr.user) continue;

    const submittedAt = new Date(pr.created_at);
    const cohort = detectCohort(submittedAt, cohortRules);
    const regexByCohort = findNicknameRegexByCohort(cohortRegexRules, cohort);
    const appliedRegex = regexByCohort ? new RegExp(regexByCohort) : nicknameRegex;
    const nickname = parseNickname(pr.title, appliedRegex);

    if (!nickname) continue;

    results.push({
      githubId: pr.user.login,
      nickname,
      prNumber: pr.number,
      prUrl: pr.html_url,
      title: pr.title,
      submittedAt,
      cohort,
    });
  }

  return results;
}

export function createSyncService(deps: {
  memberRepo: MemberRepository;
  missionRepoRepo: MissionRepoRepository;
  submissionRepo: SubmissionRepository;
  workspaceRepo: WorkspaceRepository;
}) {
  const { memberRepo, missionRepoRepo, submissionRepo, workspaceRepo } = deps;

  const syncRepo = async (
    octokit: Octokit,
    workspaceId: number,
    org: string,
    repo: {
      id: number;
      name: string;
      track?: string | null;
      nicknameRegex?: string | null;
      cohortRegexRules?: string | null;
      lastSyncAt?: Date | null;
    },
    workspaceRegex: RegExp,
    cohortRules: CohortRule[],
  ): Promise<{ synced: number }> => {
    const isCommonMission = repo.track === null || repo.track === undefined;
    const since = repo.lastSyncAt ?? undefined;
    const prs = await fetchRepoPRs(octokit, org, repo.name, ...(since ? [{ since }] : []));
    const fallbackRegex = repo.nicknameRegex ? new RegExp(repo.nicknameRegex) : workspaceRegex;
    const submissions = parsePRsToSubmissions(
      prs,
      fallbackRegex,
      cohortRules,
      parseCohortRegexRules(repo.cohortRegexRules),
    );
    const blogCache = new Map<string, string | null>();
    let synced = 0;

    for (const s of submissions) {
      const existingMember = await memberRepo.findByGithubId(s.githubId, workspaceId);

      // 공통 미션: 이미 알려진 멤버에만 submission 연결
      if (isCommonMission && !existingMember) continue;

      const nicknameStats = mergeNicknameStat(existingMember?.nicknameStats, s.nickname, s.submittedAt);
      const displayNickname = resolveDisplayNickname(
        existingMember?.manualNickname,
        JSON.stringify(nicknameStats),
        existingMember?.nickname ?? null,
      );

      let blog = existingMember?.blog ?? null;
      if (!blog) {
        if (!blogCache.has(s.githubId)) {
          blogCache.set(s.githubId, await fetchUserBlogUrl(octokit, s.githubId).catch(() => null));
        }
        blog = blogCache.get(s.githubId) ?? null;
      }

      const member = await memberRepo.upsert({
        where: { githubId_workspaceId: { githubId: s.githubId, workspaceId } },
        create: {
          githubId: s.githubId,
          nickname: displayNickname,
          cohort: s.cohort,
          blog,
          nicknameStats: JSON.stringify(nicknameStats),
          workspaceId,
        },
        update: {
          nickname: displayNickname,
          cohort: s.cohort,
          ...(existingMember?.blog ? {} : { blog }),
          nicknameStats: JSON.stringify(nicknameStats),
        },
      });

      await submissionRepo.upsert({
        where: { prNumber_missionRepoId: { prNumber: s.prNumber, missionRepoId: repo.id } },
        create: {
          prNumber: s.prNumber,
          prUrl: s.prUrl,
          title: s.title,
          submittedAt: s.submittedAt,
          memberId: member.id,
          missionRepoId: repo.id,
        },
        update: {},
      });

      synced++;
    }

    await missionRepoRepo.touch(repo.id);
    return { synced };
  };

  const syncWorkspace = async (
    octokit: Octokit,
    workspaceId: number,
    onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
    cohort?: number,
  ): Promise<{ totalSynced: number; reposSynced: number }> => {
    const workspace = await workspaceRepo.findByIdOrThrow(workspaceId);
    const cohortRules: CohortRule[] = JSON.parse(workspace.cohortRules);
    const workspaceRegex = new RegExp(workspace.nicknameRegex);

    const repos = await missionRepoRepo.findMany({ workspaceId });
    // 전체 sync는 한번만 돌릴 레포 중 아직 sync되지 않은 것만 실행
    const activeRepos = repos.filter((r) => {
      if (r.status !== 'active' || r.syncMode !== 'once' || r.lastSyncAt !== null) return false;
      if (cohort != null) {
        try {
          const repoCohorts: number[] = r.cohorts ? JSON.parse(r.cohorts) : [];
          if (!repoCohorts.includes(cohort)) return false;
        } catch {
          return false;
        }
      }
      return true;
    });

    let totalSynced = 0;
    for (let i = 0; i < activeRepos.length; i++) {
      const repo = activeRepos[i]!;
      const { synced } = await syncRepo(octokit, workspaceId, workspace.githubOrg, repo, workspaceRegex, cohortRules);
      totalSynced += synced;
      onProgress?.({ repo: repo.name, done: i + 1, total: activeRepos.length, synced });
    }

    await workspaceRepo.touch(workspaceId);
    return { totalSynced, reposSynced: activeRepos.length };
  };

  return { syncRepo, syncWorkspace };
}

export type SyncService = ReturnType<typeof createSyncService>;
