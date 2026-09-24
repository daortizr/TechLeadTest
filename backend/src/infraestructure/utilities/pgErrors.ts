// PostgreSQL error codes
export enum PgErrorCode {
  UNIQUE_VIOLATION = '23505',
  FOREIGN_KEY_VIOLATION = '23503',
  CHECK_VIOLATION = '23514',
  DEADLOCK = '40P01',
  SERIALIZATION_FAILURE = '40001'
}

export function getPgErrorCode(error: any): string | null {
  return error?.driverError?.code || error?.code || null;
}

export function isPgError(error: any, code: PgErrorCode | string): boolean {
  return getPgErrorCode(error) === code;
}

export function isDeadlock(error: any): boolean {
  return isPgError(error, PgErrorCode.DEADLOCK);
}

export function isSerializationFailure(error: any): boolean {
  return isPgError(error, PgErrorCode.SERIALIZATION_FAILURE);
}

export function isUniqueViolation(error: any): boolean {
  return isPgError(error, PgErrorCode.UNIQUE_VIOLATION);
}

export function isForeignKeyViolation(error: any): boolean {
  return isPgError(error, PgErrorCode.FOREIGN_KEY_VIOLATION);
}
