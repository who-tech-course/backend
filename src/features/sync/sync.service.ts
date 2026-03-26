import type { Octokit } from '@octokit/rest';
import prisma from '../../db/prisma.js';
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

export async function syncRepo(
  octokit: Octokit,
  workspaceId: number,
  org: string,
  repo: { id: number; name: string; nicknameRegex?: string | null; cohortRegexRules?: string | null },
  workspaceRegex: RegExp,
  cohortRules: CohortRule[],
): Promise<{ synced: number }> {
  const prs = await fetchRepoPRs(octokit, org, repo.name);
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
    const existingMember = await prisma.member.findUnique({
      where: { githubId_workspaceId: { githubId: s.githubId, workspaceId } },
      select: { id: true, manualNickname: true, nicknameStats: true, blog: true },
    });

    const nicknameStats = mergeNicknameStat(existingMember?.nicknameStats, s.nickname, s.submittedAt);
    const displayNickname = resolveDisplayNickname(
      existingMember?.manualNickname,
      JSON.stringify(nicknameStats),
      s.nickname,
    );
    let blog = existingMember?.blog ?? null;

    if (!blog) {
      if (!blogCache.has(s.githubId)) {
        blogCache.set(s.githubId, await fetchUserBlogUrl(octokit, s.githubId).catch(() => null));
      }

      blog = blogCache.get(s.githubId) ?? null;
    }

    const member = await prisma.member.upsert({
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

    await prisma.submission.upsert({
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

  return { synced };
}

export async function syncWorkspace(
  octokit: Octokit,
  workspaceId: number,
): Promise<{ totalSynced: number; reposSynced: number }> {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const cohortRules: CohortRule[] = JSON.parse(workspace.cohortRules);
  const workspaceRegex = new RegExp(workspace.nicknameRegex);

  const repos = await prisma.missionRepo.findMany({ where: { workspaceId } });
  const activeRepos = repos.filter((repo) => repo.status === 'active');

  let totalSynced = 0;

  for (const repo of activeRepos) {
    const { synced } = await syncRepo(octokit, workspaceId, workspace.githubOrg, repo, workspaceRegex, cohortRules);
    totalSynced += synced;
  }

  await prisma.workspace.update({ where: { id: workspaceId }, data: {} });

  return { totalSynced, reposSynced: activeRepos.length };
}
