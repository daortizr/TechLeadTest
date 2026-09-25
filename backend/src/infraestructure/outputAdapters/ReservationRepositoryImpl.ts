import { EntityManager } from 'typeorm';
import { Reservation } from '../../domain/entities';
import { ReservationRepository, TransactionContext } from '../outputPorts';
import { ReservationEntity } from '../database/entities';
import { ReservationMapper } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';

export class ReservationRepositoryImpl implements ReservationRepository {
  async create(tx: TransactionContext, reservation: Reservation): Promise<Reservation> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = ReservationMapper.toEntity(reservation);
    const saved = await manager.save(entity);
    return ReservationMapper.toDomain(saved);
  }

  async findById(tx: TransactionContext, id: string): Promise<Reservation | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = await manager.findOne(ReservationEntity, {
      where: { id }
    });
    return entity ? ReservationMapper.toDomain(entity) : null;
  }

  async findByCode(tx: TransactionContext, code: string): Promise<Reservation | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = await manager.findOne(ReservationEntity, {
      where: { code }
    });
    return entity ? ReservationMapper.toDomain(entity) : null;
  }
}
