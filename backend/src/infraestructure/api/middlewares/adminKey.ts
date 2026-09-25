import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/env';
import { AppError } from '../../../application/errorHandler';

export function adminKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'];

  if (!key || key !== config.ADMIN_KEY) {
    throw AppError.forbidden(
      'UNAUTHORIZED' as any,
      'Clave de administrador inválida o faltante'
    );
  }

  next();
}
