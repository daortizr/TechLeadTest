import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dataSource } from '../../src/infraestructure/database/dataSource';
import { UnitOfWorkImpl } from '../../src/infraestructure/database/UnitOfWorkImpl';
import { FlightRepositoryImpl } from '../../src/infraestructure/outputAdapters';
import { bogotaDate, query } from './helpers';

// Flights near midnight in Bogotá (UTC-5) fall on a different calendar day in UTC. The search
// must group them by the ORIGIN AIRPORT's day, whatever time zone the database session uses.
describe('flight search: day boundaries (9.4)', () => {
  const repository = new FlightRepositoryImpl();
  const unitOfWork = new UnitOfWorkImpl(dataSource);
  const codes = ['ZT_LATE', 'ZT_EARLY', 'ZT_NEXT', 'ZT_PREV'];
  let day: string; // the day under test, a few days ahead so every flight is in the future
  let nextDay: string;
  let previousDay: string;

  async function insertFlight(code: string, localDeparture: string): Promise<void> {
    // localDeparture is a Bogotá wall-clock time, e.g. '2099-01-10 23:30'
    const [row] = await query<{ id: string }>(
      `INSERT INTO flights (code, origin, destination, departure_at, arrival_at, price_cents, currency, status)
       VALUES ($1, 'BOG', 'MDE',
               ($2::timestamp AT TIME ZONE 'America/Bogota'),
               ($2::timestamp AT TIME ZONE 'America/Bogota') + interval '1 hour',
               100000, 'COP', 'ON_SALE')
       RETURNING id`,
      [code, localDeparture]
    );
    await query(`INSERT INTO seats (flight_id, seat_number, row_number, column_letter) VALUES ($1, '1A', 1, 'A')`, [row.id]);
  }

  async function cleanUp(): Promise<void> {
    await query(`DELETE FROM seats WHERE flight_id IN (SELECT id FROM flights WHERE code = ANY($1))`, [codes]);
    await query(`DELETE FROM flights WHERE code = ANY($1)`, [codes]);
  }

  async function searchUnder(timeZone: string, date: string): Promise<string[]> {
    return unitOfWork.run(async (tx) => {
      // The session time zone must not change which day a flight belongs to
      await UnitOfWorkImpl.getManager(tx).query(`SET LOCAL TIME ZONE '${timeZone}'`);
      const results = await repository.search(tx, 'BOG', 'MDE', date);
      return results.map(({ flight }) => flight.code).filter((code) => codes.includes(code));
    });
  }

  beforeAll(async () => {
    if (!dataSource.isInitialized) await dataSource.initialize();
    day = await bogotaDate(6);
    nextDay = await bogotaDate(7);
    previousDay = await bogotaDate(5);
    await cleanUp();
    await insertFlight('ZT_PREV', `${previousDay} 23:59`); // last minute of the previous day
    await insertFlight('ZT_EARLY', `${day} 00:01`); // first minute of the day
    await insertFlight('ZT_LATE', `${day} 23:59`); // last minute of the day: already tomorrow in UTC
    await insertFlight('ZT_NEXT', `${nextDay} 00:01`); // first minute of the next day
  });

  afterAll(async () => {
    await cleanUp();
    if (dataSource.isInitialized) await dataSource.destroy();
  });

  it.each(['America/Bogota', 'UTC', 'Asia/Tokyo', 'Pacific/Auckland', 'America/Los_Angeles'])(
    'returns exactly the flights of the requested day under a %s session',
    async (timeZone) => {
      expect(await searchUnder(timeZone, day)).toEqual(['ZT_EARLY', 'ZT_LATE']);
    }
  );

  it('a flight at 23:59 in Bogotá belongs to that day, not to the next one (its UTC date)', async () => {
    expect(await searchUnder('UTC', day)).toContain('ZT_LATE');
    expect(await searchUnder('UTC', nextDay)).not.toContain('ZT_LATE');
  });

  it('a flight at 00:01 in Bogotá belongs to that day, not to the previous one', async () => {
    expect(await searchUnder('UTC', day)).toContain('ZT_EARLY');
    expect(await searchUnder('UTC', previousDay)).not.toContain('ZT_EARLY');
  });

  it('the neighbouring days each get only their own flights', async () => {
    expect(await searchUnder('UTC', previousDay)).toEqual(['ZT_PREV']);
    expect(await searchUnder('UTC', nextDay)).toEqual(['ZT_NEXT']);
  });
});
