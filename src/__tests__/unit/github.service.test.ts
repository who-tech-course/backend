import { describe, it, expect, jest } from '@jest/globals';
import { parseNickname, detectCohort, isMissionRepo, createOctokit } from '../../services/github.service.js';

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

  it('형식이 맞지 않으면 null을 반환한다', () => {
    expect(parseNickname('형식이 다른 제목입니다.', /\[.+\] (.+) 미션 제출합니다/)).toBeNull();
  });

  it('빈 문자열은 null을 반환한다', () => {
    expect(parseNickname('', /\[.+\] (.+) 미션 제출합니다/)).toBeNull();
  });

  it('닉네임 앞뒤 공백을 trim한다', () => {
    expect(parseNickname('[1단계] 루멘  미션 제출합니다', /\[.+\] (.+) 미션 제출합니다/)).toBe('루멘');
  });

  it('커스텀 regex를 사용할 수 있다', () => {
    expect(parseNickname('feat: 콘티 제출', /feat: (.+) 제출/)).toBe('콘티');
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

  it('2024년 제출은 6기로 판별한다', () => {
    expect(detectCohort(new Date('2024-12-31'), cohortRules)).toBe(6);
  });

  it('cohortRules가 빈 배열이면 null을 반환한다', () => {
    expect(detectCohort(new Date('2026-01-01'), [])).toBeNull();
  });

  it('연도의 첫날도 올바르게 판별한다', () => {
    expect(detectCohort(new Date('2026-01-01'), cohortRules)).toBe(8);
  });

  it('연도의 마지막 날도 올바르게 판별한다', () => {
    expect(detectCohort(new Date('2026-12-31'), cohortRules)).toBe(8);
  });
});

describe('isMissionRepo', () => {
  it('base branch가 username인 PR이 있으면 true를 반환한다', () => {
    const prs = [{ base: { ref: 'bigcloud07' }, user: { login: 'bigcloud07' } }];
    expect(isMissionRepo(prs)).toBe(true);
  });

  it('base branch가 main/develop이면 false를 반환한다', () => {
    const prs = [
      { base: { ref: 'main' }, user: { login: 'someuser' } },
      { base: { ref: 'develop' }, user: { login: 'anotheruser' } },
    ];
    expect(isMissionRepo(prs)).toBe(false);
  });

  it('PR이 없으면 false를 반환한다', () => {
    expect(isMissionRepo([])).toBe(false);
  });

  it('base branch가 master이면 false를 반환한다', () => {
    const prs = [{ base: { ref: 'master' }, user: { login: 'someuser' } }];
    expect(isMissionRepo(prs)).toBe(false);
  });

  it('base branch가 step1이면 false를 반환한다', () => {
    const prs = [{ base: { ref: 'step1' }, user: { login: 'someuser' } }];
    expect(isMissionRepo(prs)).toBe(false);
  });

  it('base branch가 step2이면 false를 반환한다', () => {
    const prs = [{ base: { ref: 'step2' }, user: { login: 'someuser' } }];
    expect(isMissionRepo(prs)).toBe(false);
  });

  it('base branch가 step3이면 false를 반환한다', () => {
    const prs = [{ base: { ref: 'step3' }, user: { login: 'someuser' } }];
    expect(isMissionRepo(prs)).toBe(false);
  });

  it('미션 PR과 일반 PR이 섞여 있으면 true를 반환한다', () => {
    const prs = [
      { base: { ref: 'main' }, user: { login: 'someuser' } },
      { base: { ref: 'missionuser' }, user: { login: 'missionuser' } },
    ];
    expect(isMissionRepo(prs)).toBe(true);
  });

  it('base branch와 username이 대소문자 무시하고 일치하면 true를 반환한다', () => {
    const prs = [{ base: { ref: 'MyUser' }, user: { login: 'myuser' } }];
    expect(isMissionRepo(prs)).toBe(true);
  });

  it('base branch가 username과 다르면 false를 반환한다', () => {
    const prs = [{ base: { ref: 'some-branch' }, user: { login: 'differentuser' } }];
    expect(isMissionRepo(prs)).toBe(false);
  });
});

describe('createOctokit', () => {
  it('토큰 없이 Octokit 인스턴스를 생성한다', () => {
    const octokit = createOctokit();
    expect(octokit).toBeDefined();
    expect(typeof octokit.pulls.list).toBe('function');
  });

  it('토큰과 함께 Octokit 인스턴스를 생성한다', () => {
    const octokit = createOctokit('fake-token');
    expect(octokit).toBeDefined();
    expect(typeof octokit.repos.listForOrg).toBe('function');
  });
});