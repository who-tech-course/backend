import { Octokit } from '@octokit/rest';
import type { CohortRule } from '../../shared/types/index.js';
import { normalizeNickname } from '../../shared/nickname.js';

export function parseNickname(title: string, regex: RegExp): string | null {
  const rawNickname = title.match(regex)?.[1]?.trim();
  if (!rawNickname) {
    return null;
  }

  return normalizeNickname(rawNickname);
}

export function detectCohort(submittedAt: Date, cohortRules: CohortRule[]): number | null {
  const year = submittedAt.getFullYear();
  return cohortRules.find((rule) => rule.year === year)?.cohort ?? null;
}

export function createOctokit(token?: string): Octokit {
  return new Octokit({ auth: token });
}

export async function fetchRepoPRs(
  octokit: Octokit,
  org: string,
  repo: string,
  perPage = 100,
): Promise<Awaited<ReturnType<typeof octokit.pulls.list>>['data']> {
  const allPRs = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.list({
      owner: org,
      repo,
      state: 'all',
      per_page: perPage,
      page,
    });

    allPRs.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return allPRs;
}

export async function fetchUserBlogUrl(octokit: Octokit, username: string): Promise<string | null> {
  const { data } = await octokit.users.getByUsername({ username });
  return data.blog?.trim() ? data.blog.trim() : null;
}
