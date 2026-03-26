import prisma from '../../db/prisma.js';
import { resolveDisplayNickname } from '../../shared/nickname.js';
import { getWorkspaceOrThrow } from '../workspace/workspace.service.js';

export async function listMembers(filters?: { q?: string; cohort?: number; hasBlog?: boolean }) {
  const workspace = await getWorkspaceOrThrow();

  const members = await prisma.member.findMany({
    where: {
      workspaceId: workspace.id,
      ...(filters?.cohort ? { cohort: filters.cohort } : {}),
      ...(filters?.hasBlog === true ? { blog: { not: null } } : {}),
      ...(filters?.hasBlog === false ? { blog: null } : {}),
      ...(filters?.q
        ? {
            OR: [
              { githubId: { contains: filters.q } },
              { nickname: { contains: filters.q } },
              { manualNickname: { contains: filters.q } },
            ],
          }
        : {}),
    },
    orderBy: [{ cohort: 'desc' }, { nickname: 'asc' }],
    include: {
      _count: { select: { submissions: true } },
      blogPosts: { orderBy: { publishedAt: 'desc' }, take: 5 },
      submissions: {
        orderBy: { submittedAt: 'desc' },
        include: {
          missionRepo: {
            select: {
              name: true,
              track: true,
            },
          },
        },
      },
    },
  });

  return members.map((member) => ({
    ...member,
    nickname: resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname),
    tracks: [...new Set(member.submissions.map((submission) => submission.missionRepo.track))],
  }));
}

export async function updateMember(
  id: number,
  input: {
    manualNickname?: string | null;
    blog?: string | null;
  },
) {
  const member = await prisma.member.update({
    where: { id },
    data: {
      ...(input.manualNickname !== undefined ? { manualNickname: input.manualNickname } : {}),
      ...(input.blog !== undefined ? { blog: input.blog } : {}),
    },
    include: {
      _count: { select: { submissions: true } },
      blogPosts: { orderBy: { publishedAt: 'desc' }, take: 5 },
      submissions: {
        orderBy: { submittedAt: 'desc' },
        include: {
          missionRepo: {
            select: {
              name: true,
              track: true,
            },
          },
        },
      },
    },
  });

  return {
    ...member,
    nickname: resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname),
    tracks: [...new Set(member.submissions.map((submission) => submission.missionRepo.track))],
  };
}

export async function deleteMember(id: number): Promise<void> {
  await prisma.$transaction([
    prisma.blogPost.deleteMany({ where: { memberId: id } }),
    prisma.submission.deleteMany({ where: { memberId: id } }),
    prisma.member.delete({ where: { id } }),
  ]);
}
