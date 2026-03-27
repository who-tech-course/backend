import type { Octokit } from '@octokit/rest';

type OrgRepo = {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  archived: boolean;
  private: boolean;
};

export type DiscoveredRepo = {
  githubRepoId: number;
  name: string;
  repoUrl: string;
  description: string | null;
  track: string | null;
  type: string;
  tabCategory: 'base' | 'common' | 'excluded' | 'precourse';
  status: 'candidate' | 'excluded';
  candidateReason: string;
};

const INCLUDE_PREFIXES = [
  'javascript-',
  'react-',
  'java-',
  'spring-',
  'android-',
  'kotlin-',
  'compose-',
  'jwp-',
  'ts-',
];

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
        language: repo.language ?? null,
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

export function discoverMissionRepos(repos: OrgRepo[]): DiscoveredRepo[] {
  return repos
    .filter((repo) => !repo.archived && !repo.private)
    .map(classifyMissionRepo)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function classifyMissionRepo(repo: OrgRepo): DiscoveredRepo {
  const lowerName = repo.name.toLowerCase();
  const lowerDescription = repo.description?.toLowerCase() ?? '';

  if (EXCLUDE_KEYWORDS.some((keyword) => lowerName.includes(keyword) || lowerDescription.includes(keyword))) {
    return {
      githubRepoId: repo.id,
      name: repo.name,
      repoUrl: repo.html_url,
      description: repo.description,
      track: inferTrack(lowerName, repo.language),
      type: inferType(lowerName),
      tabCategory: 'excluded',
      status: 'excluded',
      candidateReason: 'exclude keyword',
    };
  }

  const matchedPrefixes = INCLUDE_PREFIXES.filter((prefix) => lowerName.startsWith(prefix));
  const matchedKeywords = INCLUDE_KEYWORDS.filter(
    (keyword) => lowerName.includes(keyword) || lowerDescription.includes(keyword),
  );

  if (matchedPrefixes.length === 0 && matchedKeywords.length === 0) {
    return {
      githubRepoId: repo.id,
      name: repo.name,
      repoUrl: repo.html_url,
      description: repo.description,
      track: inferTrack(lowerName, repo.language),
      type: inferType(lowerName),
      tabCategory: lowerName.includes('precourse') ? 'precourse' : 'excluded',
      status: 'excluded',
      candidateReason: lowerName.includes('precourse') ? 'precourse keyword' : 'no mission signal',
    };
  }

  const track = inferTrack(lowerName, repo.language);
  const tabCategory = lowerName.includes('precourse') ? 'precourse' : track === null ? 'common' : 'base';

  return {
    githubRepoId: repo.id,
    name: repo.name,
    repoUrl: repo.html_url,
    description: repo.description,
    track,
    type: inferType(lowerName),
    tabCategory,
    status: 'candidate',
    candidateReason: [...matchedPrefixes, ...matchedKeywords].join(', '),
  };
}

function inferTrack(name: string, language: string | null): string | null {
  if (name.startsWith('javascript-') || name.startsWith('react-') || name.startsWith('ts-')) {
    return 'frontend';
  }

  if (name.startsWith('java-') || name.startsWith('spring-') || name.startsWith('jwp-')) {
    return 'backend';
  }

  if (name.startsWith('android-') || name.startsWith('kotlin-')) {
    return 'android';
  }

  // prefix 없으면 language로 보조 판단
  if (language === 'Kotlin') return 'android';
  if (language === 'Java') return 'backend';

  return null;
}

function inferType(name: string): string {
  if (name.includes('mission') || name.includes('canvas')) {
    return 'integration';
  }

  return 'individual';
}
