import type { Octokit } from '@octokit/rest';
import prisma from '../db/prisma.js';
import { fetchOrgRepos, fetchRepoPRs, isMissionRepo, parseNickname, detectCohort } from './github.service.js';
import type { CohortRule, ParsedSubmission } from '../types/index.js';

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
): ParsedSubmission[] {
  const results: ParsedSubmission[] = [];

  for (const pr of prs) {
    if (!pr.user) continue;

    const nickname = parseNickname(pr.title, nicknameRegex);
    if (!nickname) continue;

    const submittedAt = new Date(pr.created_at);
    const cohort = detectCohort(submittedAt, cohortRules);

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
  repoName: string,
  repoUrl: string,
  nicknameRegex: RegExp,
  cohortRules: CohortRule[],
): Promise<{ synced: number }> {
  const prs = await fetchRepoPRs(octokit, org, repoName);
  const submissions = parsePRsToSubmissions(prs, nicknameRegex, cohortRules);

  const missionRepo = await prisma.missionRepo.upsert({
    where: { name_workspaceId: { name: repoName, workspaceId } },
    create: { name: repoName, repoUrl, workspaceId },
    update: {},
  });

  let synced = 0;

  for (const s of submissions) {
    const member = await prisma.member.upsert({
      where: { githubId_workspaceId: { githubId: s.githubId, workspaceId } },
      create: { githubId: s.githubId, nickname: s.nickname, cohort: s.cohort, workspaceId },
      update: { nickname: s.nickname, cohort: s.cohort },
    });

    await prisma.submission.upsert({
      where: { prNumber_missionRepoId: { prNumber: s.prNumber, missionRepoId: missionRepo.id } },
      create: {
        prNumber: s.prNumber,
        prUrl: s.prUrl,
        title: s.title,
        submittedAt: s.submittedAt,
        memberId: member.id,
        missionRepoId: missionRepo.id,
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
  const nicknameRegex = new RegExp(workspace.nicknameRegex);

  const repos = await fetchOrgRepos(octokit, workspace.githubOrg);

  let totalSynced = 0;
  let reposSynced = 0;

  for (const repo of repos) {
    const prs = await fetchRepoPRs(octokit, workspace.githubOrg, repo.name, 10);
    if (!isMissionRepo(prs.map((pr) => ({ base: { ref: pr.base.ref }, user: { login: pr.user?.login ?? '' } })))) {
      continue;
    }

    const { synced } = await syncRepo(
      octokit,
      workspaceId,
      workspace.githubOrg,
      repo.name,
      repo.html_url,
      nicknameRegex,
      cohortRules,
    );

    totalSynced += synced;
    reposSynced++;
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {},
  });

  return { totalSynced, reposSynced };
}
