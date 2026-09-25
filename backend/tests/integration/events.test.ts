import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  ADMIN_HEADERS,
  EventStream,
  TestServer,
  flightId,
  newClientId,
  openEventStream,
  query,
  resetState,
  startServer,
  stopServer
} from './helpers';

describe('server-sent events (8)', () => {
  let server: TestServer;
  let stream: EventStream;
  let av102: string;

  const lock = (seat: string, client: string) =>
    server.api.post(`/api/flights/${av102}/seats/${seat}/lock`).set('X-Client-Id', client);

  beforeAll(async () => {
    server = await startServer();
    server.container.sseHub.start(); // HEARTBEAT_INTERVAL_MS is 200 in tests
    av102 = await flightId('AV102');
  });
  afterAll(async () => {
    await stopServer(server);
  });
  beforeEach(async () => {
    await resetState();
    stream = await openEventStream(server.port);
  });
  afterEach(() => {
    stream.close();
  });

  it('answers with the SSE headers and an immediate heartbeat', async () => {
    expect(stream.headers['content-type']).toContain('text/event-stream');
    expect(stream.headers['cache-control']).toBe('no-cache');
    expect(stream.headers['x-accel-buffering']).toBe('no');
    expect(stream.headers['content-encoding']).toBeUndefined();
    await stream.waitFor((e) => e.event === 'heartbeat');
  });

  it('keeps sending named heartbeat events', async () => {
    await stream.waitFor((e) => e.event === 'heartbeat');
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(stream.events.filter((e) => e.event === 'heartbeat').length).toBeGreaterThanOrEqual(2);
  });

  it('emits seat.locked with the version and expiry after the lock commits', async () => {
    const client = newClientId();
    const response = await lock('1A', client);

    const event = await stream.waitFor((e) => e.event === 'seat.locked' && e.data.seat === '1A');
    expect(event.data).toEqual({
      type: 'seat.locked',
      flightId: av102,
      seat: '1A',
      version: 1,
      lockedUntil: response.body.lockedUntil
    });
  });

  it('never exposes who holds a seat or any passenger data in any event', async () => {
    const client = newClientId();
    await lock('1A', client);
    await server.api.post(`/api/flights/${av102}/seats/1A/checkout`).set('X-Client-Id', client);
    await stream.waitFor((e) => e.event === 'seat.locked' && e.data.version === 2);

    const text = JSON.stringify(stream.events);
    expect(text).not.toContain(client);
    expect(text).not.toMatch(/locked_?by|clientId|email|phone|document/i);
  });

  it('moving to another seat emits seat.released (RELEASED) then seat.locked', async () => {
    const client = newClientId();
    await lock('2A', client);
    await lock('2B', client);

    const released = await stream.waitFor((e) => e.event === 'seat.released' && e.data.seat === '2A');
    expect(released.data).toEqual(expect.objectContaining({ reason: 'RELEASED', flightId: av102 }));
    await stream.waitFor((e) => e.event === 'seat.locked' && e.data.seat === '2B');
    const order = stream.events.filter((e) => e.event !== 'heartbeat').map((e) => `${e.event}:${e.data.seat}`);
    expect(order.indexOf('seat.released:2A')).toBeLessThan(order.indexOf('seat.locked:2B'));
  });

  it('unlock emits seat.released (RELEASED); an idempotent unlock emits nothing', async () => {
    const client = newClientId();
    await lock('3A', client);
    await server.api.delete(`/api/flights/${av102}/seats/3A/lock`).set('X-Client-Id', client);
    await stream.waitFor((e) => e.event === 'seat.released' && e.data.seat === '3A');

    const before = stream.events.filter((e) => e.event === 'seat.released').length;
    await server.api.delete(`/api/flights/${av102}/seats/3A/lock`).set('X-Client-Id', client);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stream.events.filter((e) => e.event === 'seat.released')).toHaveLength(before);
  });

  it('a failed lock emits nothing', async () => {
    await lock('4A', newClientId());
    await stream.waitFor((e) => e.event === 'seat.locked' && e.data.seat === '4A');
    const before = stream.events.filter((e) => e.event === 'seat.locked').length;

    const failed = await lock('4A', newClientId());
    expect(failed.status).toBe(409);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stream.events.filter((e) => e.event === 'seat.locked')).toHaveLength(before);
  });

  it('the expiration job emits seat.released (EXPIRED)', async () => {
    await lock('5A', newClientId());
    await query(`UPDATE seats SET locked_until = now() - interval '1 second' WHERE flight_id = $1 AND seat_number = '5A'`, [av102]);

    await server.container.expireLocks.execute();

    const event = await stream.waitFor((e) => e.event === 'seat.released' && e.data.seat === '5A');
    expect(event.data).toEqual(expect.objectContaining({ reason: 'EXPIRED', version: 2 }));
  });

  it('every event of a purchase carries a strictly increasing version per seat', async () => {
    const client = newClientId();
    await lock('6A', client);
    await server.api.post(`/api/flights/${av102}/seats/6A/checkout`).set('X-Client-Id', client);
    await server.api
      .post('/api/reservations')
      .set('X-Client-Id', client)
      .set('Idempotency-Key', 'purchase-events-1')
      .send({
        flightId: av102,
        seat: '6A',
        passenger: {
          fullName: 'Ana Gómez',
          email: 'ana@example.com',
          documentType: 'CC',
          documentNumber: '1000200300',
          phone: '+573001234567'
        },
        payment: { holderName: 'ANA GOMEZ', cardNumber: '4111111111111111', expiry: '12/99', cvv: '123' }
      });

    await stream.waitFor((e) => e.event === 'seat.reserved' && e.data.seat === '6A');
    const versions = stream.events
      .filter((e) => e.data.seat === '6A')
      .map((e) => e.data.version as number);
    expect(versions).toEqual([1, 2, 3]); // lock, checkout, reserved
  });

  describe('admin cancellation', () => {
    it('cancels an ON_SALE flight, answers with it and emits flight.updated', async () => {
      const response = await server.api.post(`/api/admin/flights/${av102}/cancel`).set(ADMIN_HEADERS);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({ id: av102, status: 'CANCELLED', version: 1 }));
      const event = await stream.waitFor((e) => e.event === 'flight.updated' && e.data.flightId === av102);
      expect(event.data).toEqual({ type: 'flight.updated', flightId: av102, status: 'CANCELLED', availableSeats: 0, version: 1 });
    });

    it('cancelling again is an invalid transition and emits nothing', async () => {
      await server.api.post(`/api/admin/flights/${av102}/cancel`).set(ADMIN_HEADERS);
      const again = await server.api.post(`/api/admin/flights/${av102}/cancel`).set(ADMIN_HEADERS);

      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('INVALID_TRANSITION');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(stream.events.filter((e) => e.event === 'flight.updated')).toHaveLength(1);
    });

    it('401 without the key, 404 for an unknown flight', async () => {
      expect((await server.api.post(`/api/admin/flights/${av102}/cancel`)).status).toBe(401);
      const unknown = await server.api
        .post('/api/admin/flights/00000000-0000-4000-8000-000000000000/cancel')
        .set(ADMIN_HEADERS);
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.code).toBe('FLIGHT_NOT_FOUND');
    });

    it('after cancelling, seats can no longer be locked or bought', async () => {
      await server.api.post(`/api/admin/flights/${av102}/cancel`).set(ADMIN_HEADERS);
      const response = await lock('1A', newClientId());
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('FLIGHT_NOT_BOOKABLE');
    });
  });
});
