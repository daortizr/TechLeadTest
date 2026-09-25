import http from 'http';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { dataSource } from '../../src/infraestructure/database/dataSource';
import { buildContainer, Container } from '../../src/infraestructure/config/container';
import { createApp } from '../../src/app';

export const ADMIN_HEADERS = { 'X-Admin-Key': 'test-admin-key' };

export interface TestServer {
  container: Container;
  server: http.Server;
  port: number;
  api: ReturnType<typeof request>;
}

export async function startServer(): Promise<TestServer> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  const container = buildContainer(dataSource);
  const server = createApp(container).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  return { container, server, port, api: request(server) };
}

export async function stopServer(testServer: TestServer): Promise<void> {
  testServer.container.sseHub.stop();
  await new Promise<void>((resolve) => testServer.server.close(() => resolve()));
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}

export function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return dataSource.query(sql, params);
}

export function newClientId(): string {
  return randomUUID();
}

// Back to the seeded state, keeping only what the migrations created
export async function resetState(): Promise<void> {
  await query(`DELETE FROM payments`);
  await query(`DELETE FROM idempotency_keys WHERE client_id NOT LIKE 'seed-client-%'`);
  await query(`DELETE FROM reservations WHERE client_id NOT LIKE 'seed-client-%'`);
  await query(
    `UPDATE seats s
     SET status = 'AVAILABLE', locked_by = NULL, locked_until = NULL, checkout_started_at = NULL, version = 0
     WHERE s.status <> 'AVAILABLE'
       AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.flight_id = s.flight_id AND r.seat_number = s.seat_number)`
  );
  await query(`UPDATE seats SET version = 0`);
  await query(`UPDATE flights SET status = CASE WHEN code = 'AV106' THEN 'SOLD_OUT' ELSE 'ON_SALE' END, version = 0`);
  // The seed's payments were removed above: recreate them so seeded reservations stay reconciled
  await query(
    `INSERT INTO payments (idempotency_key, reservation_id, authorization_ref, amount, status)
     SELECT ik.key, r.id, 'SEED-' || r.id, r.price, 'AUTHORIZED'
     FROM reservations r JOIN idempotency_keys ik ON ik.reservation_id = r.id`
  );
}

export async function flightId(code: string): Promise<string> {
  const rows = await query<{ id: string }>(`SELECT id FROM flights WHERE code = $1`, [code]);
  return rows[0].id;
}

export async function freeSeats(code: string, count: number): Promise<string[]> {
  const rows = await query<{ seat_number: string }>(
    `SELECT s.seat_number FROM seats s JOIN flights f ON f.id = s.flight_id
     WHERE f.code = $1 AND s.status = 'AVAILABLE' ORDER BY s.row_number, s.column_letter LIMIT $2`,
    [code, count]
  );
  return rows.map((row) => row.seat_number);
}

export async function reservedSeat(code: string): Promise<string> {
  const rows = await query<{ seat_number: string }>(
    `SELECT s.seat_number FROM seats s JOIN flights f ON f.id = s.flight_id
     WHERE f.code = $1 AND s.status = 'RESERVED' ORDER BY s.row_number, s.column_letter LIMIT 1`,
    [code]
  );
  return rows[0].seat_number;
}

// Today + offset, in Bogotá, according to the database clock
export async function bogotaDate(daysFromToday: number): Promise<string> {
  const rows = await query<{ day: string }>(
    `SELECT (((now() AT TIME ZONE 'America/Bogota')::date) + $1::int)::text AS day`,
    [daysFromToday]
  );
  return rows[0].day;
}

// The reconciliation checks of 5.3: after any test, every count must be zero
export async function reconciliation(): Promise<Record<string, number>> {
  const count = async (sql: string): Promise<number> => Number((await query<{ n: string }>(sql))[0].n);
  return {
    reservedSeatsWithoutReservation: await count(
      `SELECT count(*) AS n FROM seats s WHERE s.status = 'RESERVED'
       AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.flight_id = s.flight_id AND r.seat_number = s.seat_number)`
    ),
    reservationsWithoutReservedSeat: await count(
      `SELECT count(*) AS n FROM reservations r JOIN seats s ON s.flight_id = r.flight_id AND s.seat_number = r.seat_number
       WHERE s.status <> 'RESERVED'`
    ),
    inconsistentFlightStatus: await count(
      `SELECT count(*) AS n FROM flights f WHERE f.status <> 'CANCELLED' AND (
         (f.status = 'SOLD_OUT' AND EXISTS (SELECT 1 FROM seats s WHERE s.flight_id = f.id AND s.status <> 'RESERVED'))
         OR (f.status = 'ON_SALE' AND NOT EXISTS (SELECT 1 FROM seats s WHERE s.flight_id = f.id AND s.status <> 'RESERVED')))`
    ),
    orphanCharges: await count(
      `SELECT count(*) AS n FROM payments WHERE (status = 'AUTHORIZED' AND reservation_id IS NULL) OR status = 'VOID_FAILED'`
    ),
    staleInProgressKeys: await count(
      `SELECT count(*) AS n FROM idempotency_keys WHERE status = 'IN_PROGRESS' AND created_at < now() - interval '60 seconds'`
    )
  };
}

export const CLEAN_RECONCILIATION = {
  reservedSeatsWithoutReservation: 0,
  reservationsWithoutReservedSeat: 0,
  inconsistentFlightStatus: 0,
  orphanCharges: 0,
  staleInProgressKeys: 0
};

export interface ReceivedEvent {
  event: string;
  data: Record<string, unknown>;
}

export interface EventStream {
  events: ReceivedEvent[];
  headers: http.IncomingHttpHeaders;
  waitFor(predicate: (event: ReceivedEvent) => boolean, timeoutMs?: number): Promise<ReceivedEvent>;
  close(): void;
}

// Minimal SSE reader over a real connection to GET /api/events
export function openEventStream(port: number): Promise<EventStream> {
  return new Promise((resolve, reject) => {
    const events: ReceivedEvent[] = [];
    const waiters: { predicate: (event: ReceivedEvent) => boolean; resolve: (event: ReceivedEvent) => void }[] = [];
    let buffer = '';

    const request_ = http.get({ host: '127.0.0.1', port, path: '/api/events' }, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        buffer += chunk;
        let separator = buffer.indexOf('\n\n');
        while (separator !== -1) {
          const block = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          separator = buffer.indexOf('\n\n');

          const event = /^event: (.*)$/m.exec(block)?.[1];
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (!event || data === undefined) continue;

          const received: ReceivedEvent = { event, data: JSON.parse(data) as Record<string, unknown> };
          events.push(received);
          for (const waiter of [...waiters]) {
            if (waiter.predicate(received)) {
              waiters.splice(waiters.indexOf(waiter), 1);
              waiter.resolve(received);
            }
          }
        }
      });

      resolve({
        events,
        headers: response.headers,
        waitFor(predicate, timeoutMs = 3000) {
          const existing = events.find(predicate);
          if (existing) return Promise.resolve(existing);
          return new Promise((resolveWait, rejectWait) => {
            const timer = setTimeout(() => rejectWait(new Error('Timed out waiting for an SSE event')), timeoutMs);
            waiters.push({
              predicate,
              resolve: (event) => {
                clearTimeout(timer);
                resolveWait(event);
              }
            });
          });
        },
        close() {
          request_.destroy();
        }
      });
    });
    request_.on('error', reject);
  });
}
