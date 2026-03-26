import prisma from '../../db/prisma.js';
import { getWorkspaceOrThrow } from '../workspace/workspace.service.js';

export async function listMembers() {
  const workspace = await getWorkspaceOrThrow();

  return prisma.member.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ cohort: 'desc' }, { nickname: 'asc' }],
    include: {
      _count: { select: { submissions: true } },
      blogPosts: { orderBy: { publishedAt: 'desc' }, take: 1 },
    },
  });
}
