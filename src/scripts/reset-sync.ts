import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const repoName = 'java-blackjack';
  const repo = await prisma.missionRepo.findFirst({
    where: { name: repoName },
  });

  if (!repo) {
    console.log(`Repo with name ${repoName} not found.`);
    return;
  }

  await prisma.missionRepo.update({
    where: { id: repo.id },
    data: { lastSyncAt: null },
  });

  console.log(`Successfully reset lastSyncAt for ${repoName}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
