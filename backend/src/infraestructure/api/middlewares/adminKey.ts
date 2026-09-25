import { createHash, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/env';
import { AppError } from '../../../application/errorHandler';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

// Single guard for everything under /api/admin
export function adminKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.header('x-admin-key');

  if (!key || !config.adminKey || !timingSafeEqual(digest(key), digest(config.adminKey))) {
    throw AppError.unauthorized();
  }

  next();
}
