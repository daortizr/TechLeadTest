import { EntityManager } from 'typeorm';
import { Airport } from '../../domain/entities';
import { AirportRepository, TransactionContext } from '../outputPorts';
import { AirportEntity } from '../database/entities';
import { AirportMapper } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';

export class AirportRepositoryImpl implements AirportRepository {
  async findAll(tx: TransactionContext): Promise<Airport[]> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entities = await manager.find(AirportEntity);
    return entities.map(AirportMapper.toDomain);
  }

  async findByCode(tx: TransactionContext, code: string): Promise<Airport | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = await manager.findOne(AirportEntity, { where: { code } });
    return entity ? AirportMapper.toDomain(entity) : null;
  }
}
