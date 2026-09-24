import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../application/errorHandler';
import { ErrorCode, errorMessages } from '@flight-reservations/shared';
import { logger } from '../../utilities';

export function errorHandlerMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn('AppError response', { code: err.code, status: err.statusCode });
    return res.status(err.statusCode).json(err.toJSON());
  }

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: errorMessages[ErrorCode.INTERNAL_ERROR]
    }
  });
}
