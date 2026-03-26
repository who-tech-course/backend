import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import prisma from '../../db/prisma.js';

const ADMIN_SECRET = 'test-secret';
process.env['ADMIN_SECRET'] = ADMIN_SECRET;

beforeAll(async () => {
  await prisma.workspace.upsert({
    where: { name: 'woowacourse' },
    create: {
      name: 'woowacourse',
      githubOrg: 'woowacourse',
      nicknameRegex: '\\[.+\\] (.+) 미션 제출합니다',
      cohortRules: JSON.stringify([
        { year: 2026, cohort: 8 },
        { year: 2025, cohort: 7 },
      ]),
    },
    update: {},
  });
});

afterAll(async () => {
  await prisma.blogPost.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.member.deleteMany();
  await prisma.missionRepo.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.$disconnect();
});

describe('GET /admin/status', () => {
  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await request(app).get('/admin/status');
    expect(res.status).toBe(401);
  });

  it('올바른 토큰으로 접근하면 상태를 반환한다', async () => {
    const res = await request(app).get('/admin/status').set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('memberCount');
    expect(res.body).toHaveProperty('lastSyncAt');
  });
});

describe('GET /admin/workspace', () => {
  it('워크스페이스 설정을 반환한다', async () => {
    const res = await request(app).get('/admin/workspace').set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nicknameRegex');
    expect(res.body).toHaveProperty('cohortRules');
  });
});

describe('PUT /admin/workspace', () => {
  it('워크스페이스 설정을 수정한다', async () => {
    const res = await request(app)
      .put('/admin/workspace')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({ nicknameRegex: '\\[.+\\] (.+) 미션 제출합니다' });
    expect(res.status).toBe(200);
    expect(res.body.nicknameRegex).toBe('\\[.+\\] (.+) 미션 제출합니다');
  });
});

describe('레포 관리 CRUD', () => {
  let repoId: number;

  beforeEach(async () => {
    const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });
    const repo = await prisma.missionRepo.create({
      data: {
        name: 'javascript-lotto',
        repoUrl: 'https://github.com/woowacourse/javascript-lotto',
        track: 'frontend',
        type: 'individual',
        workspaceId: workspace.id,
      },
    });
    repoId = repo.id;
  });

  afterEach(async () => {
    await prisma.missionRepo.deleteMany({ where: { name: 'javascript-lotto' } });
  });

  it('POST /admin/repos: 레포를 추가한다', async () => {
    await prisma.missionRepo.deleteMany({ where: { name: 'javascript-lotto' } });
    const res = await request(app)
      .post('/admin/repos')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({
        name: 'javascript-lotto',
        repoUrl: 'https://github.com/woowacourse/javascript-lotto',
        track: 'frontend',
        cohortRegexRules: [{ cohort: 7, nicknameRegex: '\\[.+\\] (.+) 제출합니다' }],
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('javascript-lotto');
    expect(res.body.track).toBe('frontend');
    expect(res.body.type).toBe('individual');
    expect(res.body.nicknameRegex).toBeNull();
    expect(res.body.cohortRegexRules).toEqual([{ cohort: 7, nicknameRegex: '\\[.+\\] (.+) 제출합니다' }]);
  });

  it('GET /admin/repos: 레포 목록을 반환한다', async () => {
    const res = await request(app).get('/admin/repos').set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('PATCH /admin/repos/:id: 레포 정규식을 수정한다', async () => {
    const res = await request(app)
      .patch(`/admin/repos/${repoId}`)
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({
        nicknameRegex: '\\[.+\\] (.+) 미션 제출합니다 \\(8기\\)',
        cohortRegexRules: [{ cohort: 7, nicknameRegex: '\\[.+\\] (.+) 제출합니다 \\(7기\\)' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.nicknameRegex).toBe('\\[.+\\] (.+) 미션 제출합니다 \\(8기\\)');
    expect(res.body.cohortRegexRules).toEqual([{ cohort: 7, nicknameRegex: '\\[.+\\] (.+) 제출합니다 \\(7기\\)' }]);
  });

  it('PATCH /admin/repos/:id: nicknameRegex와 cohortRegexRules를 초기화한다', async () => {
    const res = await request(app)
      .patch(`/admin/repos/${repoId}`)
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({ nicknameRegex: null, cohortRegexRules: null });
    expect(res.status).toBe(200);
    expect(res.body.nicknameRegex).toBeNull();
    expect(res.body.cohortRegexRules).toEqual([]);
  });

  it('DELETE /admin/repos/:id: 레포를 삭제한다', async () => {
    const res = await request(app).delete(`/admin/repos/${repoId}`).set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(res.status).toBe(204);
    repoId = 0;
  });
});

describe('멤버 관리', () => {
  let memberId: number;
  let workspaceId: number;

  beforeAll(async () => {
    const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });
    workspaceId = workspace.id;
    const member = await prisma.member.create({
      data: {
        githubId: 'iftype',
        nickname: '빌리',
        workspaceId,
      },
    });
    memberId = member.id;
  });

  afterAll(async () => {
    await prisma.member.deleteMany({ where: { workspaceId } });
  });

  it('PATCH /admin/members/:id: manualNickname과 blog를 수정한다', async () => {
    const res = await request(app)
      .patch(`/admin/members/${memberId}`)
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({
        manualNickname: '빌리',
        blog: 'https://iftype.github.io',
      });

    expect(res.status).toBe(200);
    expect(res.body.manualNickname).toBe('빌리');
    expect(res.body.blog).toBe('https://iftype.github.io');
  });
});
