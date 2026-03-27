import { PrismaClient } from '@prisma/client';
import {
  isValidNickname,
  parseNicknameStats,
  resolveDisplayNickname,
  stringifyNicknameStats,
} from '../shared/nickname.js';

const db = new PrismaClient();

async function main() {
  const members = await db.member.findMany();
  let updated = 0;

  for (const member of members) {
    const stats = parseNicknameStats(member.nicknameStats);
    const cleaned = stats.filter((s) => isValidNickname(s.nickname));

    if (cleaned.length === stats.length) continue;

    const newStatsValue = stringifyNicknameStats(cleaned);
    const newNickname = resolveDisplayNickname(member.manualNickname, newStatsValue, null);

    await db.member.update({
      where: { id: member.id },
      data: { nicknameStats: newStatsValue, nickname: newNickname },
    });

    updated++;
  }

  console.log(`완료: ${updated}/${members.length}명 정리됨`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
