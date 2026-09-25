import { defineWorkspace } from 'vitest/config';

// Scaffold tests written against the previous, incompatible contracts (mocks and fake ids).
// Superseded by the suites below; pending removal.
const OBSOLETE_TESTS = [
  'tests/unit/CreateReservation.test.ts',
  'tests/integration/ConcurrentReservations.test.ts',
  'tests/integration/EventPublishing.test.ts',
  'tests/integration/Idempotency.test.ts',
  'tests/integration/ReservationFlow.test.ts'
];

// Unit tests need no database. Integration tests run against real PostgreSQL, in their own
// schema (flight_test), one file at a time because they share it.
export default defineWorkspace([
  {
    test: {
      name: 'unit',
      environment: 'node',
      globals: true,
      include: ['tests/unit/**/*.test.ts'],
      exclude: OBSOLETE_TESTS
    }
  },
  {
    test: {
      name: 'integration',
      environment: 'node',
      globals: true,
      include: ['tests/integration/**/*.test.ts'],
      exclude: OBSOLETE_TESTS,
      globalSetup: ['tests/integration/globalSetup.ts'],
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
      testTimeout: 30000,
      hookTimeout: 60000,
      env: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DB_SCHEMA: 'flight_test',
        ADMIN_KEY: 'test-admin-key',
        HEARTBEAT_INTERVAL_MS: '200',
        PAYMENT_LATENCY_MS: '0'
      }
    }
  }
]);
