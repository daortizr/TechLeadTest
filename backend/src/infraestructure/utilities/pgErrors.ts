import { TransientDatabaseError, UniqueViolationError } from '../outputPorts';

// PostgreSQL error codes
export enum PgErrorCode {
  UNIQUE_VIOLATION = '23505',
  FOREIGN_KEY_VIOLATION = '23503',
  CHECK_VIOLATION = '23514',
  DEADLOCK = '40P01',
  SERIALIZATION_FAILURE = '40001'
}

interface ErrorWithCode {
  code?: unknown;
  driverError?: { code?: unknown };
}

export function getPgErrorCode(error: unknown): string | null {
  const candidate = error as ErrorWithCode | null;
  const code = candidate?.driverError?.code ?? candidate?.code;
  return typeof code === 'string' ? code : null;
}

export function isPgError(error: unknown, code: PgErrorCode | string): boolean {
  return getPgErrorCode(error) === code;
}

// The only place where Postgres codes become errors the application understands
export function translatePgError(error: unknown): unknown {
  const code = getPgErrorCode(error);
  if (code === PgErrorCode.DEADLOCK || code === PgErrorCode.SERIALIZATION_FAILURE) {
    return new TransientDatabaseError(error);
  }
  if (code === PgErrorCode.UNIQUE_VIOLATION) {
    return new UniqueViolationError(error);
  }
  return error;
}
