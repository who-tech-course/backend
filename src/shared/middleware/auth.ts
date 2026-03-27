import type { Request, Response, NextFunction } from 'express';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || token !== process.env['ADMIN_SECRET']) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
