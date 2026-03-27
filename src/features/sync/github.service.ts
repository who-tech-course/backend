import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import type { CohortRule } from '../../shared/types/index.js';

const ThrottledOctokit = Octokit.plugin(throttling);
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
  return new ThrottledOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options, octokit) => {
        octokit.log.warn(`rate limit: ${options.method} ${options.url} — retry after ${retryAfter}s`);
        return true;
      },
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
        octokit.log.warn(`secondary rate limit: ${options.method} ${options.url} — retry after ${retryAfter}s`);
        return true;
      },
    },
  }) as unknown as Octokit;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function fetchRepoPRs(
  octokit: Octokit,
  org: string,
  repo: string,
  options: { perPage?: number; since?: Date; maxPages?: number } = {},
): Promise<Awaited<ReturnType<typeof octokit.pulls.list>>['data']> {
  const { perPage = 100, since, maxPages } = options;
  const allPRs = [];
  let page = 1;

  while (true) {
    let data: Awaited<ReturnType<typeof octokit.pulls.list>>['data'];
    try {
      ({ data } = await octokit.pulls.list({
        owner: org,
        repo,
        state: 'all',
        sort: 'created',
        direction: 'desc',
        per_page: perPage,
        page,
      }));
    } catch (error) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error ? ` status=${String(error.status)}` : '';
      throw new Error(`fetch_prs failed: ${org}/${repo} page=${page}${status} ${errorMessage(error)}`);
    }

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
    if (maxPages && page >= maxPages) break;
    page++;
  }

  return allPRs;
}

export async function fetchUserProfile(
  octokit: Octokit,
  username: string,
): Promise<{ blog: string | null; avatarUrl: string | null }> {
  const { data } = await octokit.users.getByUsername({ username });
  return {
    blog: normalizeBlogUrl(data.blog),
    avatarUrl: data.avatar_url ?? null,
  };
}

export async function fetchUserBlogUrl(octokit: Octokit, username: string): Promise<string | null> {
  const { blog } = await fetchUserProfile(octokit, username);
  return blog;
}
