import prisma from './prisma.js';

async function seed() {
  const existing = await prisma.workspace.findUnique({ where: { name: 'woowacourse' } });

  if (existing) {
    console.log('workspace already exists, skipping seed');
    return;
  }

  await prisma.workspace.create({
    data: {
      name: 'woowacourse',
      githubOrg: 'woowacourse',
      nicknameRegex: '\\[.+\\] (.+) 미션 제출합니다',
      cohortRules: JSON.stringify([
        { year: 2019, cohort: 1 },
        { year: 2020, cohort: 2 },
        { year: 2021, cohort: 3 },
        { year: 2022, cohort: 4 },
        { year: 2023, cohort: 5 },
        { year: 2024, cohort: 6 },
        { year: 2025, cohort: 7 },
        { year: 2026, cohort: 8 },
      ]),
    },
  });

  console.log('workspace seeded without mission repos; use admin discovery to import candidates');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
