import { dataSource } from './dataSource';
import { CreateTables1700000000000 } from './migrations/1000_CreateTables';
import { SeedData1700000000001 } from './migrations/1001_SeedData';
import { logger } from '../utilities';

// Only this project's tables: the database may be shared, so nothing else is touched
const OWN_TABLES = ['payments', 'idempotency_keys', 'reservations', 'seats', 'flights', 'airports'];
const OWN_MIGRATIONS = [CreateTables1700000000000.name, SeedData1700000000001.name];

// `npm run db:reset`: drops this project's tables and reruns the migrations, which recreates the seed
async function reset(): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.query(`DROP TABLE IF EXISTS ${OWN_TABLES.join(', ')} CASCADE`);

    const rows: { table_name: string | null }[] = await dataSource.query(`SELECT to_regclass('migrations') AS table_name`);
    if (rows[0].table_name) {
      await dataSource.query('DELETE FROM migrations WHERE name = ANY($1)', [OWN_MIGRATIONS]);
    }

    await dataSource.runMigrations();
    logger.info('Database reset and seeded');
  } finally {
    await dataSource.destroy();
  }
}

reset().catch((error: unknown) => {
  logger.error('Database reset failed', { error: String(error) });
  process.exit(1);
});
