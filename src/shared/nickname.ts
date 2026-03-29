import type { NicknameStat } from './types/index.js';

export function normalizeNickname(nickname: string): string {
  let s = nickname
    .replace(/\s*\([^)]*\)\s*$/, '') // 빌리(정환희) → 빌리
    .replace(/^[\[({]+/g, '')
    .replace(/[\])}]+$/g, '') // [버건디] → 버건디
    .trim();

  while (/[!.,，]+$/.test(s)) {
    s = s.replace(/[!.,，]+$/g, '').trim();
  }

  // 한글 닉네임(쉼표·공백 포함)과 영문/숫자/하이픈 닉네임 모두 허용
  s = s.replace(/[^\s\-,0-9A-Za-z가-힣]/g, '');
  return s.trim();
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

export function isValidNickname(nickname: string): boolean {
  if (/\d+\s*단계/.test(nickname)) return false;
  if (nickname.length > 20) return false;
  return true;
}

export function mergeNicknameStat(
  existingValue: string | null | undefined,
  nickname: string,
  submittedAt: Date,
): NicknameStat[] {
  if (!isValidNickname(nickname)) return parseNicknameStats(existingValue);
  const normalizedNickname = normalizeNickname(nickname);
  const stats = parseNicknameStats(existingValue);
  if (stats.some((item) => item.nickname === normalizedNickname)) {
    return sortNicknameStats(
      stats.map((item) =>
        item.nickname === normalizedNickname
          ? { ...item, count: item.count + 1, lastSeenAt: submittedAt.toISOString() }
          : item,
      ),
    );
  }

  return sortNicknameStats([
    ...stats,
    { nickname: normalizedNickname, count: 1, lastSeenAt: submittedAt.toISOString() },
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
