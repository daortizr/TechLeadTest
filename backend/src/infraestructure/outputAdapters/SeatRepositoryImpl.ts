import { EntityManager } from 'typeorm';
import { Seat } from '../../domain/entities';
import { SeatRepository, TransactionContext } from '../outputPorts';
import { SeatEntity } from '../database/entities';
import { SeatMapper } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';

export class SeatRepositoryImpl implements SeatRepository {
  async findBySeatNumber(tx: TransactionContext, flightId: string, seatNumber: string): Promise<Seat | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entity = await manager.findOne(SeatEntity, {
      where: { flight_id: flightId, seat_number: seatNumber }
    });
    return entity ? SeatMapper.toDomain(entity) : null;
  }

  async findByFlightId(tx: TransactionContext, flightId: string): Promise<Seat[]> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const entities = await manager.find(SeatEntity, {
      where: { flight_id: flightId },
      order: { seat_number: 'ASC' }
    });
    return entities.map(SeatMapper.toDomain);
  }

  async lock(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string, ttlSeconds: number): Promise<Seat | null> {
    const manager = UnitOfWorkImpl.getManager(tx);

    // 1. Release previous lock by this client in this flight
    await manager.query(
      `
      UPDATE seats
      SET status = 'AVAILABLE', locked_by = NULL, locked_until = NULL,
          checkout_started_at = NULL, version = version + 1
      WHERE flight_id = $1 AND locked_by = $2 AND status = 'BLOCKED' AND seat_number <> $3
      `,
      [flightId, clientId, seatNumber]
    );

    // 2. Acquire new seat (atomic - free or expired)
    const result = await manager.query(
      `
      UPDATE seats s
      SET status = 'BLOCKED', locked_by = $3,
          locked_until = now() + make_interval(secs => $4),
          checkout_started_at = NULL, version = version + 1
      WHERE s.flight_id = $1 AND s.seat_number = $2
        AND (s.status = 'AVAILABLE' OR (s.status = 'BLOCKED' AND s.locked_until <= now()))
        AND EXISTS (SELECT 1 FROM flights f
                    WHERE f.id = s.flight_id
                      AND f.status IN ('ON_SALE')
                      AND f.departure_at > now())
      RETURNING flight_id, seat_number, row_number, column_letter, status,
                locked_by, locked_until, checkout_started_at, version
      `,
      [flightId, seatNumber, clientId, ttlSeconds]
    );

    if (result.length === 0) {
      return null;
    }

    return SeatMapper.toDomain(result[0]);
  }

  async unlock(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string): Promise<Seat | null> {
    const manager = UnitOfWorkImpl.getManager(tx);

    const result = await manager.query(
      `
      UPDATE seats
      SET status = 'AVAILABLE', locked_by = NULL, locked_until = NULL,
          checkout_started_at = NULL, version = version + 1
      WHERE flight_id = $1 AND seat_number = $2 AND status = 'BLOCKED' AND locked_by = $3
      RETURNING flight_id, seat_number, row_number, column_letter, status,
                locked_by, locked_until, checkout_started_at, version
      `,
      [flightId, seatNumber, clientId]
    );

    return result.length > 0 ? SeatMapper.toDomain(result[0]) : null;
  }

  async reserve(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string): Promise<Seat | null> {
    const manager = UnitOfWorkImpl.getManager(tx);

    const result = await manager.query(
      `
      UPDATE seats SET status = 'RESERVED', locked_by = NULL, locked_until = NULL,
                       checkout_started_at = NULL, version = version + 1
      WHERE flight_id = $1 AND seat_number = $2
        AND status = 'BLOCKED' AND locked_by = $3 AND locked_until > now()
      RETURNING flight_id, seat_number, row_number, column_letter, status,
                locked_by, locked_until, checkout_started_at, version
      `,
      [flightId, seatNumber, clientId]
    );

    return result.length > 0 ? SeatMapper.toDomain(result[0]) : null;
  }
}
