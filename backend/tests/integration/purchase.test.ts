import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import {
  CLEAN_RECONCILIATION,
  TestServer,
  flightId,
  freeSeats,
  newClientId,
  openEventStream,
  query,
  reconciliation,
  resetState,
  startServer,
  stopServer
} from './helpers';
import { dataSource } from '../../src/infraestructure/database/dataSource';
import { UnitOfWorkImpl } from '../../src/infraestructure/database/UnitOfWorkImpl';
import {
  AirportRepositoryImpl,
  FlightRepositoryImpl,
  IdempotencyRepositoryImpl,
  PaymentRepositoryImpl,
  ReservationRepositoryImpl,
  SeatRepositoryImpl
} from '../../src/infraestructure/outputAdapters';
import { FakePaymentGateway } from '../../src/infraestructure/serviceAdapters/FakePaymentGateway';
import { CreateReservationUseCase } from '../../src/application/useCases';
import { AppError } from '../../src/application/errorHandler';
import { hashRequest } from '../../src/application/helpers';
import { CardData, EventPublisher, Logger, PaymentGateway } from '../../src/infraestructure/outputPorts';

const PASSENGER = {
  fullName: 'Ana Gómez',
  email: 'ana@example.com',
  documentType: 'CC',
  documentNumber: '1000200300',
  phone: '+573001234567'
};
const CARD = { holderName: 'ANA GOMEZ', cardNumber: '4111111111111111', expiry: '12/99', cvv: '123' };
const DECLINED_CARD = { ...CARD, cardNumber: '4111111111110000' };

describe('purchase (7.3)', () => {
  let server: TestServer;
  let av102: string;

  const lock = (id: string, seat: string, client: string) =>
    server.api.post(`/api/flights/${id}/seats/${seat}/lock`).set('X-Client-Id', client);
  const purchase = (
    client: string,
    key: string,
    id: string,
    seat: string,
    overrides: { passenger?: object; payment?: object } = {}
  ) =>
    server.api
      .post('/api/reservations')
      .set('X-Client-Id', client)
      .set('Idempotency-Key', key)
      .send({
        flightId: id,
        seat,
        passenger: { ...PASSENGER, ...overrides.passenger },
        payment: { ...CARD, ...overrides.payment }
      });
  const payments = (key: string) =>
    query<{ status: string; reservation_id: string | null; authorization_ref: string | null }>(
      `SELECT status, reservation_id, authorization_ref FROM payments WHERE idempotency_key = $1 ORDER BY created_at`,
      [key]
    );
  const keyStatus = async (key: string) =>
    (await query<{ status: string }>(`SELECT status FROM idempotency_keys WHERE key = $1`, [key]))[0]?.status;
  const seatStatus = async (id: string, seat: string) =>
    (await query<{ status: string }>(`SELECT status FROM seats WHERE flight_id = $1 AND seat_number = $2`, [id, seat]))[0].status;

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

  describe('happy path', () => {
    it('reserves the seat, links the payment and completes the key in one go', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);

      const response = await purchase(client, key, av102, '1A');

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        code: expect.stringMatching(/^[A-HJ-NP-Z2-9]{6}$/),
        flight: expect.objectContaining({ id: av102, code: 'AV102', status: 'ON_SALE' }),
        seat: '1A',
        passengerName: 'Ana Gómez',
        price: 389000, // AV102: COP 389.000
        currency: 'COP',
        createdAt: expect.any(String)
      });

      expect(await seatStatus(av102, '1A')).toBe('RESERVED');
      expect(await keyStatus(key)).toBe('COMPLETED');
      const [payment] = await payments(key);
      expect(payment.status).toBe('AUTHORIZED');
      expect(payment.reservation_id).not.toBeNull();
      expect(payment.authorization_ref).toMatch(/^AUTH-/);
      expect(await reconciliation()).toEqual(CLEAN_RECONCILIATION);
    });

    it('never returns document, phone, e-mail or card data, in the purchase or in the ticket', async () => {
      const client = newClientId();
      await lock(av102, '1A', client);
      const bought = await purchase(client, randomUUID(), av102, '1A');
      const ticket = await server.api.get(`/api/reservations/${bought.body.code}`);

      for (const body of [bought.body, ticket.body]) {
        const text = JSON.stringify(body);
        expect(text).not.toContain(PASSENGER.email);
        expect(text).not.toContain(PASSENGER.phone);
        expect(text).not.toContain(PASSENGER.documentNumber);
        expect(text).not.toContain(CARD.cardNumber);
        expect(text).not.toContain(client);
      }
      expect(ticket.status).toBe(200);
      expect(ticket.body.passengerName).toBe('Ana Gómez');
    });

    it('stores the normalized passenger values and no card data', async () => {
      const client = newClientId();
      await lock(av102, '1A', client);
      await purchase(client, randomUUID(), av102, '1A', {
        passenger: {
          fullName: '  Ana Gómez  ',
          email: ' ANA@Example.com ',
          documentNumber: '1000200300',
          phone: '+57 (300) 123-4567'
        },
        payment: { cardNumber: '4111 1111 1111 1111' }
      });

      const [row] = await query<Record<string, string>>(`SELECT * FROM reservations WHERE flight_id = $1 AND seat_number = '1A'`, [av102]);
      expect(row.passenger_name).toBe('Ana Gómez');
      expect(row.passenger_email).toBe('ana@example.com');
      expect(row.passenger_phone).toBe('+573001234567');
      expect(JSON.stringify(row)).not.toContain('4111');
      const rows = await query(`SELECT * FROM payments`);
      expect(JSON.stringify(rows)).not.toContain('4111');
    });

    it('works right after locking, without an explicit checkout', async () => {
      const client = newClientId();
      await lock(av102, '2A', client);
      expect((await purchase(client, randomUUID(), av102, '2A')).status).toBe(201);
    });
  });

  describe('validation and preconditions', () => {
    it('400 for an invalid body, without echoing card or personal data', async () => {
      const client = newClientId();
      await lock(av102, '1A', client);
      const response = await purchase(client, randomUUID(), av102, '1A', {
        passenger: { email: 'secret-not-an-email', phone: '12345' },
        payment: { cardNumber: '4111-secret' }
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_REQUEST');
      const text = JSON.stringify(response.body);
      expect(text).not.toContain('secret');
      expect(text).not.toContain('12345');
    });

    it('400 without Idempotency-Key or X-Client-Id', async () => {
      const noKey = await server.api.post('/api/reservations').set('X-Client-Id', newClientId()).send({});
      expect(noKey.status).toBe(400);
      const noClient = await server.api.post('/api/reservations').set('Idempotency-Key', 'abc').send({});
      expect(noClient.status).toBe(400);
    });

    it('409 LOCK_EXPIRED_OR_NOT_OWNED without a lock or with someone else\'s, and nothing is charged', async () => {
      const owner = newClientId();
      await lock(av102, '1A', owner);

      const key = randomUUID();
      const intruder = await purchase(newClientId(), key, av102, '1A');
      expect(intruder.status).toBe(409);
      expect(intruder.body.error.code).toBe('LOCK_EXPIRED_OR_NOT_OWNED');
      const free = await purchase(newClientId(), randomUUID(), av102, '1B');
      expect(free.body.error.code).toBe('LOCK_EXPIRED_OR_NOT_OWNED');

      expect(await payments(key)).toEqual([]);
      expect(await keyStatus(key)).toBe('FAILED');
      expect(await seatStatus(av102, '1A')).toBe('BLOCKED');
    });

    it('409 when less than PAYMENT_MARGIN_SECONDS of lock remain (payableUntil already passed)', async () => {
      const client = newClientId();
      await lock(av102, '1A', client);
      await query(`UPDATE seats SET locked_until = now() + interval '5 seconds' WHERE flight_id = $1 AND seat_number = '1A'`, [av102]);

      const key = randomUUID();
      const response = await purchase(client, key, av102, '1A');
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('LOCK_EXPIRED_OR_NOT_OWNED');
      expect(await payments(key)).toEqual([]);
    });

    it('409 FLIGHT_NOT_BOOKABLE when the flight was cancelled after locking; 404 for a missing seat', async () => {
      const client = newClientId();
      await lock(av102, '1A', client);
      await query(`UPDATE flights SET status = 'CANCELLED' WHERE id = $1`, [av102]);

      const response = await purchase(client, randomUUID(), av102, '1A');
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('FLIGHT_NOT_BOOKABLE');
      expect((await purchase(client, randomUUID(), av102, '99Z')).status).toBe(404);
    });
  });

  describe('payment declined (402)', () => {
    it('records the DECLINED payment, fails the key and keeps the lock', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);

      const response = await purchase(client, key, av102, '1A', { payment: DECLINED_CARD });

      expect(response.status).toBe(402);
      expect(response.body.error.code).toBe('PAYMENT_DECLINED');
      expect((await payments(key)).map((p) => p.status)).toEqual(['DECLINED']);
      expect(await keyStatus(key)).toBe('FAILED');
      expect(await seatStatus(av102, '1A')).toBe('BLOCKED');
      expect(await reconciliation()).toEqual(CLEAN_RECONCILIATION);
    });

    it('lets the user retry with another card under the same key and body', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);
      await purchase(client, key, av102, '1A', { payment: DECLINED_CARD });

      const retry = await purchase(client, key, av102, '1A');
      expect(retry.status).toBe(201);
      expect((await payments(key)).map((p) => p.status)).toEqual(['DECLINED', 'AUTHORIZED']);
      expect(await keyStatus(key)).toBe('COMPLETED');
    });
  });

  describe('idempotency (Phase A)', () => {
    it('repeating a completed request returns the same reservation with 200 and never charges twice', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);

      const first = await purchase(client, key, av102, '1A');
      const second = await purchase(client, key, av102, '1A');

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(await payments(key)).toHaveLength(1);
      const [count] = await query<{ count: string }>(`SELECT count(*) FROM reservations WHERE flight_id = $1 AND seat_number = '1A'`, [av102]);
      expect(Number(count.count)).toBe(1);
    });

    it('422 IDEMPOTENCY_KEY_MISMATCH when the key is reused with different content', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);
      await purchase(client, key, av102, '1A');

      const other = await purchase(client, key, av102, '1A', { passenger: { fullName: 'Otra Persona' } });
      expect(other.status).toBe(422);
      expect(other.body.error.code).toBe('IDEMPOTENCY_KEY_MISMATCH');
    });

    it('two simultaneous submissions of the same key charge and reserve exactly once', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);

      const responses = await Promise.all([purchase(client, key, av102, '1A'), purchase(client, key, av102, '1A')]);

      expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
      for (const response of responses) {
        expect([200, 201, 409]).toContain(response.status);
        if (response.status === 409) expect(response.body.error.code).toBe('REQUEST_IN_PROGRESS');
      }
      expect(await payments(key)).toHaveLength(1);
      expect(await keyStatus(key)).toBe('COMPLETED');
      expect(await reconciliation()).toEqual(CLEAN_RECONCILIATION);
    });

    it('a client cannot claim the same key as another client', async () => {
      const key = randomUUID();
      const owner = newClientId();
      await lock(av102, '1A', owner);
      await purchase(owner, key, av102, '1A');

      const other = newClientId();
      await lock(av102, '1B', other);
      const response = await purchase(other, key, av102, '1A');
      expect(response.status).toBe(422);
    });
  });

  describe('SOLD_OUT and the last seats (T2 statements 1 and 6)', () => {
    it('two simultaneous purchases of the last two seats both succeed and mark the flight SOLD_OUT once', async () => {
      const av105 = await flightId('AV105');
      const [seatA, seatB] = await freeSeats('AV105', 2);
      const [clientA, clientB] = [newClientId(), newClientId()];
      await lock(av105, seatA, clientA);
      await lock(av105, seatB, clientB);

      const stream = await openEventStream(server.port);
      try {
        const responses = await Promise.all([
          purchase(clientA, randomUUID(), av105, seatA),
          purchase(clientB, randomUUID(), av105, seatB)
        ]);

        expect(responses.map((r) => r.status)).toEqual([201, 201]);
        const [flight] = await query<{ status: string; version: number }>(`SELECT status, version FROM flights WHERE id = $1`, [av105]);
        expect(flight).toEqual({ status: 'SOLD_OUT', version: 1 }); // bumped exactly once
        expect(await reconciliation()).toEqual(CLEAN_RECONCILIATION);

        const soldOut = await stream.waitFor((e) => e.event === 'flight.updated' && e.data.flightId === av105);
        expect(soldOut.data).toEqual(expect.objectContaining({ status: 'SOLD_OUT', availableSeats: 0, version: 1 }));
        await stream.waitFor((e) => e.event === 'seat.reserved' && e.data.seat === seatA);
        await stream.waitFor((e) => e.event === 'seat.reserved' && e.data.seat === seatB);
        expect(stream.events.filter((e) => e.event === 'flight.updated')).toHaveLength(1);
      } finally {
        stream.close();
      }
    });

    it('a sold-out flight rejects further locks and shows as SOLD_OUT in the ticket', async () => {
      const av107 = await flightId('AV107');
      const [seatA, seatB] = await freeSeats('AV107', 2);
      const [clientA, clientB] = [newClientId(), newClientId()];
      await lock(av107, seatA, clientA);
      await lock(av107, seatB, clientB);
      await purchase(clientA, randomUUID(), av107, seatA);
      const last = await purchase(clientB, randomUUID(), av107, seatB);

      expect(last.body.flight.status).toBe('SOLD_OUT');
      const relock = await lock(av107, seatA, newClientId());
      expect(relock.body.error.code).toBe('FLIGHT_NOT_BOOKABLE');
    });

    it('many buyers racing over the same seat: only the lock holder can buy it', async () => {
      const holder = newClientId();
      await lock(av102, '3A', holder);
      const attackers = Array.from({ length: 10 }, () => newClientId());

      const responses = await Promise.all([
        purchase(holder, randomUUID(), av102, '3A'),
        ...attackers.map((client) => purchase(client, randomUUID(), av102, '3A'))
      ]);

      expect(responses[0].status).toBe(201);
      expect(responses.slice(1).every((r) => r.status === 409)).toBe(true);
      const [count] = await query<{ count: string }>(`SELECT count(*) FROM reservations WHERE flight_id = $1 AND seat_number = '3A'`, [av102]);
      expect(Number(count.count)).toBe(1);
      expect(await reconciliation()).toEqual(CLEAN_RECONCILIATION);
    });
  });

  describe('compensation and recovery (7.3)', () => {
    const silentLogger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined };
    const noEvents: EventPublisher = { publish: async () => undefined, publishBatch: async () => undefined };

    function buildUseCase(gateway: PaymentGateway): CreateReservationUseCase {
      return new CreateReservationUseCase(
        new SeatRepositoryImpl(),
        new FlightRepositoryImpl(),
        new ReservationRepositoryImpl(),
        new PaymentRepositoryImpl(),
        new IdempotencyRepositoryImpl(),
        new UnitOfWorkImpl(dataSource),
        noEvents,
        gateway,
        { lockTtlSeconds: 300, checkoutTtlSeconds: 300, paymentMarginSeconds: 10 },
        silentLogger
      );
    }

    it('voids the authorization when the flight is cancelled while the customer is paying', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);

      const real = new FakePaymentGateway();
      const voided: string[] = [];
      const gateway: PaymentGateway = {
        authorize: async (idempotencyKey: string, amount: number, card: CardData) => {
          const result = await real.authorize(idempotencyKey, amount, card);
          await query(`UPDATE flights SET status = 'CANCELLED' WHERE id = $1`, [av102]); // cancelled mid-payment
          return result;
        },
        void: async (ref: string) => {
          voided.push(ref);
          await real.void(ref);
        }
      };

      await expect(
        buildUseCase(gateway).execute({ flightId: av102, seat: '1A', clientId: client, idempotencyKey: key, passenger: PASSENGER, payment: CARD })
      ).rejects.toMatchObject({ code: 'FLIGHT_NOT_BOOKABLE' });

      expect(voided).toHaveLength(1);
      expect((await payments(key)).map((p) => p.status)).toEqual(['VOIDED']);
      expect(await keyStatus(key)).toBe('FAILED');
      expect(await seatStatus(av102, '1A')).toBe('BLOCKED');
      expect(await reconciliation()).toEqual(CLEAN_RECONCILIATION);
    });

    it('marks VOID_FAILED (for reconciliation) when the gateway cannot void', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);

      const real = new FakePaymentGateway();
      const gateway: PaymentGateway = {
        authorize: async (idempotencyKey: string, amount: number, card: CardData) => {
          const result = await real.authorize(idempotencyKey, amount, card);
          await query(`UPDATE flights SET status = 'CANCELLED' WHERE id = $1`, [av102]);
          return result;
        },
        void: async () => {
          throw new Error('gateway down');
        }
      };

      const error = await buildUseCase(gateway)
        .execute({ flightId: av102, seat: '1A', clientId: client, idempotencyKey: key, passenger: PASSENGER, payment: CARD })
        .catch((e: unknown) => e);

      // The caller still learns the original cause
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('FLIGHT_NOT_BOOKABLE');
      expect((await payments(key)).map((p) => p.status)).toEqual(['VOID_FAILED']);
      const rec = await reconciliation();
      expect(rec.orphanCharges).toBe(1);
    });

    it('503 PAYMENT_UNAVAILABLE after one retry when the gateway keeps failing; the key can be reused', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);
      let calls = 0;
      const gateway: PaymentGateway = {
        authorize: async () => {
          calls++;
          throw new Error('timeout');
        },
        void: async () => undefined
      };

      await expect(
        buildUseCase(gateway).execute({ flightId: av102, seat: '1A', clientId: client, idempotencyKey: key, passenger: PASSENGER, payment: CARD })
      ).rejects.toMatchObject({ code: 'PAYMENT_UNAVAILABLE', statusCode: 503 });

      expect(calls).toBe(2);
      expect(await payments(key)).toEqual([]);
      expect(await keyStatus(key)).toBe('FAILED');
      expect((await purchase(client, key, av102, '1A')).status).toBe(201);
    });

    it('resumes a crashed purchase: reuses the recorded authorization instead of charging again', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);

      // State left behind by a process that died after recording the authorization
      const hash = hashRequest({ flightId: av102, seat: '1A', ...PASSENGER });
      await query(
        `INSERT INTO idempotency_keys (key, client_id, request_hash, status, created_at)
         VALUES ($1, $2, $3, 'IN_PROGRESS', now() - interval '2 minutes')`,
        [key, client, hash]
      );
      await query(
        `INSERT INTO payments (idempotency_key, authorization_ref, amount, status) VALUES ($1, 'AUTH-crashed', 250000, 'AUTHORIZED')`,
        [key]
      );

      const response = await purchase(client, key, av102, '1A');

      expect(response.status).toBe(201);
      const rows = await payments(key);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(expect.objectContaining({ status: 'AUTHORIZED', authorization_ref: 'AUTH-crashed' }));
      expect(rows[0].reservation_id).not.toBeNull();
      expect(await reconciliation()).toEqual(CLEAN_RECONCILIATION);
    });

    it('a fresh IN_PROGRESS key is not stolen: 409 REQUEST_IN_PROGRESS', async () => {
      const client = newClientId();
      const key = randomUUID();
      await lock(av102, '1A', client);
      await query(
        `INSERT INTO idempotency_keys (key, client_id, request_hash, status) VALUES ($1, $2, $3, 'IN_PROGRESS')`,
        [key, client, hashRequest({ flightId: av102, seat: '1A', ...PASSENGER })]
      );

      const response = await purchase(client, key, av102, '1A');
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('REQUEST_IN_PROGRESS');
      expect(await payments(key)).toEqual([]);
    });
  });

  describe('admin cancellation', () => {
    it('cancelling a sold-out flight is an invalid transition', async () => {
      const av106 = await flightId('AV106');
      const response = await server.api.post(`/api/admin/flights/${av106}/cancel`).set('X-Admin-Key', 'test-admin-key');
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INVALID_TRANSITION');
    });
  });
});
