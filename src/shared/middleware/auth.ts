import type { Request, Response, NextFunction } from 'express';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const headerToken = req.headers.authorization?.split(' ')[1];
  const queryToken = typeof req.query['token'] === 'string' ? req.query['token'] : undefined;
  const token = headerToken ?? queryToken;
  if (!token || token !== process.env['ADMIN_SECRET']) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
