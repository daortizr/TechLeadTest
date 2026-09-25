import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import {
  TestServer,
  bogotaDate,
  flightId,
  newClientId,
  query,
  resetState,
  startServer,
  stopServer
} from './helpers';

describe('read endpoints', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startServer();
  });
  afterAll(async () => {
    await stopServer(server);
  });
  beforeEach(async () => {
    await resetState();
  });

  describe('GET /api/health and /api/airports', () => {
    it('health reports ok when the database answers', async () => {
      const response = await server.api.get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });

    it('lists the six seeded airports', async () => {
      const response = await server.api.get('/api/airports');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(6);
      expect(response.body.map((a: { code: string }) => a.code).sort()).toEqual(
        ['BAQ', 'BGA', 'BOG', 'CLO', 'CTG', 'MDE']
      );
      expect(response.body[0]).toEqual(
        expect.objectContaining({ code: expect.any(String), name: expect.any(String), city: expect.any(String), timezone: 'America/Bogota' })
      );
    });
  });

  describe('GET /api/flights (9.4)', () => {
    it('finds the three Bogotá-Medellín flights of tomorrow with their availability', async () => {
      const date = await bogotaDate(1);
      const response = await server.api.get('/api/flights').query({ origin: 'bog', destination: 'MDE', date });

      expect(response.status).toBe(200);
      expect(response.body.map((f: { code: string }) => f.code)).toEqual(['AV101', 'AV102', 'AV103']);
      expect(response.body.map((f: { availableSeats: number }) => f.availableSeats)).toEqual([30, 48, 24]);
      expect(response.body.every((f: { totalSeats: number }) => f.totalSeats === 48)).toBe(true);
      // 06:30 in Bogotá (UTC-5)
      expect(response.body[0].departureAt).toMatch(/T11:30:00\.000Z$/);
    });

    it('also returns flights that cannot be booked, with their status', async () => {
      const date = await bogotaDate(1);
      const response = await server.api.get('/api/flights').query({ origin: 'BOG', destination: 'CLO', date });

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual(expect.objectContaining({ code: 'AV106', status: 'SOLD_OUT', availableSeats: 0 }));
    });

    it('counts an expired lock as available', async () => {
      const id = await flightId('AV102');
      await query(
        `UPDATE seats SET status = 'BLOCKED', locked_by = 'someone', locked_until = now() - interval '1 minute'
         WHERE flight_id = $1 AND seat_number = '1A'`,
        [id]
      );
      const response = await server.api
        .get('/api/flights')
        .query({ origin: 'BOG', destination: 'MDE', date: await bogotaDate(1) });
      const av102 = response.body.find((f: { code: string }) => f.code === 'AV102');
      expect(av102.availableSeats).toBe(48);
    });

    it('returns an empty list when nothing flies that day', async () => {
      const response = await server.api
        .get('/api/flights')
        .query({ origin: 'BOG', destination: 'MDE', date: await bogotaDate(30) });
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it.each([
      ['missing filters', {}],
      ['same origin and destination', { origin: 'BOG', destination: 'BOG', date: '2099-01-01' }],
      ['malformed date', { origin: 'BOG', destination: 'MDE', date: '25-09-2026' }],
      ['impossible date', { origin: 'BOG', destination: 'MDE', date: '2099-02-30' }],
      ['long airport code', { origin: 'BOGOTA', destination: 'MDE', date: '2099-01-01' }]
    ])('400 INVALID_REQUEST for %s', async (_name, params) => {
      const response = await server.api.get('/api/flights').query(params);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });

    it('400 for a date before today in the origin airport time zone', async () => {
      const response = await server.api
        .get('/api/flights')
        .query({ origin: 'BOG', destination: 'MDE', date: await bogotaDate(-1) });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });

    it('400 for an unknown airport', async () => {
      const response = await server.api
        .get('/api/flights')
        .query({ origin: 'ZZZ', destination: 'MDE', date: await bogotaDate(1) });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/flights/:id/seats (8.3)', () => {
    it('returns the map with counts and the server time, without X-Client-Id', async () => {
      const response = await server.api.get(`/api/flights/${await flightId('AV102')}/seats`);

      expect(response.status).toBe(200);
      expect(response.body.counts).toEqual({ available: 48, blocked: 0, reserved: 0, total: 48 });
      expect(response.body.seats).toHaveLength(48);
      expect(response.body.seats[0].seatNumber).toBe('1A');
      expect(response.body.seats.every((s: { mine: boolean }) => s.mine === false)).toBe(true);
      expect(new Date(response.body.serverTime).getTime()).not.toBeNaN();
      expect(response.body.flight).toEqual(expect.objectContaining({ code: 'AV102', availableSeats: 48, totalSeats: 48 }));
    });

    it('reflects the seeded occupancy', async () => {
      const response = await server.api.get(`/api/flights/${await flightId('AV105')}/seats`);
      expect(response.body.counts).toEqual({ available: 2, blocked: 0, reserved: 46, total: 48 });
    });

    it('treats an expired lock as available and never exposes who holds a seat', async () => {
      const id = await flightId('AV102');
      const owner = newClientId();
      await query(
        `UPDATE seats SET status = 'BLOCKED', locked_by = $2, locked_until = now() + interval '5 minutes'
         WHERE flight_id = $1 AND seat_number = '1A'`,
        [id, owner]
      );
      await query(
        `UPDATE seats SET status = 'BLOCKED', locked_by = 'gone', locked_until = now() - interval '1 minute'
         WHERE flight_id = $1 AND seat_number = '1B'`,
        [id]
      );

      const anonymous = await server.api.get(`/api/flights/${id}/seats`);
      const seat = (n: string) => anonymous.body.seats.find((s: { seatNumber: string }) => s.seatNumber === n);
      expect(seat('1A')).toEqual(expect.objectContaining({ status: 'BLOCKED', mine: false }));
      expect(seat('1A').lockedUntil).toBeDefined();
      expect(seat('1B').status).toBe('AVAILABLE');
      expect(seat('1B').lockedUntil).toBeUndefined();
      expect(anonymous.body.counts).toEqual({ available: 47, blocked: 1, reserved: 0, total: 48 });
      expect(JSON.stringify(anonymous.body)).not.toContain(owner);
      expect(JSON.stringify(anonymous.body)).not.toMatch(/locked_?by/i);

      const asOwner = await server.api.get(`/api/flights/${id}/seats`).set('X-Client-Id', owner);
      expect(asOwner.body.seats.find((s: { seatNumber: string }) => s.seatNumber === '1A').mine).toBe(true);
    });

    it('404 FLIGHT_NOT_FOUND for an unknown flight', async () => {
      const response = await server.api.get(`/api/flights/${randomUUID()}/seats`);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('FLIGHT_NOT_FOUND');
    });

    it('400 for a malformed flight id or client id', async () => {
      expect((await server.api.get('/api/flights/not-a-uuid/seats')).status).toBe(400);
      const bad = await server.api.get(`/api/flights/${await flightId('AV102')}/seats`).set('X-Client-Id', 'nope');
      expect(bad.status).toBe(400);
    });
  });

  describe('GET /api/reservations/:code', () => {
    it('404 RESERVATION_NOT_FOUND for an unknown code', async () => {
      const response = await server.api.get('/api/reservations/ABC234');
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('RESERVATION_NOT_FOUND');
    });

    it('shows a seeded ticket with the flight and only the passenger name', async () => {
      const [row] = await query<{ code: string }>(`SELECT code FROM reservations LIMIT 1`);
      const response = await server.api.get(`/api/reservations/${row.code.toLowerCase()}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        code: row.code,
        flight: expect.objectContaining({ id: expect.any(String), status: expect.any(String) }),
        seat: expect.any(String),
        passengerName: expect.stringMatching(/^Pasajero /),
        price: expect.any(Number),
        currency: 'COP',
        createdAt: expect.any(String)
      });
      const text = JSON.stringify(response.body);
      expect(text).not.toMatch(/@example\.com/);
      expect(text).not.toMatch(/\+57300/);
      expect(text).not.toMatch(/1000000\d+/);
    });
  });

  describe('protocol errors', () => {
    it('unknown routes answer 404 in the standard format', async () => {
      const response = await server.api.get('/api/nope');
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('a malformed JSON body answers 400 INVALID_REQUEST', async () => {
      const response = await server.api
        .post('/api/reservations')
        .set('X-Client-Id', newClientId())
        .set('Idempotency-Key', 'k-1')
        .set('Content-Type', 'application/json')
        .send('{"broken":');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });
  });
});
