import { DataSource } from 'typeorm';
import { logger } from '../utilities';
import { FLIGHT_CODES, removeSeedFlights, seedDemoData } from './seed/demoSeed';

// Arbitrary constant: serializes the refresh if two instances start at the same time
const REFRESH_LOCK_KEY = 4_120_260_101;

// The seed dates are relative to the day it ran, so a database kept from a previous day has its
// demo flights in the past and the default search ("tomorrow") comes back empty. On startup, if the
// earliest seed flight departs before the start of tomorrow (Bogotá), the seed flights (and only
// those, with their reservations) are replaced by a fresh set. Flights created any other way stay.
// Returns true when the demo data was regenerated.
export async function refreshDemoData(dataSource: DataSource): Promise<boolean> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    await queryRunner.startTransaction();
    await queryRunner.query('SELECT pg_advisory_xact_lock($1)', [REFRESH_LOCK_KEY]);

    const rows: { stale: boolean | null }[] = await queryRunner.query(
      `SELECT min(departure_at) < (date_trunc('day', now() AT TIME ZONE 'America/Bogota') + interval '1 day') AT TIME ZONE 'America/Bogota' AS stale
         FROM flights
        WHERE code = ANY($1)`,
      [FLIGHT_CODES]
    );

    // null: there are no seed flights (they were removed on purpose), so there is nothing to refresh
    if (rows[0].stale !== true) {
      await queryRunner.rollbackTransaction();
      return false;
    }

    await removeSeedFlights(queryRunner);
    await seedDemoData(queryRunner);
    await queryRunner.commitTransaction();
    logger.info('Demo data was from a previous day and has been regenerated');
    return true;
  } catch (error) {
    if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
