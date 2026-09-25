import { Client } from 'pg';

const TEST_SCHEMA = 'flight_test';

// The tests own this schema and nothing else: the database may be shared with other projects.
async function withAdminClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'postgres'
  });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export async function setup(): Promise<void> {
  process.env.DB_SCHEMA = TEST_SCHEMA;
  // Loads backend/.env (credentials) into process.env without overriding DB_SCHEMA
  await import('dotenv').then((dotenv) => dotenv.config());

  await withAdminClient(async (client) => {
    await client.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
  });

  // Migrations create the tables and the seed inside the test schema
  const { dataSource } = await import('../../src/infraestructure/database/dataSource');
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}

export async function teardown(): Promise<void> {
  await withAdminClient((client) => client.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`));
}
