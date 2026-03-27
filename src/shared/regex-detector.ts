function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function commonPrefix(strs: string[]): string {
  if (strs.length === 0) return '';
  let prefix = strs[0]!;
  for (let i = 1; i < strs.length; i++) {
    const s = strs[i]!;
    let j = 0;
    while (j < prefix.length && j < s.length && prefix[j] === s[j]) {
      j++;
    }
    prefix = prefix.slice(0, j);
  }
  return prefix;
}

function commonSuffix(strs: string[]): string {
  if (strs.length === 0) return '';
  const reversed = strs.map((s) => s.split('').reverse().join(''));
  const revPrefix = commonPrefix(reversed);
  return revPrefix.split('').reverse().join('');
}

function longestCommonSubstring(strs: string[]): string {
  if (strs.length === 0) return '';
  const base = strs[0]!;

  let best = '';
  for (let start = 0; start < base.length; start++) {
    for (let end = start + 2; end <= base.length; end++) {
      const candidate = base.slice(start, end);
      if (strs.every((s) => s.includes(candidate))) {
        if (candidate.length > best.length) {
          best = candidate;
        }
      }
    }
  }
  return best;
}

export function detectRegexFromTitles(titles: string[]): string | null {
  if (titles.length === 0) return null;

  const prefix = commonPrefix(titles);
  const suffix = commonSuffix(titles);

  // Make sure prefix and suffix don't overlap
  const maxMiddleLen = titles[0]!.length - prefix.length - suffix.length;
  if (maxMiddleLen < 0) return null;

  const middles = titles.map((t) => {
    const inner = t.slice(prefix.length);
    return suffix.length > 0 ? inner.slice(0, inner.length - suffix.length) : inner;
  });

  if (middles.every((m) => m.length === 0)) return null;

  const separator = longestCommonSubstring(middles);

  if (separator.length >= 2) {
    return `${escapeRegex(prefix)}(.+?)${escapeRegex(separator)}.+${escapeRegex(suffix)}`;
  }

  return `${escapeRegex(prefix)}(.+)${escapeRegex(suffix)}`;
}
