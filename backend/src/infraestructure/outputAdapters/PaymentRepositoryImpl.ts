import { EntityManager } from 'typeorm';
import { Payment } from '../../domain/entities';
import { PaymentRepository, TransactionContext } from '../outputPorts';
import { PaymentEntity } from '../database/entities';
import { PaymentMapper } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';

export class PaymentRepositoryImpl implements PaymentRepository {
  async create(tx: TransactionContext, payment: Payment): Promise<Payment> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = PaymentMapper.toEntity(payment);
    const saved = await manager.save(entity);
    return PaymentMapper.toDomain(saved);
  }

  async findById(tx: TransactionContext, id: string): Promise<Payment | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = await manager.findOne(PaymentEntity, {
      where: { id }
    });
    return entity ? PaymentMapper.toDomain(entity) : null;
  }

  async update(tx: TransactionContext, payment: Payment): Promise<void> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = PaymentMapper.toEntity(payment);
    await manager.save(entity);
  }
}
