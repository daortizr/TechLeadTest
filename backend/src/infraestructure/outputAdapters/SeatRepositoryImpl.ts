import { Seat } from '../../domain/entities';
import { FlightStatus, SeatStatus } from '../../domain/enums';
import {
  AcquiredSeat,
  ExpiredSeat,
  ExtendedLock,
  LockStageCounts,
  PayableLock,
  ReleasedSeat,
  SeatDiagnosis
} from '../../domain/interfaces';
import { SeatRepository, TransactionContext } from '../outputPorts';
import { SeatEntity } from '../database/entities';
import { SeatMapper } from '../database/mappers';
import { UnitOfWorkImpl } from '../database/UnitOfWorkImpl';
import { returningRows } from '../utilities/pgResult';

interface SeatVersionRow {
  seat_number: string;
  version: number;
}

interface AcquiredRow extends SeatVersionRow {
  locked_until: Date;
}

interface DiagnosisRow {
  seat_exists: boolean;
  seat_status: string | null;
  seat_version: number | null;
  locked_until: Date | null;
  locked_by_caller: boolean;
  lock_active: boolean;
  checkout_started: boolean;
  flight_status: string;
  flight_departs_later: boolean;
}

export class SeatRepositoryImpl implements SeatRepository {
  async findByFlightId(tx: TransactionContext, flightId: string): Promise<Seat[]> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const records = await manager.find(SeatEntity, {
      where: { flight_id: flightId },
      order: { row_number: 'ASC', column_letter: 'ASC' }
    });
    return records.map((record) => SeatMapper.toDomain(record));
  }

  async databaseNow(tx: TransactionContext): Promise<Date> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ now: Date }>(await manager.query('SELECT now() AS now'));
    return rows[0].now;
  }

  async releaseOtherLocks(
    tx: TransactionContext,
    flightId: string,
    seatNumber: string,
    clientId: string
  ): Promise<ReleasedSeat[]> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<SeatVersionRow>(
      await manager.query(
        `
        UPDATE seats
        SET status = 'AVAILABLE', locked_by = NULL, locked_until = NULL,
            checkout_started_at = NULL, version = version + 1
        WHERE flight_id = $1 AND locked_by = $3 AND status = 'BLOCKED' AND seat_number <> $2
        RETURNING seat_number, version
        `,
        [flightId, seatNumber, clientId]
      )
    );
    return rows.map((row) => ({ seatNumber: row.seat_number, version: row.version }));
  }

  async acquire(
    tx: TransactionContext,
    flightId: string,
    seatNumber: string,
    clientId: string,
    ttlSeconds: number
  ): Promise<AcquiredSeat | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<AcquiredRow>(
      await manager.query(
        `
        UPDATE seats s
        SET status = 'BLOCKED', locked_by = $3,
            locked_until = now() + make_interval(secs => $4),
            checkout_started_at = NULL, version = version + 1
        WHERE s.flight_id = $1 AND s.seat_number = $2
          AND (s.status = 'AVAILABLE' OR (s.status = 'BLOCKED' AND s.locked_until <= now()))
          AND EXISTS (SELECT 1 FROM flights f
                      WHERE f.id = s.flight_id
                        AND f.status = 'ON_SALE'
                        AND f.departure_at > now())
        RETURNING seat_number, version, locked_until
        `,
        [flightId, seatNumber, clientId, ttlSeconds]
      )
    );
    if (rows.length === 0) return null;
    return { seatNumber: rows[0].seat_number, version: rows[0].version, lockedUntil: rows[0].locked_until };
  }

  async release(
    tx: TransactionContext,
    flightId: string,
    seatNumber: string,
    clientId: string
  ): Promise<ReleasedSeat | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<SeatVersionRow>(
      await manager.query(
        `
        UPDATE seats
        SET status = 'AVAILABLE', locked_by = NULL, locked_until = NULL,
            checkout_started_at = NULL, version = version + 1
        WHERE flight_id = $1 AND seat_number = $2 AND status = 'BLOCKED' AND locked_by = $3
        RETURNING seat_number, version
        `,
        [flightId, seatNumber, clientId]
      )
    );
    return rows.length > 0 ? { seatNumber: rows[0].seat_number, version: rows[0].version } : null;
  }

  async extend(
    tx: TransactionContext,
    flightId: string,
    seatNumber: string,
    clientId: string,
    ttlSeconds: number
  ): Promise<ExtendedLock | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ locked_until: Date; version: number }>(
      await manager.query(
        `
        UPDATE seats s
        SET locked_until = GREATEST(s.locked_until, now() + make_interval(secs => $4)),
            checkout_started_at = now(),
            version = version + 1
        WHERE s.flight_id = $1 AND s.seat_number = $2
          AND s.status = 'BLOCKED' AND s.locked_by = $3
          AND s.locked_until > now()
          AND s.checkout_started_at IS NULL
          AND EXISTS (SELECT 1 FROM flights f
                      WHERE f.id = s.flight_id
                        AND f.status = 'ON_SALE'
                        AND f.departure_at > now())
        RETURNING locked_until, version
        `,
        [flightId, seatNumber, clientId, ttlSeconds]
      )
    );
    return rows.length > 0 ? { lockedUntil: rows[0].locked_until, version: rows[0].version } : null;
  }

  async reserve(
    tx: TransactionContext,
    flightId: string,
    seatNumber: string,
    clientId: string
  ): Promise<number | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ version: number }>(
      await manager.query(
        `
        UPDATE seats SET status = 'RESERVED', locked_by = NULL, locked_until = NULL,
                         checkout_started_at = NULL, version = version + 1
        WHERE flight_id = $1 AND seat_number = $2
          AND status = 'BLOCKED' AND locked_by = $3 AND locked_until > now()
        RETURNING version
        `,
        [flightId, seatNumber, clientId]
      )
    );
    return rows.length > 0 ? rows[0].version : null;
  }

  async expireLocks(tx: TransactionContext): Promise<ExpiredSeat[]> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ flight_id: string; seat_number: string; version: number }>(
      await manager.query(
        `
        UPDATE seats
        SET status = 'AVAILABLE', locked_by = NULL, locked_until = NULL,
            checkout_started_at = NULL, version = version + 1
        WHERE status = 'BLOCKED' AND locked_until <= now()
        RETURNING flight_id, seat_number, version
        `
      )
    );
    return rows.map((row) => ({ flightId: row.flight_id, seatNumber: row.seat_number, version: row.version }));
  }

  async diagnose(
    tx: TransactionContext,
    flightId: string,
    seatNumber: string,
    clientId: string
  ): Promise<SeatDiagnosis | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<DiagnosisRow>(
      await manager.query(
        `
        SELECT (s.seat_number IS NOT NULL)             AS seat_exists,
               s.status                                AS seat_status,
               s.version                               AS seat_version,
               s.locked_until                          AS locked_until,
               COALESCE(s.locked_by = $3, false)       AS locked_by_caller,
               COALESCE(s.locked_until > now(), false) AS lock_active,
               (s.checkout_started_at IS NOT NULL)     AS checkout_started,
               f.status                                AS flight_status,
               (f.departure_at > now())                AS flight_departs_later
        FROM flights f
        LEFT JOIN seats s ON s.flight_id = f.id AND s.seat_number = $2
        WHERE f.id = $1
        `,
        [flightId, seatNumber, clientId]
      )
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      seatExists: row.seat_exists,
      seatStatus: row.seat_status as SeatStatus | null,
      seatVersion: row.seat_version,
      lockedUntil: row.locked_until,
      lockedByCaller: row.locked_by_caller,
      lockActive: row.lock_active,
      checkoutStarted: row.checkout_started,
      flightStatus: row.flight_status as FlightStatus,
      flightDepartsLater: row.flight_departs_later
    };
  }

  async verifyPayable(
    tx: TransactionContext,
    flightId: string,
    seatNumber: string,
    clientId: string,
    marginSeconds: number
  ): Promise<PayableLock | null> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ price: number; currency: string }>(
      await manager.query(
        `
        SELECT f.price, f.currency
        FROM seats s
        JOIN flights f ON f.id = s.flight_id
        WHERE s.flight_id = $1 AND s.seat_number = $2
          AND s.status = 'BLOCKED' AND s.locked_by = $3
          AND s.locked_until > now() + make_interval(secs => $4)
          AND f.status = 'ON_SALE' AND f.departure_at > now()
        `,
        [flightId, seatNumber, clientId, marginSeconds]
      )
    );
    return rows.length > 0 ? { price: rows[0].price, currency: rows[0].currency } : null;
  }

  async countLockStages(tx: TransactionContext, flightId: string): Promise<LockStageCounts> {
    const manager = UnitOfWorkImpl.getManager(tx);
    const rows = returningRows<{ selecting: string; checkout: string }>(
      await manager.query(
        `
        SELECT COUNT(*) FILTER (WHERE checkout_started_at IS NULL)     AS selecting,
               COUNT(*) FILTER (WHERE checkout_started_at IS NOT NULL) AS checkout
        FROM seats
        WHERE flight_id = $1 AND status = 'BLOCKED' AND locked_until > now()
        `,
        [flightId]
      )
    );
    return { selecting: Number(rows[0].selecting), checkout: Number(rows[0].checkout) };
  }
}
