import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import {
  ADMIN_HEADERS,
  CLEAN_RECONCILIATION,
  TestServer,
  flightId,
  freeSeats,
  newClientId,
  query,
  reconciliation,
  reservedSeat,
  resetState,
  startServer,
  stopServer
} from './helpers';

describe('seat locking (7.1, 7.2, 7.4)', () => {
  let server: TestServer;
  let av102: string;

  const lock = (id: string, seat: string, client: string) =>
    server.api.post(`/api/flights/${id}/seats/${seat}/lock`).set('X-Client-Id', client);
  const unlock = (id: string, seat: string, client: string) =>
    server.api.delete(`/api/flights/${id}/seats/${seat}/lock`).set('X-Client-Id', client);
  const checkout = (id: string, seat: string, client: string) =>
    server.api.post(`/api/flights/${id}/seats/${seat}/checkout`).set('X-Client-Id', client);
  const seatRow = async (id: string, seat: string) =>
    (await query<{ status: string; locked_by: string | null; version: number; checkout_started_at: Date | null }>(
      `SELECT status, locked_by, version, checkout_started_at FROM seats WHERE flight_id = $1 AND seat_number = $2`,
      [id, seat]
    ))[0];

  beforeAll(async () => {
    server = await startServer();
    av102 = await flightId('AV102');
  });
  afterAll(async () => {
    await stopServer(server);
  });
  beforeEach(async () => {
    await resetState();
  });

  describe('lock', () => {
    it('blocks a free seat for LOCK_TTL_SECONDS and bumps its version', async () => {
      const client = newClientId();
      const response = await lock(av102, '1A', client);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ seat: '1A', lockedUntil: expect.any(String), version: 1 });
      const seconds = (new Date(response.body.lockedUntil).getTime() - Date.now()) / 1000;
      expect(seconds).toBeGreaterThan(280);
      expect(seconds).toBeLessThanOrEqual(305);
      expect(await seatRow(av102, '1A')).toEqual(expect.objectContaining({ status: 'BLOCKED', locked_by: client }));
    });

    it('only one of many simultaneous clients wins the same seat', async () => {
      const clients = Array.from({ length: 25 }, () => newClientId());
      const responses = await Promise.all(clients.map((client) => lock(av102, '2B', client)));

      const winners = responses.filter((r) => r.status === 200);
      const losers = responses.filter((r) => r.status === 409);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(24);
      expect(losers.every((r) => r.body.error.code === 'SEAT_LOCKED')).toBe(true);
      // The loser learns when the seat frees up, but never who holds it
      expect(losers[0].body.error.details.lockedUntil).toBe(winners[0].body.lockedUntil);
      expect(JSON.stringify(losers[0].body)).not.toMatch(/locked_?by/i);

      const [seat] = await query<{ count: string }>(
        `SELECT count(*) FROM seats WHERE flight_id = $1 AND seat_number = '2B' AND status = 'BLOCKED'`,
        [av102]
      );
      expect(Number(seat.count)).toBe(1);
      expect((await seatRow(av102, '2B')).version).toBe(1); // bumped once, by the winner only
      expect(await reconciliation()).toEqual(CLEAN_RECONCILIATION);
    });

    it('repeating the lock is idempotent and keeps the original expiry', async () => {
      const client = newClientId();
      const first = await lock(av102, '3C', client);
      const second = await lock(av102, '3C', client);

      expect(second.status).toBe(200);
      expect(second.body.lockedUntil).toBe(first.body.lockedUntil);
      expect(second.body.version).toBe(first.body.version);
    });

    it('moving to another seat releases the previous one (one lock per client and flight)', async () => {
      const client = newClientId();
      await lock(av102, '4A', client);
      const moved = await lock(av102, '4B', client);

      expect(moved.status).toBe(200);
      expect((await seatRow(av102, '4A')).status).toBe('AVAILABLE');
      expect(await seatRow(av102, '4B')).toEqual(expect.objectContaining({ status: 'BLOCKED', locked_by: client }));
    });

    it('a client racing for two seats of one flight ends with exactly one lock and no server error', async () => {
      const client = newClientId();
      const responses = await Promise.all([lock(av102, '5A', client), lock(av102, '5B', client)]);

      expect(responses.some((r) => r.status === 200)).toBe(true);
      expect(responses.every((r) => r.status === 200 || r.status === 409)).toBe(true);
      const [held] = await query<{ count: string }>(
        `SELECT count(*) FROM seats WHERE flight_id = $1 AND locked_by = $2 AND status = 'BLOCKED'`,
        [av102, client]
      );
      expect(Number(held.count)).toBe(1);
    });

    it('a failed move restores the previous seat (rollback)', async () => {
      const first = newClientId();
      const second = newClientId();
      await lock(av102, '6A', first);
      await lock(av102, '6B', second);

      const failed = await lock(av102, '6B', first);
      expect(failed.status).toBe(409);
      expect(failed.body.error.code).toBe('SEAT_LOCKED');
      expect(await seatRow(av102, '6A')).toEqual(expect.objectContaining({ status: 'BLOCKED', locked_by: first }));
    });

    it('an expired lock is free for anyone, without waiting for the job', async () => {
      await lock(av102, '7A', newClientId());
      await query(
        `UPDATE seats SET locked_until = now() - interval '1 second' WHERE flight_id = $1 AND seat_number = '7A'`,
        [av102]
      );

      const taker = newClientId();
      const response = await lock(av102, '7A', taker);
      expect(response.status).toBe(200);
      expect((await seatRow(av102, '7A')).locked_by).toBe(taker);
    });

    it('409 SEAT_RESERVED for a sold seat', async () => {
      const av101 = await flightId('AV101');
      const response = await lock(av101, await reservedSeat('AV101'), newClientId());
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('SEAT_RESERVED');
    });

    it('409 FLIGHT_NOT_BOOKABLE for a sold-out flight, ahead of SEAT_RESERVED', async () => {
      const av106 = await flightId('AV106');
      const response = await lock(av106, await reservedSeat('AV106'), newClientId());
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('FLIGHT_NOT_BOOKABLE');
    });

    it('409 FLIGHT_NOT_BOOKABLE for a cancelled flight and for one that already left', async () => {
      await query(`UPDATE flights SET status = 'CANCELLED' WHERE id = $1`, [av102]);
      expect((await lock(av102, '8A', newClientId())).body.error.code).toBe('FLIGHT_NOT_BOOKABLE');

      const av104 = await flightId('AV104');
      const [original] = await query<{ departure_at: Date; arrival_at: Date }>(
        `SELECT departure_at, arrival_at FROM flights WHERE id = $1`,
        [av104]
      );
      try {
        await query(
          `UPDATE flights SET departure_at = now() - interval '2 hours', arrival_at = now() - interval '1 hour' WHERE id = $1`,
          [av104]
        );
        expect((await lock(av104, '8A', newClientId())).body.error.code).toBe('FLIGHT_NOT_BOOKABLE');
      } finally {
        await query(`UPDATE flights SET departure_at = $2, arrival_at = $3 WHERE id = $1`, [
          av104,
          original.departure_at,
          original.arrival_at
        ]);
      }
    });

    it('404 SEAT_NOT_FOUND for a seat or flight that does not exist', async () => {
      expect((await lock(av102, '99Z', newClientId())).body.error.code).toBe('SEAT_NOT_FOUND');
      const unknownFlight = await lock(randomUUID(), '1A', newClientId());
      expect(unknownFlight.status).toBe(404);
      expect(unknownFlight.body.error.code).toBe('SEAT_NOT_FOUND');
    });

    it('400 without X-Client-Id, with a malformed one or with a malformed seat', async () => {
      expect((await server.api.post(`/api/flights/${av102}/seats/1A/lock`)).status).toBe(400);
      expect((await lock(av102, '1A', 'not-a-uuid')).status).toBe(400);
      expect((await lock(av102, 'A1', newClientId())).status).toBe(400);
    });
  });

  describe('unlock', () => {
    it('releases my own lock with 204', async () => {
      const client = newClientId();
      await lock(av102, '1A', client);
      const response = await unlock(av102, '1A', client);

      expect(response.status).toBe(204);
      expect(await seatRow(av102, '1A')).toEqual(expect.objectContaining({ status: 'AVAILABLE', locked_by: null }));
    });

    it("403 LOCK_NOT_OWNED on someone else's active lock, which stays untouched", async () => {
      const owner = newClientId();
      await lock(av102, '1A', owner);
      const response = await unlock(av102, '1A', newClientId());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('LOCK_NOT_OWNED');
      expect((await seatRow(av102, '1A')).locked_by).toBe(owner);
    });

    it('is idempotent: 204 when the seat is already free or the lock expired', async () => {
      const client = newClientId();
      expect((await unlock(av102, '1A', client)).status).toBe(204);

      await lock(av102, '1A', client);
      await unlock(av102, '1A', client);
      expect((await unlock(av102, '1A', client)).status).toBe(204);

      await lock(av102, '1B', client);
      await query(`UPDATE seats SET locked_until = now() - interval '1 second' WHERE flight_id = $1 AND seat_number = '1B'`, [av102]);
      expect((await unlock(av102, '1B', newClientId())).status).toBe(204);
    });

    it('404 SEAT_NOT_FOUND for a seat that does not exist', async () => {
      const response = await unlock(av102, '99Z', newClientId());
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SEAT_NOT_FOUND');
    });
  });

  describe('checkout', () => {
    it('restarts the lock once to CHECKOUT_TTL plus the margin and reports payableUntil', async () => {
      const client = newClientId();
      await lock(av102, '1A', client);
      const response = await checkout(av102, '1A', client);

      expect(response.status).toBe(200);
      const lockedUntil = new Date(response.body.lockedUntil).getTime();
      const payableUntil = new Date(response.body.payableUntil).getTime();
      expect(lockedUntil - payableUntil).toBe(10_000); // PAYMENT_MARGIN_SECONDS
      expect((payableUntil - Date.now()) / 1000).toBeGreaterThan(295); // 5:00 to pay
      expect((await seatRow(av102, '1A')).checkout_started_at).not.toBeNull();
    });

    it('cannot be used twice to extend: the second call is idempotent', async () => {
      const client = newClientId();
      await lock(av102, '1A', client);
      const first = await checkout(av102, '1A', client);
      const second = await checkout(av102, '1A', client);

      expect(second.status).toBe(200);
      expect(second.body.lockedUntil).toBe(first.body.lockedUntil);
      expect(second.body.payableUntil).toBe(first.body.payableUntil);
    });

    it('409 LOCK_EXPIRED_OR_NOT_OWNED for a free seat, another client, or an expired lock', async () => {
      const owner = newClientId();
      expect((await checkout(av102, '1A', owner)).body.error.code).toBe('LOCK_EXPIRED_OR_NOT_OWNED');

      await lock(av102, '1A', owner);
      expect((await checkout(av102, '1A', newClientId())).body.error.code).toBe('LOCK_EXPIRED_OR_NOT_OWNED');

      await query(`UPDATE seats SET locked_until = now() - interval '1 second' WHERE flight_id = $1 AND seat_number = '1A'`, [av102]);
      expect((await checkout(av102, '1A', owner)).status).toBe(409);
    });

    it('409 FLIGHT_NOT_BOOKABLE when the flight was cancelled meanwhile; 404 for a missing seat', async () => {
      const client = newClientId();
      await lock(av102, '1A', client);
      await query(`UPDATE flights SET status = 'CANCELLED' WHERE id = $1`, [av102]);
      expect((await checkout(av102, '1A', client)).body.error.code).toBe('FLIGHT_NOT_BOOKABLE');
      expect((await checkout(av102, '99Z', client)).status).toBe(404);
    });

    it('shows payableUntil only to the owner in the snapshot', async () => {
      const client = newClientId();
      await lock(av102, '1A', client);
      await checkout(av102, '1A', client);

      const mine = await server.api.get(`/api/flights/${av102}/seats`).set('X-Client-Id', client);
      const theirs = await server.api.get(`/api/flights/${av102}/seats`).set('X-Client-Id', newClientId());
      const find = (body: { seats: { seatNumber: string }[] }) => body.seats.find((s) => s.seatNumber === '1A');
      expect(find(mine.body)).toEqual(expect.objectContaining({ mine: true, payableUntil: expect.any(String) }));
      expect(find(theirs.body)).toEqual(expect.objectContaining({ mine: false }));
      expect((find(theirs.body) as { payableUntil?: string }).payableUntil).toBeUndefined();
    });
  });

  describe('expiration job (7.4)', () => {
    it('releases expired locks, bumps the version and leaves active ones alone', async () => {
      const [expiredSeat, activeSeat] = await freeSeats('AV102', 2);
      await lock(av102, expiredSeat, newClientId());
      await lock(av102, activeSeat, newClientId());
      await query(`UPDATE seats SET locked_until = now() - interval '1 second' WHERE flight_id = $1 AND seat_number = $2`, [av102, expiredSeat]);

      expect(await server.container.expireLocks.execute()).toBe(1);
      expect(await seatRow(av102, expiredSeat)).toEqual(
        expect.objectContaining({ status: 'AVAILABLE', locked_by: null, checkout_started_at: null, version: 2 })
      );
      expect((await seatRow(av102, activeSeat)).status).toBe('BLOCKED');
      expect(await server.container.expireLocks.execute()).toBe(0);
    });
  });

  describe('admin lock stages', () => {
    it('counts active locks by stage', async () => {
      const [a, b, c] = await freeSeats('AV102', 3);
      const [x, y, z] = [newClientId(), newClientId(), newClientId()];
      await lock(av102, a, x);
      await lock(av102, b, y);
      await lock(av102, c, z);
      await checkout(av102, b, y);
      await query(`UPDATE seats SET locked_until = now() - interval '1 second' WHERE flight_id = $1 AND seat_number = $2`, [av102, c]);

      const response = await server.api.get(`/api/admin/flights/${av102}/lock-stages`).set(ADMIN_HEADERS);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ flightId: av102, selecting: 1, checkout: 1 });
    });

    it('401 without the admin key or with a wrong one; 404 for an unknown flight', async () => {
      expect((await server.api.get(`/api/admin/flights/${av102}/lock-stages`)).status).toBe(401);
      const wrong = await server.api.get(`/api/admin/flights/${av102}/lock-stages`).set('X-Admin-Key', 'wrong');
      expect(wrong.status).toBe(401);
      expect(wrong.body.error.code).toBe('UNAUTHORIZED');
      const missing = await server.api.get(`/api/admin/flights/${randomUUID()}/lock-stages`).set(ADMIN_HEADERS);
      expect(missing.status).toBe(404);
    });
  });
});
