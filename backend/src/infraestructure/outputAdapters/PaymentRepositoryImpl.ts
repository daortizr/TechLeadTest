import { Payment } from '../../domain/entities';
import { PaymentRepository, TransactionContext } from '../outputPorts';
import { PaymentMapper, PaymentRecord } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';
import { returningRows } from '../utilities/pgResult';

export class PaymentRepositoryImpl implements PaymentRepository {
  async insertAuthorized(
    tx: TransactionContext,
    idempotencyKey: string,
    authorizationRef: string,
    amount: number
  ): Promise<void> {
    const manager = UnitOfWorkImpl.getManager(tx);
    await manager.query(
      `
      INSERT INTO payments (idempotency_key, authorization_ref, amount, status)
      VALUES ($1, $2, $3, 'AUTHORIZED')
      `,
      [idempotencyKey, authorizationRef, amount]
    );
  }

  async insertDeclined(tx: TransactionContext, idempotencyKey: string, amount: number): Promise<void> {
    const manager = UnitOfWorkImpl.getManager(tx);
    await manager.query(
      `
      INSERT INTO payments (idempotency_key, amount, status)
      VALUES ($1, $2, 'DECLINED')
      `,
      [idempotencyKey, amount]
    );
  }

  async findAuthorizedWithoutReservation(tx: TransactionContext, idempotencyKey: string): Promise<Payment | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<PaymentRecord>(
      await manager.query(
        `
        SELECT id, idempotency_key, reservation_id, authorization_ref, amount, status, created_at
        FROM payments
        WHERE idempotency_key = $1 AND status = 'AUTHORIZED' AND reservation_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [idempotencyKey]
      )
    );
    return rows.length > 0 ? PaymentMapper.toDomain(rows[0]) : null;
  }

  async linkReservation(tx: TransactionContext, idempotencyKey: string, reservationId: string): Promise<number> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ id: string }>(
      await manager.query(
        `
        UPDATE payments SET reservation_id = $2
        WHERE idempotency_key = $1 AND status = 'AUTHORIZED' AND reservation_id IS NULL
        RETURNING id
        `,
        [idempotencyKey, reservationId]
      )
    );
    return rows.length;
  }

  async markVoided(tx: TransactionContext, idempotencyKey: string): Promise<void> {
    const manager = UnitOfWorkImpl.getManager(tx);
    await manager.query(
      `
      UPDATE payments SET status = 'VOIDED'
      WHERE idempotency_key = $1 AND status = 'AUTHORIZED' AND reservation_id IS NULL
      `,
      [idempotencyKey]
    );
  }

  async markVoidFailed(tx: TransactionContext, idempotencyKey: string): Promise<void> {
    const manager = UnitOfWorkImpl.getManager(tx);
    await manager.query(
      `
      UPDATE payments SET status = 'VOID_FAILED'
      WHERE idempotency_key = $1 AND status = 'AUTHORIZED' AND reservation_id IS NULL
      `,
      [idempotencyKey]
    );
  }
}
