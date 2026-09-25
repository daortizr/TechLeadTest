import dotenv from 'dotenv';

dotenv.config();

function databaseUsesSsl(): boolean {
  const raw = process.env.DB_SSL?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  return false;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.SERVER_PORT) || 3000,
  adminKey: process.env.ADMIN_KEY!,
  dbHost: process.env.DB_HOST ?? 'localhost',
  dbPort: Number(process.env.DB_PORT) || 5432,
  dbUserName: process.env.DB_USER ?? 'postgres',
  dbPassword: process.env.DB_PASSWORD ?? 'postgres',
  dbName: process.env.DB_NAME ?? 'postgres',
  dbSchema: process.env.DB_SCHEMA ?? 'public',
  dbUsesSsl: databaseUsesSsl(),
  lockTtlSeconds: Number(process.env.LOCK_TTL_SECONDS) || 300,
  checkoutTtlSeconds: Number(process.env.CHECKOUT_TTL_SECONDS) || 300,
  paymentMarginSeconds: Number(process.env.PAYMENT_MARGIN_SECONDS) || 10,
  expirationJobIntervalMs: Number(process.env.EXPIRATION_JOB_INTERVAL_MS) || 1000,
  heartbeatIntervalMs: Number(process.env.HEARTBEAT_INTERVAL_MS) || 25000,
  paymentLatencyMs: Number(process.env.PAYMENT_LATENCY_MS) || 0
};

export type Env = typeof config;
