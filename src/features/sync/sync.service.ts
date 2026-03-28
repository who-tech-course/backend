import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { SubmissionRepository } from '../../db/repositories/submission.repository.js';
import type { WorkspaceRepository } from '../../db/repositories/workspace.repository.js';
import { findNicknameRegexByCohort, parseCohortRegexRules, parseCohorts } from '../../shared/cohort-regex.js';
import { mergePreviousGithubIds, shouldRefreshProfile } from '../../shared/github-profile.js';
import { HttpError } from '../../shared/http.js';
import { mergeNicknameStat, resolveDisplayNickname } from '../../shared/nickname.js';
import { fetchRepoPRs, fetchUserProfile, parseNickname, detectCohort } from './github.service.js';
import type { CohortRegexRule, CohortRule, ParsedSubmission } from '../../shared/types/index.js';

type RawPR = {
  number: number;
  html_url: string;
  title: string;
  user: { login: string; id?: number } | null;
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
      githubUserId: pr.user.id ?? null,
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
    onProgress?: (step: { total: number; processed: number; synced: number; percent: number; phase: string }) => void,
  ): Promise<{ synced: number; failures: { prNumber: number; prUrl: string; error: string }[] }> => {
    const isCommonMission = repo.track === null || repo.track === undefined;
    const since = repo.lastSyncAt ?? undefined;
    let prs: Awaited<ReturnType<typeof fetchRepoPRs>>;
    try {
      prs = await fetchRepoPRs(octokit, org, repo.name, ...(since ? [{ since }] : []));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new HttpError(500, `repo sync fetch failed: ${repo.name} — ${detail}`);
    }
    const fallbackRegex = repo.nicknameRegex ? new RegExp(repo.nicknameRegex) : workspaceRegex;
    const submissions = parsePRsToSubmissions(
      prs,
      fallbackRegex,
      cohortRules,
      parseCohortRegexRules(repo.cohortRegexRules),
    );
    const total = submissions.length;
    const profileCache = new Map<
      string,
      { githubUserId: number | null; githubId: string; blog: string | null; avatarUrl: string | null }
    >();
    let synced = 0;
    let processed = 0;
    const failures: { prNumber: number; prUrl: string; error: string }[] = [];

    onProgress?.({ total, processed, synced, percent: total === 0 ? 100 : 0, phase: 'PR 파싱 완료' });

    for (const s of submissions) {
      try {
        const existingMember =
          (s.githubUserId != null ? await memberRepo.findByGithubUserId(s.githubUserId, workspaceId) : null) ??
          (await memberRepo.findByGithubId(s.githubId, workspaceId));

        // 공통 미션: 이미 알려진 멤버에만 submission 연결
        if (isCommonMission && !existingMember) continue;

        const nicknameStats = mergeNicknameStat(existingMember?.nicknameStats, s.nickname, s.submittedAt);
        const displayNickname = resolveDisplayNickname(
          existingMember?.manualNickname,
          JSON.stringify(nicknameStats),
          existingMember?.nickname ?? null,
        );

        let blog = existingMember?.blog ?? null;
        let avatarUrl = existingMember?.avatarUrl ?? null;
        let githubId = s.githubId;
        let githubUserId = s.githubUserId ?? existingMember?.githubUserId ?? null;
        let profileFetchedAt = existingMember?.profileFetchedAt ?? null;
        let profileRefreshError: string | null = existingMember?.profileRefreshError ?? null;

        if (
          !existingMember?.blog ||
          !existingMember?.avatarUrl ||
          shouldRefreshProfile(existingMember?.profileFetchedAt)
        ) {
          const cacheKey = githubUserId != null ? `id:${githubUserId}` : `login:${s.githubId}`;
          if (!profileCache.has(cacheKey)) {
            try {
              profileCache.set(cacheKey, await fetchUserProfile(octokit, { githubUserId, username: s.githubId }));
              profileRefreshError = null;
            } catch (error) {
              profileRefreshError = error instanceof Error ? error.message : String(error);
              profileCache.set(cacheKey, {
                githubUserId,
                githubId: s.githubId,
                blog: null,
                avatarUrl: null,
              });
            }
          }
          const profile = profileCache.get(cacheKey) ?? {
            githubUserId,
            githubId: s.githubId,
            blog: null,
            avatarUrl: null,
          };
          githubId = profile.githubId;
          githubUserId = profile.githubUserId ?? githubUserId;
          blog = existingMember?.blog ?? profile.blog;
          avatarUrl = profile.avatarUrl ?? existingMember?.avatarUrl ?? null;
          profileFetchedAt = new Date();
          if (profile.avatarUrl || profile.blog || profile.githubId !== s.githubId) {
            profileRefreshError = null;
          }
        }

        const previousGithubIds = mergePreviousGithubIds(
          existingMember?.previousGithubIds,
          existingMember?.githubId,
          githubId,
        );

        const member = existingMember
          ? await memberRepo.update(existingMember.id, {
              githubId,
              githubUserId,
              previousGithubIds,
              nickname: displayNickname,
              cohort: s.cohort,
              avatarUrl,
              ...(existingMember?.blog ? {} : { blog }),
              nicknameStats: JSON.stringify(nicknameStats),
              profileFetchedAt,
              profileRefreshError,
            })
          : await memberRepo.create({
              githubId,
              githubUserId,
              previousGithubIds,
              nickname: displayNickname,
              cohort: s.cohort,
              avatarUrl,
              blog,
              nicknameStats: JSON.stringify(nicknameStats),
              profileFetchedAt,
              profileRefreshError,
              workspaceId,
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
      } catch (err) {
        failures.push({
          prNumber: s.prNumber,
          prUrl: s.prUrl,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        processed++;
        onProgress?.({
          total,
          processed,
          synced,
          percent: total === 0 ? 100 : Math.round((processed / total) * 100),
          phase: 'PR 처리 중',
        });
      }
    }

    await missionRepoRepo.touch(repo.id);
    onProgress?.({ total, processed, synced, percent: 100, phase: '완료' });
    return { synced, failures };
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
      if (cohort != null && !parseCohorts(r.cohorts).includes(cohort)) return false;
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
