import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  ADMIN_KEY: z.string(),
  LOCK_TTL_SECONDS: z.coerce.number().default(300),
  CHECKOUT_TTL_SECONDS: z.coerce.number().default(300),
  PAYMENT_MARGIN_SECONDS: z.coerce.number().default(10),
  EXPIRATION_JOB_INTERVAL_MS: z.coerce.number().default(1000),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().default(25000),
  PAYMENT_LATENCY_MS: z.coerce.number().default(0)
});

export type Env = z.infer<typeof envSchema>;

export const config: Env = envSchema.parse(process.env);
