import { Octokit } from '@octokit/rest';
import type { CohortRule } from '../../shared/types/index.js';
import { normalizeBlogUrl } from '../../shared/blog.js';
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
  options: { perPage?: number; since?: Date } = {},
): Promise<Awaited<ReturnType<typeof octokit.pulls.list>>['data']> {
  const { perPage = 100, since } = options;
  const allPRs = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.list({
      owner: org,
      repo,
      state: 'all',
      sort: 'created',
      direction: 'desc',
      per_page: perPage,
      page,
    });

    if (data.length === 0) break;

    if (since) {
      const fresh = data.filter((pr) => new Date(pr.created_at) > since);
      allPRs.push(...fresh);
      // 페이지 내 마지막 PR이 since보다 오래됐으면 더 이상 없음
      if (fresh.length < data.length) break;
    } else {
      allPRs.push(...data);
    }

    if (data.length < perPage) break;
    page++;
  }

  return allPRs;
}

export async function fetchUserBlogUrl(octokit: Octokit, username: string): Promise<string | null> {
  const { data } = await octokit.users.getByUsername({ username });
  return normalizeBlogUrl(data.blog);
}
