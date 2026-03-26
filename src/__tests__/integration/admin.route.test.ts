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
