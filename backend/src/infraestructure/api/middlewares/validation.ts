import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodTypeAny, z } from 'zod';
import { ErrorCode } from '@flight-reservations/shared';
import { AppError } from '../../../application/errorHandler';
import { clientIdSchema, idempotencyKeySchema } from '../schemas';

// Never echoes received values, only the field path and the rule that failed:
// the body may carry card and personal data.
export function parseInput<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'Solicitud inválida', {
    fields: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
  });
}

const CLIENT_ID_KEY = 'clientId';
const IDEMPOTENCY_KEY = 'idempotencyKey';

// X-Client-Id must be a UUID. When it is optional, an absent header is fine but a malformed one is not.
export function clientIdMiddleware(required: boolean): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('x-client-id');
    if (header === undefined) {
      if (required) {
        throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'Falta la cabecera X-Client-Id');
      }
      return next();
    }
    res.locals[CLIENT_ID_KEY] = parseInput(clientIdSchema, header);
    next();
  };
}

export function idempotencyKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('idempotency-key');
  if (header === undefined) {
    throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'Falta la cabecera Idempotency-Key');
  }
  res.locals[IDEMPOTENCY_KEY] = parseInput(idempotencyKeySchema, header);
  next();
}

export function getClientId(res: Response): string | undefined {
  const value: unknown = res.locals[CLIENT_ID_KEY];
  return typeof value === 'string' ? value : undefined;
}

export function requireClientId(res: Response): string {
  const clientId = getClientId(res);
  if (!clientId) {
    throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'Falta la cabecera X-Client-Id');
  }
  return clientId;
}

export function requireIdempotencyKey(res: Response): string {
  const value: unknown = res.locals[IDEMPOTENCY_KEY];
  if (typeof value !== 'string') {
    throw AppError.badRequest(ErrorCode.INVALID_REQUEST, 'Falta la cabecera Idempotency-Key');
  }
  return value;
}
