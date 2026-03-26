import { describe, it, expect } from '@jest/globals';
import { parsePRsToSubmissions } from '../../services/sync.service.js';

const NICKNAME_REGEX = /\[.+\] (.+) 미션 제출합니다/;
const COHORT_RULES = [
  { year: 2026, cohort: 8 },
  { year: 2025, cohort: 7 },
];

const mockPRs = [
  {
    number: 475,
    html_url: 'https://github.com/woowacourse/javascript-lotto/pull/475',
    title: '[2단계 - 웹 기반 로또 게임] 콘티 미션 제출합니다.',
    user: { login: 'iftype' },
    base: { ref: 'iftype' },
    created_at: '2026-03-16T05:59:39Z',
    state: 'open' as const,
    merged_at: null,
  },
  {
    number: 474,
    html_url: 'https://github.com/woowacourse/javascript-lotto/pull/474',
    title: '[2단계 - 웹 기반 로또 게임] 해니 미션 제출합니다.',
    user: { login: 'janghw0126' },
    base: { ref: 'janghw0126' },
    created_at: '2026-03-16T05:54:06Z',
    state: 'open' as const,
    merged_at: null,
  },
  {
    number: 400,
    html_url: 'https://github.com/woowacourse/javascript-lotto/pull/400',
    title: '형식이 다른 PR입니다.',
    user: { login: 'someone' },
    base: { ref: 'someone' },
    created_at: '2026-01-01T00:00:00Z',
    state: 'open' as const,
    merged_at: null,
  },
];

describe('parsePRsToSubmissions', () => {
  it('PR 목록에서 제출 정보를 파싱한다', () => {
    const result = parsePRsToSubmissions(mockPRs, NICKNAME_REGEX, COHORT_RULES);
    expect(result).toHaveLength(2);
  });

  it('githubId와 nickname을 올바르게 파싱한다', () => {
    const result = parsePRsToSubmissions(mockPRs, NICKNAME_REGEX, COHORT_RULES);
    expect(result[0]?.githubId).toBe('iftype');
    expect(result[0]?.nickname).toBe('콘티');
    expect(result[1]?.githubId).toBe('janghw0126');
    expect(result[1]?.nickname).toBe('해니');
  });

  it('기수를 올바르게 판별한다', () => {
    const result = parsePRsToSubmissions(mockPRs, NICKNAME_REGEX, COHORT_RULES);
    expect(result[0]?.cohort).toBe(8);
  });

  it('닉네임 형식이 맞지 않는 PR은 제외한다', () => {
    const result = parsePRsToSubmissions(mockPRs, NICKNAME_REGEX, COHORT_RULES);
    expect(result.every((r) => r.githubId !== 'someone')).toBe(true);
  });

  it('PR 번호와 URL을 올바르게 저장한다', () => {
    const result = parsePRsToSubmissions(mockPRs, NICKNAME_REGEX, COHORT_RULES);
    expect(result[0]?.prNumber).toBe(475);
    expect(result[0]?.prUrl).toBe('https://github.com/woowacourse/javascript-lotto/pull/475');
  });
});
