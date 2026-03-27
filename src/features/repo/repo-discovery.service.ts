import type { Octokit } from '@octokit/rest';

type OrgRepo = {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  archived: boolean;
  private: boolean;
};

export type DiscoveredMissionRepo = {
  githubRepoId: number;
  name: string;
  repoUrl: string;
  description: string | null;
  track: string | null;
  type: string;
  candidateReason: string;
};

const INCLUDE_PREFIXES = ['javascript-', 'react-', 'java-', 'spring-', 'android-', 'kotlin-', 'jwp-', 'ts-'];

const INCLUDE_KEYWORDS = ['basecamp', 'airline', 'roomescape', 'shopping', 'learning', 'mission', 'rendering'];
const EXCLUDE_KEYWORDS = [
  'docs',
  'doc',
  'roadmap',
  'service',
  'apply',
  'profile',
  'prolog',
  'tecoble',
  'wiki',
  'precourse',
];

export async function fetchOrgRepos(octokit: Octokit, org: string, perPage = 100): Promise<OrgRepo[]> {
  const allRepos: OrgRepo[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.repos.listForOrg({
      org,
      type: 'public',
      per_page: perPage,
      page,
    });

    allRepos.push(
      ...data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        html_url: repo.html_url,
        description: repo.description,
        archived: repo.archived ?? false,
        private: repo.private,
      })),
    );

    if (data.length < perPage) {
      break;
    }

    page += 1;
  }

  return allRepos;
}

export function discoverMissionRepos(repos: OrgRepo[]): DiscoveredMissionRepo[] {
  return repos
    .filter((repo) => !repo.archived && !repo.private)
    .map(classifyMissionRepo)
    .filter((repo): repo is DiscoveredMissionRepo => repo !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function classifyMissionRepo(repo: OrgRepo): DiscoveredMissionRepo | null {
  const lowerName = repo.name.toLowerCase();
  const lowerDescription = repo.description?.toLowerCase() ?? '';

  if (EXCLUDE_KEYWORDS.some((keyword) => lowerName.includes(keyword) || lowerDescription.includes(keyword))) {
    return null;
  }

  const matchedPrefixes = INCLUDE_PREFIXES.filter((prefix) => lowerName.startsWith(prefix));
  const matchedKeywords = INCLUDE_KEYWORDS.filter(
    (keyword) => lowerName.includes(keyword) || lowerDescription.includes(keyword),
  );

  if (matchedPrefixes.length === 0 && matchedKeywords.length === 0) {
    return null;
  }

  return {
    githubRepoId: repo.id,
    name: repo.name,
    repoUrl: repo.html_url,
    description: repo.description,
    track: inferTrack(lowerName),
    type: inferType(lowerName),
    candidateReason: [...matchedPrefixes, ...matchedKeywords].join(', '),
  };
}

function inferTrack(name: string): string | null {
  if (name.startsWith('javascript-') || name.startsWith('react-') || name.startsWith('ts-')) {
    return 'frontend';
  }

  if (name.startsWith('java-') || name.startsWith('spring-') || name.startsWith('jwp-')) {
    return 'backend';
  }

  if (name.startsWith('android-') || name.startsWith('kotlin-')) {
    return 'android';
  }

  // 공통/협업 미션 (언어 prefix 없음) — track 미지정
  return null;
}

function inferType(name: string): string {
  if (name.includes('mission') || name.includes('canvas')) {
    return 'integration';
  }

  return 'individual';
}
