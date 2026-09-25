// Database failures the application layer reacts to, without knowing about Postgres codes.

// Deadlock (40P01) or serialization failure (40001): the operation may be retried once
export class TransientDatabaseError extends Error {
  constructor(readonly cause: unknown) {
    super('TRANSIENT_DATABASE_ERROR');
    this.name = 'TransientDatabaseError';
  }
}

// Unique violation (23505)
export class UniqueViolationError extends Error {
  constructor(readonly cause: unknown) {
    super('UNIQUE_VIOLATION');
    this.name = 'UniqueViolationError';
  }
}
