import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../application/errorHandler';
import { ErrorCode, errorMessages } from '@flight-reservations/shared';
import { logger } from '../../utilities';

function isMalformedJson(error: Error): boolean {
  return (error as Error & { type?: string }).type === 'entity.parse.failed';
}

export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' }
  });
}

// Anything unexpected answers 500 INTERNAL_ERROR without internal details
export function errorHandlerMiddleware(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    logger.warn('AppError response', { code: err.code, status: err.statusCode, path: req.path });
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  if (isMalformedJson(err)) {
    res.status(400).json({
      error: { code: ErrorCode.INVALID_REQUEST, message: errorMessages[ErrorCode.INVALID_REQUEST] }
    });
    return;
  }

  logger.error('Unhandled error', { message: err.message, stack: err.stack, path: req.path, method: req.method });
  res.status(500).json({
    error: { code: ErrorCode.INTERNAL_ERROR, message: errorMessages[ErrorCode.INTERNAL_ERROR] }
  });
}
