/**
 * 구조 기반 닉네임 정규식 감지.
 * 샘플 PR 타이틀에서 닉네임이 어떤 패턴으로 구분되는지 판단한다.
 *
 * 우선순위:
 * 1. ]  포함 → ^\[?(.+?)\]   (우아한테크코스 표준 포맷)
 * 2. ── / — / - 구분자 포함 → ^(.+?) - ...
 * 3. : 포함 → ^(.+?):
 * 4. fallback → ^(\S+)
 */
export function detectRegexFromTitles(titles: string[]): string | null {
  if (titles.length === 0) return null;

  const hasBracketClose = titles.every((t) => t.includes(']'));
  if (hasBracketClose) {
    return '^\\[?(.+?)\\]';
  }

  const dashSeparators = [' - ', ' – ', ' — '];
  for (const sep of dashSeparators) {
    if (titles.every((t) => t.includes(sep))) {
      return `^(.+?)${sep.replace(/ /g, '\\s*')}`;
    }
  }

  if (titles.every((t) => t.includes(':'))) {
    return '^(.+?):';
  }

  return '^(\\S+)';
}
