// TypeORM's Postgres driver returns [rows, affectedCount] for UPDATE/DELETE ... RETURNING
// and the plain row array for SELECT and INSERT ... RETURNING. This is the only place that
// knows about that difference.
export function returningRows<T>(result: unknown): T[] {
  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') {
    return result[0] as T[];
  }
  return result as T[];
}
