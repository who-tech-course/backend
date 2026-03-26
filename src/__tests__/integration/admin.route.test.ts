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

describe('GET /', () => {
  it('루트 경로는 200과 메시지를 반환한다', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'who-tech-course API');
  });
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

  it('잘못된 토큰으로 접근하면 401을 반환한다', async () => {
    const res = await request(app).get('/admin/status').set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
  });

  it('Bearer 접두사 없이 접근하면 401을 반환한다', async () => {
    const res = await request(app).get('/admin/status').set('Authorization', ADMIN_SECRET);
    expect(res.status).toBe(401);
  });

  it('memberCount는 숫자이다', async () => {
    const res = await request(app).get('/admin/status').set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.memberCount).toBe('number');
  });
});

describe('GET /admin/workspace', () => {
  it('워크스페이스 설정을 반환한다', async () => {
    const res = await request(app).get('/admin/workspace').set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nicknameRegex');
    expect(res.body).toHaveProperty('cohortRules');
  });

  it('cohortRules는 배열이다', async () => {
    const res = await request(app).get('/admin/workspace').set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cohortRules)).toBe(true);
  });

  it('cohortRules 각 항목에 year와 cohort 필드가 있다', async () => {
    const res = await request(app).get('/admin/workspace').set('Authorization', `Bearer ${ADMIN_SECRET}`);
    expect(res.status).toBe(200);
    const rules = res.body.cohortRules;
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]).toHaveProperty('year');
    expect(rules[0]).toHaveProperty('cohort');
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await request(app).get('/admin/workspace');
    expect(res.status).toBe(401);
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

  it('cohortRules를 업데이트할 수 있다', async () => {
    const newRules = [
      { year: 2026, cohort: 8 },
      { year: 2025, cohort: 7 },
      { year: 2024, cohort: 6 },
    ];
    const res = await request(app)
      .put('/admin/workspace')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({ cohortRules: newRules });
    expect(res.status).toBe(200);
    expect(res.body.cohortRules).toHaveLength(3);
    expect(res.body.cohortRules[2]).toMatchObject({ year: 2024, cohort: 6 });
  });

  it('nicknameRegex와 cohortRules를 동시에 업데이트할 수 있다', async () => {
    const res = await request(app)
      .put('/admin/workspace')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({
        nicknameRegex: 'new-regex (.+)',
        cohortRules: [{ year: 2026, cohort: 8 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.nicknameRegex).toBe('new-regex (.+)');
    expect(res.body.cohortRules).toHaveLength(1);
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await request(app).put('/admin/workspace').send({ nicknameRegex: 'test' });
    expect(res.status).toBe(401);
  });

  it('응답에 cohortRules가 배열로 반환된다', async () => {
    const res = await request(app)
      .put('/admin/workspace')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({ nicknameRegex: '\\[.+\\] (.+) 미션 제출합니다' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cohortRules)).toBe(true);
  });
});