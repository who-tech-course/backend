import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import prisma from '../../db/prisma.js';

async function runSeed() {
  const existing = await prisma.workspace.findUnique({ where: { name: 'woowacourse' } });
  if (existing) return existing;

  return prisma.workspace.create({
    data: {
      name: 'woowacourse',
      githubOrg: 'woowacourse',
      nicknameRegex: '\\[.+\\] (.+) 미션 제출합니다',
      cohortRules: JSON.stringify([
        { year: 2025, cohort: 7 },
        { year: 2026, cohort: 8 },
      ]),
    },
  });
}

beforeEach(async () => {
  await prisma.workspace.deleteMany();
});

afterAll(async () => {
  await prisma.workspace.deleteMany();
  await prisma.$disconnect();
});

describe('seed', () => {
  it('workspace가 없으면 생성한다', async () => {
    await runSeed();
    const workspace = await prisma.workspace.findUnique({ where: { name: 'woowacourse' } });
    expect(workspace).not.toBeNull();
    expect(workspace?.githubOrg).toBe('woowacourse');
  });

  it('이미 있으면 중복 생성하지 않는다', async () => {
    await runSeed();
    await runSeed();
    const count = await prisma.workspace.count();
    expect(count).toBe(1);
  });

  it('cohortRules가 올바른 JSON 형식이다', async () => {
    const workspace = await runSeed();
    const rules = JSON.parse(workspace.cohortRules);
    expect(Array.isArray(rules)).toBe(true);
    expect(rules[0]).toHaveProperty('year');
    expect(rules[0]).toHaveProperty('cohort');
  });

  it('workspace name이 woowacourse이다', async () => {
    const workspace = await runSeed();
    expect(workspace.name).toBe('woowacourse');
  });

  it('workspace githubOrg이 woowacourse이다', async () => {
    const workspace = await runSeed();
    expect(workspace.githubOrg).toBe('woowacourse');
  });

  it('nicknameRegex가 설정된다', async () => {
    const workspace = await runSeed();
    expect(workspace.nicknameRegex).toBeTruthy();
    expect(workspace.nicknameRegex).toBe('\\[.+\\] (.+) 미션 제출합니다');
  });

  it('cohortRules에 year와 cohort가 숫자 타입이다', async () => {
    const workspace = await runSeed();
    const rules = JSON.parse(workspace.cohortRules);
    for (const rule of rules) {
      expect(typeof rule.year).toBe('number');
      expect(typeof rule.cohort).toBe('number');
    }
  });

  it('seed 이후 DB에 workspace가 정확히 하나 존재한다', async () => {
    await runSeed();
    const count = await prisma.workspace.count();
    expect(count).toBe(1);
  });

  it('기존 workspace가 있을 때 runSeed는 기존 workspace를 반환한다', async () => {
    const first = await runSeed();
    const second = await runSeed();
    expect(second.id).toBe(first.id);
    expect(second.name).toBe(first.name);
  });
});