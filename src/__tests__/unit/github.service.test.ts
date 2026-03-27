import { describe, it, expect } from '@jest/globals';
import { parseNickname, detectCohort } from '../../features/sync/github.service.js';

describe('parseNickname', () => {
  it('PR 제목에서 닉네임을 추출한다', () => {
    expect(parseNickname('[1단계 - 콘솔 기반 로또 게임] 루멘 미션 제출합니다.', /\[.+\] (.+) 미션 제출합니다/)).toBe(
      '루멘',
    );
  });

  it('여러 단어 닉네임도 추출한다', () => {
    expect(
      parseNickname('[1단계 - 콘솔 기반 로또 게임] 애니, 레스, 콘티 미션 제출합니다.', /\[.+\] (.+) 미션 제출합니다/),
    ).toBe('애니, 레스, 콘티');
  });

  it('닉네임 뒤 괄호 실명 표기는 제거한다', () => {
    expect(
      parseNickname('[1단계 - 콘솔 기반 로또 게임] 빌리(정환희) 미션 제출합니다.', /\[.+\] (.+) 미션 제출합니다/),
    ).toBe('빌리');
  });

  it('형식이 맞지 않으면 null을 반환한다', () => {
    expect(parseNickname('형식이 다른 제목입니다.', /\[.+\] (.+) 미션 제출합니다/)).toBeNull();
  });
});

describe('detectCohort', () => {
  const cohortRules = [
    { year: 2026, cohort: 8 },
    { year: 2025, cohort: 7 },
    { year: 2024, cohort: 6 },
  ];

  it('2026년 제출은 8기로 판별한다', () => {
    expect(detectCohort(new Date('2026-03-16'), cohortRules)).toBe(8);
  });

  it('2025년 제출은 7기로 판별한다', () => {
    expect(detectCohort(new Date('2025-06-01'), cohortRules)).toBe(7);
  });

  it('매핑되지 않는 연도는 null을 반환한다', () => {
    expect(detectCohort(new Date('2018-01-01'), cohortRules)).toBeNull();
  });
});
