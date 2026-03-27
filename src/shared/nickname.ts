type NicknameStat = {
  nickname: string;
  count: number;
  lastSeenAt: string;
};

export function normalizeNickname(nickname: string): string {
  return nickname.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function parseNicknameStats(value: string | null | undefined): NicknameStat[] {
  if (!value) {
    return [];
  }

  return JSON.parse(value) as NicknameStat[];
}

export function stringifyNicknameStats(stats: NicknameStat[]): string | null {
  if (stats.length === 0) {
    return null;
  }

  return JSON.stringify(stats);
}

export function mergeNicknameStat(
  existingValue: string | null | undefined,
  nickname: string,
  submittedAt: Date,
): NicknameStat[] {
  const normalizedNickname = normalizeNickname(nickname);
  const stats = parseNicknameStats(existingValue);
  const existing = stats.find((item) => item.nickname === normalizedNickname);

  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = submittedAt.toISOString();
    return sortNicknameStats(stats);
  }

  return sortNicknameStats([
    ...stats,
    {
      nickname: normalizedNickname,
      count: 1,
      lastSeenAt: submittedAt.toISOString(),
    },
  ]);
}

export function resolveDisplayNickname(
  manualNickname: string | null | undefined,
  nicknameStatsValue: string | null | undefined,
  fallbackNickname: string | null,
): string | null {
  if (manualNickname?.trim()) {
    return manualNickname.trim();
  }

  const stats = parseNicknameStats(nicknameStatsValue);
  if (stats.length > 0) {
    return stats[0]!.nickname;
  }

  return fallbackNickname ? normalizeNickname(fallbackNickname) : null;
}

function sortNicknameStats(stats: NicknameStat[]): NicknameStat[] {
  return [...stats].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  });
}
