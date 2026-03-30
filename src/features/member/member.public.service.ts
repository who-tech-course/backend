import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { CohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import { resolveDisplayNickname } from '../../shared/nickname.js';

export function createMemberPublicService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
  cohortRepoRepo: CohortRepoRepository;
  workspaceService: WorkspaceService;
}) {
  const { memberRepo, blogPostRepo, cohortRepoRepo, workspaceService } = deps;

  interface ArchiveRepo {
    name: string;
    track: string | null;
    tabCategory: string;
    submissions: Array<{ prUrl: string; prNumber: number; title: string; status: string; submittedAt: Date }> | null;
  }

  return {
    searchMembers: async (filters?: { q?: string; cohort?: number; track?: string; role?: string }) => {
      const workspace = await workspaceService.getOrThrow();
      const members = await memberRepo.findWithFilters(workspace.id, filters);
      return members.map((m) => {
        const cohortMap = new Map<number, string[]>();
        for (const mc of m.memberCohorts) {
          if (!cohortMap.has(mc.cohort.number)) cohortMap.set(mc.cohort.number, []);
          cohortMap.get(mc.cohort.number)!.push(mc.role.name);
        }

        const cohorts = [...cohortMap.entries()]
          .map(([cohort, roles]) => ({ cohort, roles }))
          .sort((a, b) => b.cohort - a.cohort);

        const targetCohort = filters?.cohort ? cohorts.find((c) => c.cohort === filters.cohort) : cohorts[0];

        return {
          githubId: m.githubId,
          nickname: resolveDisplayNickname(m.manualNickname, m.nicknameStats, m.nickname),
          avatarUrl: m.avatarUrl,
          cohort: targetCohort?.cohort ?? null,
          roles: targetCohort?.roles ?? ['crew'],
          tracks: [...new Set(m.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null))],
          blog: m.blog,
          lastPostedAt: m.lastPostedAt,
        };
      });
    },

    getMemberDetail: async (githubId: string) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.findByGithubId(githubId, workspace.id);
      if (!member) return null;

      const nickname = resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname);
      const cohortMap = new Map<number, string[]>();
      for (const mc of member.memberCohorts) {
        if (!cohortMap.has(mc.cohort.number)) cohortMap.set(mc.cohort.number, []);
        cohortMap.get(mc.cohort.number)!.push(mc.role.name);
      }

      const cohorts = [...cohortMap.entries()]
        .map(([cohort, roles]) => ({ cohort, roles }))
        .sort((a, b) => b.cohort - a.cohort);

      const submissionsByRepo = new Map<
        number,
        Array<{ prUrl: string; prNumber: number; title: string; status: string; submittedAt: Date }>
      >();
      for (const s of [...member.submissions].reverse()) {
        if (!submissionsByRepo.has(s.missionRepoId)) submissionsByRepo.set(s.missionRepoId, []);
        submissionsByRepo.get(s.missionRepoId)!.push({
          prUrl: s.prUrl,
          prNumber: s.prNumber,
          title: s.title,
          status: s.status,
          submittedAt: s.submittedAt,
        });
      }

      const archive: {
        cohort: number;
        levels: {
          level: number | null;
          repos: ArchiveRepo[];
        }[];
      }[] = [];

      // Build archive only for cohorts with defined repos in CohortRepo
      for (const { cohort } of cohorts) {
        const cohortRepos = await cohortRepoRepo.findByCohort(workspace.id, cohort);
        if (cohortRepos.length === 0) continue;

        const levelMap = new Map<number | null, ArchiveRepo[]>();
        for (const cr of cohortRepos) {
          const level = cr.missionRepo.level;
          if (!levelMap.has(level)) levelMap.set(level, []);
          // Precourse check first (highest priority)
          let tabCategory: string;
          if (cr.missionRepo.name.toLowerCase().includes('precourse')) {
            tabCategory = 'precourse';
          } else if (cr.missionRepo.tabCategory === 'precourse') {
            tabCategory = 'precourse';
          } else {
            tabCategory = cr.missionRepo.tabCategory;
          }
          levelMap.get(level)!.push({
            name: cr.missionRepo.name,
            track: cr.missionRepo.track,
            tabCategory,
            submissions: submissionsByRepo.get(cr.missionRepoId) ?? null,
          });
        }

        const sortedLevels = [...levelMap.keys()].sort((a, b) => {
          if (a === null) return 1;
          if (b === null) return -1;
          return a - b;
        });

        const cohortArchive = {
          cohort,
          levels: sortedLevels.map((level) => ({
            level,
            repos: levelMap.get(level)!,
          })),
        };
        archive.push(cohortArchive);
      }

      return {
        githubId: member.githubId,
        nickname,
        avatarUrl: member.avatarUrl,
        cohorts,
        tracks: [...new Set(member.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null))],
        blog: member.blog,
        lastPostedAt: member.lastPostedAt,
        archive,
        blogPosts: member.blogPosts,
        person: member.person
          ? {
              id: member.person.id,
              displayName: member.person.displayName,
              members: member.person.members.filter((m) => m.githubId !== member.githubId),
            }
          : null,
      };
    },

    getFeed: async (filters?: { cohort?: number; track?: string; days?: number; limit?: number }) => {
      const workspace = await workspaceService.getOrThrow();

      // days를 repository에 전달 (기본값 7)
      const posts = await blogPostRepo.findFeed(workspace.id, {
        ...filters,
        days: filters?.days ?? 30,
      });

      return posts.map((p) => {
        const cohortMap = new Map<number, string[]>();
        for (const mc of p.member.memberCohorts) {
          if (!cohortMap.has(mc.cohort.number)) cohortMap.set(mc.cohort.number, []);
          cohortMap.get(mc.cohort.number)!.push(mc.role.name);
        }

        const cohorts = [...cohortMap.entries()]
          .map(([cohort, roles]) => ({ cohort, roles }))
          .sort((a, b) => b.cohort - a.cohort);

        const targetCohort = filters?.cohort ? cohorts.find((c) => c.cohort === filters.cohort) : cohorts[0];

        return {
          url: p.url,
          title: p.title,
          publishedAt: p.publishedAt,
          member: {
            githubId: p.member.githubId,
            nickname: resolveDisplayNickname(p.member.manualNickname, p.member.nicknameStats, p.member.nickname),
            avatarUrl: p.member.avatarUrl,
            cohort: targetCohort?.cohort ?? null,
            roles: targetCohort?.roles ?? ['crew'],
            tracks: [...new Set(p.member.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null))],
          },
        };
      });
    },
  };
}

export type MemberPublicService = ReturnType<typeof createMemberPublicService>;
