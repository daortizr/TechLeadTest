import { EntityManager } from 'typeorm';
import { Flight } from '../../domain/entities';
import { FlightRepository, TransactionContext } from '../outputPorts';
import { FlightEntity } from '../database/entities';
import { FlightMapper } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';

export class FlightRepositoryImpl implements FlightRepository {
  async findById(tx: TransactionContext, id: string): Promise<Flight | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = await manager.findOne(FlightEntity, {
      where: { id }
    });
    return entity ? FlightMapper.toDomain(entity) : null;
  }

  async findByCode(tx: TransactionContext, code: string): Promise<Flight | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = await manager.findOne(FlightEntity, {
      where: { code }
    });
    return entity ? FlightMapper.toDomain(entity) : null;
  }

  async search(
    tx: TransactionContext,
    origin: string,
    destination: string,
    startDate: Date,
    endDate: Date
  ): Promise<Flight[]> {
    const manager = UnitOfWorkImpl.getManager(tx);

    const entities = await manager.query(
      `
      SELECT f.id, f.code, f.origin, f.destination, f.departure_at, f.arrival_at,
             f.price_cents, f.currency, f.status, f.version, f.created_at,
             COUNT(*) FILTER (WHERE s.status = 'AVAILABLE'
                               OR (s.status = 'BLOCKED' AND s.locked_until <= now())) AS available_seats
      FROM flights f
      JOIN airports ao ON ao.code = f.origin
      LEFT JOIN seats s ON s.flight_id = f.id
      WHERE f.origin = $1 AND f.destination = $2
        AND f.departure_at >= $3
        AND f.departure_at < $4
        AND f.departure_at > now()
      GROUP BY f.id
      ORDER BY f.departure_at
      `,
      [origin, destination, startDate, endDate]
    );

    return entities.map(e => FlightMapper.toDomain(e));
  }

  async update(tx: TransactionContext, flight: Flight): Promise<void> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = FlightMapper.toEntity(flight);
    await manager.save(entity);
  }
}
