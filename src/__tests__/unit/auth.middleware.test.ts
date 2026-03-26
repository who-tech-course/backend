import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { adminAuth } from '../../middleware/auth.js';
import type { Request, Response, NextFunction } from 'express';

const ADMIN_SECRET = 'test-admin-secret';

function makeReq(authorization?: string): Request {
  return {
    headers: authorization ? { authorization } : {},
  } as unknown as Request;
}

function makeRes(): { status: jest.Mock; json: jest.Mock; statusCode?: number } {
  const res = {
    status: jest.fn().mockReturnThis() as jest.Mock,
    json: jest.fn().mockReturnThis() as jest.Mock,
  };
  return res;
}

describe('adminAuth', () => {
  const originalSecret = process.env['ADMIN_SECRET'];

  beforeEach(() => {
    process.env['ADMIN_SECRET'] = ADMIN_SECRET;
  });

  afterEach(() => {
    process.env['ADMIN_SECRET'] = originalSecret;
  });

  it('올바른 Bearer 토큰으로 요청하면 next를 호출한다', () => {
    const req = makeReq(`Bearer ${ADMIN_SECRET}`);
    const res = makeRes();
    const next = jest.fn() as jest.Mock;

    adminAuth(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('Authorization 헤더가 없으면 401을 반환한다', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn() as jest.Mock;

    adminAuth(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('잘못된 토큰으로 요청하면 401을 반환한다', () => {
    const req = makeReq('Bearer wrong-token');
    const res = makeRes();
    const next = jest.fn() as jest.Mock;

    adminAuth(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('Bearer 접두사 없이 토큰만 보내면 401을 반환한다', () => {
    const req = makeReq(ADMIN_SECRET);
    const res = makeRes();
    const next = jest.fn() as jest.Mock;

    adminAuth(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('빈 문자열 토큰으로 요청하면 401을 반환한다', () => {
    const req = makeReq('Bearer ');
    const res = makeRes();
    const next = jest.fn() as jest.Mock;

    adminAuth(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('ADMIN_SECRET 환경 변수가 없으면 모든 토큰에 401을 반환한다', () => {
    delete process.env['ADMIN_SECRET'];
    const req = makeReq('Bearer any-token');
    const res = makeRes();
    const next = jest.fn() as jest.Mock;

    adminAuth(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('공백만 있는 Authorization 헤더는 401을 반환한다', () => {
    const req = makeReq('   ');
    const res = makeRes();
    const next = jest.fn() as jest.Mock;

    adminAuth(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});