import { Flight } from '../../domain/entities';
import { FlightAvailability } from '../../domain/interfaces';
import { FlightRepository, TransactionContext } from '../outputPorts';
import { FlightEntity } from '../database/entities';
import { FlightMapper, FlightRecord } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';
import { returningRows } from '../utilities/pgResult';

type FlightSearchRow = FlightRecord & { available_seats: string; total_seats: string };

export class FlightRepositoryImpl implements FlightRepository {
  async findById(tx: TransactionContext, id: string): Promise<Flight | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const record = await manager.findOne(FlightEntity, { where: { id } });
    return record ? FlightMapper.toDomain(record) : null;
  }

  async search(
    tx: TransactionContext,
    origin: string,
    destination: string,
    date: string
  ): Promise<FlightAvailability[]> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<FlightSearchRow>(
      await manager.query(
        `
        SELECT f.id, f.code, f.origin, f.destination, f.departure_at, f.arrival_at,
               f.price_cents, f.currency, f.status, f.version, f.created_at,
               COUNT(*) FILTER (WHERE s.status = 'AVAILABLE'
                                   OR (s.status = 'BLOCKED' AND s.locked_until <= now())) AS available_seats,
               COUNT(*) AS total_seats
        FROM flights f
        JOIN airports ao ON ao.code = f.origin
        JOIN seats s ON s.flight_id = f.id
        WHERE f.origin = $1 AND f.destination = $2
          AND f.departure_at >= ($3::date)::timestamp AT TIME ZONE ao.timezone
          AND f.departure_at <  (($3::date + 1))::timestamp AT TIME ZONE ao.timezone
          AND f.departure_at > now()
        GROUP BY f.id
        ORDER BY f.departure_at
        `,
        [origin, destination, date]
      )
    );
    return rows.map((row) => ({
      flight: FlightMapper.toDomain(row),
      availableSeats: Number(row.available_seats),
      totalSeats: Number(row.total_seats)
    }));
  }

  async lockForReservation(tx: TransactionContext, flightId: string): Promise<boolean> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ id: string }>(
      await manager.query(
        `
        SELECT id FROM flights
        WHERE id = $1 AND status = 'ON_SALE' AND departure_at > now()
        FOR NO KEY UPDATE
        `,
        [flightId]
      )
    );
    return rows.length > 0;
  }

  async markSoldOutIfFull(tx: TransactionContext, flightId: string): Promise<number | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ version: number }>(
      await manager.query(
        `
        UPDATE flights SET status = 'SOLD_OUT', version = version + 1
        WHERE id = $1 AND status = 'ON_SALE'
          AND NOT EXISTS (SELECT 1 FROM seats WHERE flight_id = $1 AND status <> 'RESERVED')
        RETURNING version
        `,
        [flightId]
      )
    );
    return rows.length > 0 ? rows[0].version : null;
  }

  async cancel(tx: TransactionContext, flightId: string): Promise<number | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ version: number }>(
      await manager.query(
        `
        UPDATE flights SET status = 'CANCELLED', version = version + 1
        WHERE id = $1 AND status = 'ON_SALE'
        RETURNING version
        `,
        [flightId]
      )
    );
    return rows.length > 0 ? rows[0].version : null;
  }
}
