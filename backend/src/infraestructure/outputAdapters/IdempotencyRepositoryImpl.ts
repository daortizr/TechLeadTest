import { IdempotencyClaim } from '../../domain/interfaces';
import { IdempotencyRepository, TransactionContext } from '../outputPorts';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';
import { returningRows } from '../utilities/pgResult';

const STALE_SECONDS = 60;

interface ExistingKeyRow {
  client_id: string;
  request_hash: string;
  status: string;
  reservation_id: string | null;
  stale: boolean;
}

export class IdempotencyRepositoryImpl implements IdempotencyRepository {
  async claim(
    tx: TransactionContext,
    key: string,
    clientId: string,
    requestHash: string
  ): Promise<IdempotencyClaim> {
    const manager = UnitOfWorkImpl.getManager(tx);

    const inserted = returningRows<{ key: string }>(
      await manager.query(
        `
        INSERT INTO idempotency_keys (key, client_id, request_hash, status)
        VALUES ($1, $2, $3, 'IN_PROGRESS') ON CONFLICT (key) DO NOTHING RETURNING key
        `,
        [key, clientId, requestHash]
      )
    );
    if (inserted.length > 0) return { outcome: 'CLAIMED' };

    const existing = returningRows<ExistingKeyRow>(
      await manager.query(
        `
        SELECT client_id, request_hash, status, reservation_id,
               (created_at < now() - make_interval(secs => $2)) AS stale
        FROM idempotency_keys WHERE key = $1
        `,
        [key, STALE_SECONDS]
      )
    );
    // The row can only be missing if it was deleted between both statements
    if (existing.length === 0) return { outcome: 'IN_PROGRESS' };

    const row = existing[0];
    if (row.request_hash !== requestHash || row.client_id !== clientId) return { outcome: 'MISMATCH' };
    if (row.status === 'COMPLETED' && row.reservation_id) {
      return { outcome: 'COMPLETED', reservationId: row.reservation_id };
    }

    if (row.status === 'FAILED' || (row.status === 'IN_PROGRESS' && row.stale)) {
      const reclaimed = returningRows<{ key: string }>(
        await manager.query(
          `
          UPDATE idempotency_keys SET status = 'IN_PROGRESS', created_at = now()
          WHERE key = $1 AND request_hash = $2 AND client_id = $3
            AND (status = 'FAILED'
                 OR (status = 'IN_PROGRESS' AND created_at < now() - make_interval(secs => $4)))
          RETURNING key
          `,
          [key, requestHash, clientId, STALE_SECONDS]
        )
      );
      if (reclaimed.length > 0) return { outcome: 'CLAIMED' };
    }

    return { outcome: 'IN_PROGRESS' };
  }

  async complete(tx: TransactionContext, key: string, reservationId: string): Promise<number> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ key: string }>(
      await manager.query(
        `UPDATE idempotency_keys SET status = 'COMPLETED', reservation_id = $2 WHERE key = $1 RETURNING key`,
        [key, reservationId]
      )
    );
    return rows.length;
  }

  async fail(tx: TransactionContext, key: string): Promise<void> {
    const manager = UnitOfWorkImpl.getManager(tx);
    await manager.query(
      `UPDATE idempotency_keys SET status = 'FAILED' WHERE key = $1 AND status = 'IN_PROGRESS'`,
      [key]
    );
  }

  async findCompletedReservationId(tx: TransactionContext, key: string): Promise<string | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ reservation_id: string }>(
      await manager.query(
        `SELECT reservation_id FROM idempotency_keys WHERE key = $1 AND status = 'COMPLETED'`,
        [key]
      )
    );
    return rows.length > 0 ? rows[0].reservation_id : null;
  }
}
