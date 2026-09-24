import { EntityManager } from 'typeorm';
import { IdempotencyKey } from '../../domain/entities';
import { IdempotencyRepository, TransactionContext } from '../outputPorts';
import { IdempotencyKeyEntity } from '../database/entities';
import { IdempotencyKeyMapper } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';
import { IdempotencyKeyStatus } from '../../domain/enums';

export class IdempotencyRepositoryImpl implements IdempotencyRepository {
  async claim(tx: TransactionContext, key: string, clientId: string, requestHash: string): Promise<IdempotencyKey | null> {
    const manager = UnitOfWorkImpl.getManager(tx);

    // Try to insert - if key exists, ON CONFLICT DO NOTHING returns nothing
    const result = await manager.query(
      `
      INSERT INTO idempotency_keys (key, client_id, request_hash, status)
      VALUES ($1, $2, $3, 'IN_PROGRESS') ON CONFLICT (key) DO NOTHING
      RETURNING key, client_id, request_hash, status, reservation_id, created_at
      `,
      [key, clientId, requestHash]
    );

    if (result.length > 0) {
      return IdempotencyKeyMapper.toDomain(result[0]);
    }

    // Key already exists - check if same request
    const existing = await manager.findOne(IdempotencyKeyEntity, { where: { key } });
    if (!existing) {
      return null;
    }

    if (existing.request_hash !== requestHash) {
      throw new Error('IDEMPOTENCY_KEY_MISMATCH');
    }

    if (existing.status === IdempotencyKeyStatus.IN_PROGRESS) {
      // Check if it's stale (>60s)
      const age = Date.now() - existing.created_at.getTime();
      if (age > 60000) {
        // Reclaim it
        existing.status = IdempotencyKeyStatus.IN_PROGRESS;
        await manager.save(existing);
      } else {
        throw new Error('REQUEST_IN_PROGRESS');
      }
    }

    return IdempotencyKeyMapper.toDomain(existing);
  }

  async findByKey(tx: TransactionContext, key: string): Promise<IdempotencyKey | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = await manager.findOne(IdempotencyKeyEntity, { where: { key } });
    return entity ? IdempotencyKeyMapper.toDomain(entity) : null;
  }

  async markCompleted(tx: TransactionContext, key: string, reservationId: string): Promise<void> {
    const manager = UnitOfWorkImpl.getManager(tx);
    await manager.query(
      `UPDATE idempotency_keys SET status = 'COMPLETED', reservation_id = $2 WHERE key = $1`,
      [key, reservationId]
    );
  }

  async markFailed(tx: TransactionContext, key: string): Promise<void> {
    const manager = UnitOfWorkImpl.getManager(tx);
    await manager.query(
      `UPDATE idempotency_keys SET status = 'FAILED' WHERE key = $1`,
      [key]
    );
  }
}
