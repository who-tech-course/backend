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
});
