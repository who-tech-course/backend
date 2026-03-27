import { describe, expect, it } from '@jest/globals';
import { mergeNicknameStat, resolveDisplayNickname } from '../../shared/nickname.js';

describe('nickname stats', () => {
  it('가장 많이 나온 닉네임을 대표값으로 선택한다', () => {
    const once = mergeNicknameStat(null, '빌리(정환희)', new Date('2026-03-01T00:00:00Z'));
    const twice = mergeNicknameStat(JSON.stringify(once), '빌리', new Date('2026-03-02T00:00:00Z'));

    expect(resolveDisplayNickname(null, JSON.stringify(twice), null)).toBe('빌리');
  });

  it('manualNickname이 있으면 우선한다', () => {
    expect(resolveDisplayNickname('코치 빌리', null, '빌리')).toBe('코치 빌리');
  });
});
