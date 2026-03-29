import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const repos = await prisma.missionRepo.findMany();
  console.log(repos.map((r) => ({ id: r.id, name: r.name, lastSyncAt: r.lastSyncAt })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
