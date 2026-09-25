import { Airport } from '../../domain/entities';
import { AirportRepository, TransactionContext } from '../outputPorts';
import { AirportEntity } from '../database/entities';
import { AirportMapper } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';
import { returningRows } from '../utilities/pgResult';

export class AirportRepositoryImpl implements AirportRepository {
  async findAll(tx: TransactionContext): Promise<Airport[]> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const records = await manager.find(AirportEntity, { order: { city: 'ASC' } });
    return records.map((record) => AirportMapper.toDomain(record));
  }

  async findByCode(tx: TransactionContext, code: string): Promise<Airport | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const record = await manager.findOne(AirportEntity, { where: { code } });
    return record ? AirportMapper.toDomain(record) : null;
  }

  async todayAt(tx: TransactionContext, code: string): Promise<string | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ today: string }>(
      await manager.query(
        `SELECT ((now() AT TIME ZONE timezone)::date)::text AS today FROM airports WHERE code = $1`,
        [code]
      )
    );
    return rows.length > 0 ? rows[0].today : null;
  }
}
