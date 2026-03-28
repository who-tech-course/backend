export function parsePreviousGithubIds(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function mergePreviousGithubIds(
  raw: string | null | undefined,
  currentGithubId: string | null | undefined,
  nextGithubId: string,
): string | null {
  const merged = new Set(parsePreviousGithubIds(raw));
  if (currentGithubId && currentGithubId !== nextGithubId) {
    merged.add(currentGithubId);
  }
  merged.delete(nextGithubId);
  return merged.size > 0 ? JSON.stringify([...merged]) : null;
}

export function shouldRefreshProfile(profileFetchedAt: Date | null | undefined, staleHours = 24): boolean {
  if (!profileFetchedAt) return true;
  return Date.now() - profileFetchedAt.getTime() >= staleHours * 60 * 60 * 1000;
}
