import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dataSource } from '../../src/infraestructure/database/dataSource';
import { seedDemoData } from '../../src/infraestructure/database/seed/demoSeed';
import { refreshDemoData } from '../../src/infraestructure/database/refreshDemoData';
import { bogotaDate, CLEAN_RECONCILIATION, query, reconciliation, resetState } from './helpers';

// The seed dates are relative to the day it ran. A database kept from a previous day must get fresh
// demo flights on startup, without touching flights that are not part of the seed.
describe('demo data refresh on startup', () => {
  beforeAll(async () => {
    if (!dataSource.isInitialized) await dataSource.initialize();
    await resetState();
  });

  afterAll(async () => {
    // Later test files expect the seed: put it back, as the last case removes it
    if ((await query(`SELECT 1 FROM flights WHERE code = 'AV101'`)).length === 0) {
      const queryRunner = dataSource.createQueryRunner();
      try {
        await seedDemoData(queryRunner);
      } finally {
        await queryRunner.release();
      }
      await resetState();
    }
    await query(`DELETE FROM seats WHERE flight_id IN (SELECT id FROM flights WHERE code = 'ZT_KEEP')`);
    await query(`DELETE FROM flights WHERE code = 'ZT_KEEP'`);
    await dataSource.destroy();
  });

  async function ageSeedBy(days: number): Promise<void> {
    await query(
      `UPDATE flights SET departure_at = departure_at - make_interval(days => $1),
                          arrival_at = arrival_at - make_interval(days => $1)
        WHERE code LIKE 'AV1%'`,
      [days]
    );
  }

  it('leaves a fresh seed alone', async () => {
    const before = await query<{ id: string }>(`SELECT id FROM flights WHERE code LIKE 'AV1%' ORDER BY code`);

    expect(await refreshDemoData(dataSource)).toBe(false);

    const after = await query<{ id: string }>(`SELECT id FROM flights WHERE code LIKE 'AV1%' ORDER BY code`);
    expect(after).toEqual(before);
  });

  it('regenerates the seed flights when they are from a previous day, keeping other flights', async () => {
    await query(
      `INSERT INTO flights (code, origin, destination, departure_at, arrival_at, price, currency, status)
       VALUES ('ZT_KEEP', 'BOG', 'MDE', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 100000, 'COP', 'ON_SALE')`
    );
    await query(
      `INSERT INTO seats (flight_id, seat_number, row_number, column_letter)
       SELECT id, '1A', 1, 'A' FROM flights WHERE code = 'ZT_KEEP'`
    );
    await ageSeedBy(2);

    expect(await refreshDemoData(dataSource)).toBe(true);

    const tomorrow = await bogotaDate(1);
    const flights = await query<{ code: string; day: string }>(
      `SELECT code, (departure_at AT TIME ZONE 'America/Bogota')::date::text AS day
         FROM flights WHERE code LIKE 'AV1%' ORDER BY code`
    );
    expect(flights).toHaveLength(7);
    expect(flights.every((flight) => flight.day >= tomorrow)).toBe(true);
    expect(await query(`SELECT 1 FROM flights WHERE code = 'ZT_KEEP'`)).toHaveLength(1);

    // Same occupancy as a brand new seed, and everything still reconciles
    const seats = await query<{ code: string; sold: string }>(
      `SELECT f.code, count(*) FILTER (WHERE s.status = 'RESERVED') AS sold
         FROM flights f JOIN seats s ON s.flight_id = f.id WHERE f.code LIKE 'AV1%' GROUP BY f.code ORDER BY f.code`
    );
    expect(seats.map((row) => Number(row.sold))).toEqual([18, 0, 24, 0, 46, 48, 46]);
    expect(await reconciliation()).toEqual(CLEAN_RECONCILIATION);
  });

  it('removes the reservations of the old seed flights, not the whole table', async () => {
    await query(
      `INSERT INTO reservations (code, flight_id, seat_number, passenger_name, passenger_email, passenger_document_type,
                                 passenger_document_number, passenger_phone, client_id, price, currency)
       SELECT 'ZZZZZ2', f.id, s.seat_number, 'Prueba', 'prueba@example.com', 'CC', '1234567', '+573001234567', 'client-x', f.price, 'COP'
         FROM flights f JOIN seats s ON s.flight_id = f.id
        WHERE f.code = 'AV102' AND s.status = 'AVAILABLE' LIMIT 1`
    );
    await query(
      `UPDATE seats SET status = 'RESERVED' WHERE (flight_id, seat_number) IN
         (SELECT flight_id, seat_number FROM reservations WHERE code = 'ZZZZZ2')`
    );
    await ageSeedBy(2);

    expect(await refreshDemoData(dataSource)).toBe(true);

    expect(await query(`SELECT 1 FROM reservations WHERE code = 'ZZZZZ2'`)).toHaveLength(0);
    expect(await reconciliation()).toEqual(CLEAN_RECONCILIATION);
  });

  it('does nothing when the seed flights were removed on purpose', async () => {
    await query(`DELETE FROM payments`);
    await query(`DELETE FROM idempotency_keys`);
    await query(`DELETE FROM reservations`);
    await query(`DELETE FROM seats WHERE flight_id IN (SELECT id FROM flights WHERE code LIKE 'AV1%')`);
    await query(`DELETE FROM flights WHERE code LIKE 'AV1%'`);

    expect(await refreshDemoData(dataSource)).toBe(false);
    expect(await query(`SELECT 1 FROM flights WHERE code LIKE 'AV1%'`)).toHaveLength(0);
  });
});
