import { MigrationInterface, QueryRunner, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AirportEntity } from '../entities/AirportEntity';
import { FlightEntity } from '../entities/FlightEntity';
import { SeatEntity } from '../entities/SeatEntity';
import { ReservationEntity } from '../entities/ReservationEntity';
import { IdempotencyKeyEntity } from '../entities/IdempotencyKeyEntity';
import { PaymentEntity } from '../entities/PaymentEntity';

// Deterministic PRNG (mulberry32): the seed's occupancy looks random but is
// reproducible across every `db:reset`, since the seed is fixed.
function mulberry32(seed: number): () => number {
  let state = seed;
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260101;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROWS = 8;
const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'];
const SEATS_PER_FLIGHT = ROWS * COLUMNS.length;
const SEED_CLIENT_PREFIX = 'seed-client-';
const SEED_IDEMPOTENCY_PREFIX = 'idempotency-seed-';
const FLIGHT_CODES = ['AV101', 'AV102', 'AV103', 'AV104', 'AV105', 'AV106', 'AV107'];
const AIRPORT_CODES = ['BOG', 'MDE', 'CLO', 'CTG', 'BAQ', 'BGA'];

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const BOGOTA_OFFSET = 5 * HOUR; // UTC-5, no daylight saving

// Midnight (Bogotá time) `daysFromToday` days after the database's current Bogotá date, as epoch ms
function startOfDayInBogota(databaseNow: Date, daysFromToday: number): number {
  const wallClock = new Date(databaseNow.getTime() - BOGOTA_OFFSET);
  return (
    Date.UTC(wallClock.getUTCFullYear(), wallClock.getUTCMonth(), wallClock.getUTCDate() + daysFromToday) +
    BOGOTA_OFFSET
  );
}

interface SeedFlightSpec {
  code: string;
  origin: string;
  destination: string;
  departureAt: Date;
  arrivalAt: Date;
  priceCents: number;
  status: 'ON_SALE' | 'SOLD_OUT';
  reservedSeatCount: number;
}

export class SeedData1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const random = mulberry32(SEED);
    const usedCodes = new Set<string>();
    // Every time comes from the database clock, as "tomorrow" and "the day after" in Bogotá
    const clock: { now: Date }[] = await queryRunner.query('SELECT now() AS now');
    const tomorrow = startOfDayInBogota(clock[0].now, 1);
    const dayAfterTomorrow = startOfDayInBogota(clock[0].now, 2);

    const airportRepo = queryRunner.manager.getRepository(AirportEntity);
    const flightRepo = queryRunner.manager.getRepository(FlightEntity);
    const seatRepo = queryRunner.manager.getRepository(SeatEntity);
    const reservationRepo = queryRunner.manager.getRepository(ReservationEntity);
    const idempotencyRepo = queryRunner.manager.getRepository(IdempotencyKeyEntity);
    const paymentRepo = queryRunner.manager.getRepository(PaymentEntity);

    await airportRepo.insert([
      { code: 'BOG', name: 'El Dorado', city: 'Bogotá', timezone: 'America/Bogota' },
      { code: 'MDE', name: 'José María Córdova', city: 'Medellín', timezone: 'America/Bogota' },
      { code: 'CLO', name: 'Alfonso Bonilla Aragón', city: 'Cali', timezone: 'America/Bogota' },
      { code: 'CTG', name: 'Rafael Núñez', city: 'Cartagena', timezone: 'America/Bogota' },
      { code: 'BAQ', name: 'Ernesto Cortissoz', city: 'Barranquilla', timezone: 'America/Bogota' },
      { code: 'BGA', name: 'Eldorado', city: 'Bucaramanga', timezone: 'America/Bogota' }
    ]);

    const flightSpecs: SeedFlightSpec[] = [
      {
        code: 'AV101',
        origin: 'BOG',
        destination: 'MDE',
        departureAt: new Date(tomorrow + 6 * HOUR + 30 * MINUTE),
        arrivalAt: new Date(tomorrow + 7 * HOUR + 50 * MINUTE),
        priceCents: 41200000,
        status: 'ON_SALE',
        reservedSeatCount: 18 // partial random
      },
      {
        code: 'AV102',
        origin: 'BOG',
        destination: 'MDE',
        departureAt: new Date(tomorrow + 12 * HOUR),
        arrivalAt: new Date(tomorrow + 13 * HOUR + 20 * MINUTE),
        priceCents: 38900000,
        status: 'ON_SALE',
        reservedSeatCount: 0 // empty
      },
      {
        code: 'AV103',
        origin: 'BOG',
        destination: 'MDE',
        departureAt: new Date(tomorrow + 18 * HOUR),
        arrivalAt: new Date(tomorrow + 19 * HOUR + 20 * MINUTE),
        priceCents: 45500000,
        status: 'ON_SALE',
        reservedSeatCount: 24 // partial random
      },
      {
        code: 'AV104',
        origin: 'MDE',
        destination: 'BOG',
        departureAt: new Date(tomorrow + 9 * HOUR),
        arrivalAt: new Date(tomorrow + 10 * HOUR + 20 * MINUTE),
        priceCents: 38000000,
        status: 'ON_SALE',
        reservedSeatCount: 0 // empty
      },
      {
        code: 'AV105',
        origin: 'BOG',
        destination: 'CTG',
        departureAt: new Date(dayAfterTomorrow + 8 * HOUR),
        arrivalAt: new Date(dayAfterTomorrow + 9 * HOUR + 30 * MINUTE),
        priceCents: 52000000,
        status: 'ON_SALE',
        reservedSeatCount: SEATS_PER_FLIGHT - 2 // almost full
      },
      {
        code: 'AV106',
        origin: 'BOG',
        destination: 'CLO',
        departureAt: new Date(tomorrow + 15 * HOUR),
        arrivalAt: new Date(tomorrow + 16 * HOUR + 15 * MINUTE),
        priceCents: 44500000,
        status: 'SOLD_OUT',
        reservedSeatCount: SEATS_PER_FLIGHT // full
      },
      {
        code: 'AV107',
        origin: 'BOG',
        destination: 'BAQ',
        departureAt: new Date(dayAfterTomorrow + 14 * HOUR),
        arrivalAt: new Date(dayAfterTomorrow + 15 * HOUR + 30 * MINUTE),
        priceCents: 49800000,
        status: 'ON_SALE',
        reservedSeatCount: SEATS_PER_FLIGHT - 2 // almost full
      }
    ];

    let passengerCounter = 0;

    for (const spec of flightSpecs) {
      const flightId = uuidv4();
      await flightRepo.insert({
        id: flightId,
        code: spec.code,
        origin: spec.origin,
        destination: spec.destination,
        departure_at: spec.departureAt,
        arrival_at: spec.arrivalAt,
        price_cents: spec.priceCents,
        currency: 'COP',
        status: spec.status,
        version: 0
      });

      const seatNumbers: string[] = [];
      for (let row = 1; row <= ROWS; row++) {
        for (const column of COLUMNS) {
          seatNumbers.push(`${row}${column}`);
        }
      }

      await seatRepo.insert(
        seatNumbers.map((seatNumber) => ({
          flight_id: flightId,
          seat_number: seatNumber,
          row_number: parseInt(seatNumber, 10),
          column_letter: seatNumber.slice(-1),
          status: 'AVAILABLE',
          version: 0
        }))
      );

      // Deterministic Fisher-Yates shuffle to pick which seats are reserved
      const shuffled = [...seatNumbers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const reservedSeats = shuffled.slice(0, spec.reservedSeatCount);

      for (const seatNumber of reservedSeats) {
        passengerCounter += 1;
        const clientId = `${SEED_CLIENT_PREFIX}${passengerCounter}`;

        let code = '';
        do {
          code = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('');
        } while (usedCodes.has(code));
        usedCodes.add(code);

        const reservationId = uuidv4();
        await reservationRepo.insert({
          id: reservationId,
          code,
          flight_id: flightId,
          seat_number: seatNumber,
          passenger_name: `Pasajero ${passengerCounter}`,
          passenger_email: `pasajero${passengerCounter}@example.com`,
          passenger_document_type: 'CC',
          passenger_document_number: String(1000000000 + passengerCounter),
          passenger_phone: `+57300${String(passengerCounter).padStart(7, '0')}`,
          client_id: clientId,
          price_cents: spec.priceCents,
          currency: 'COP',
        });

        await seatRepo.update({ flight_id: flightId, seat_number: seatNumber }, { status: 'RESERVED' });

        const idempotencyKey = `${SEED_IDEMPOTENCY_PREFIX}${passengerCounter}`;
        await idempotencyRepo.insert({
          key: idempotencyKey,
          client_id: clientId,
          request_hash: `hash-${reservationId}`,
          status: 'COMPLETED',
          reservation_id: reservationId,
        });

        await paymentRepo.insert({
          id: uuidv4(),
          idempotency_key: idempotencyKey,
          reservation_id: reservationId,
          authorization_ref: `SEED-${reservationId}`,
          amount_cents: spec.priceCents,
          status: 'AUTHORIZED',
        });
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const airportRepo = queryRunner.manager.getRepository(AirportEntity);
    const flightRepo = queryRunner.manager.getRepository(FlightEntity);
    const seatRepo = queryRunner.manager.getRepository(SeatEntity);
    const reservationRepo = queryRunner.manager.getRepository(ReservationEntity);
    const idempotencyRepo = queryRunner.manager.getRepository(IdempotencyKeyEntity);
    const paymentRepo = queryRunner.manager.getRepository(PaymentEntity);

    const flights = await flightRepo.find({ where: { code: In(FLIGHT_CODES) } });
    const flightIds = flights.map((flight) => flight.id);

    const reservations = flightIds.length ? await reservationRepo.find({ where: { flight_id: In(flightIds) } }) : [];
    const reservationIds = reservations.map((reservation) => reservation.id);

    if (reservationIds.length) {
      await paymentRepo.delete({ reservation_id: In(reservationIds) });
      await idempotencyRepo.delete({ reservation_id: In(reservationIds) });
      await reservationRepo.delete({ id: In(reservationIds) });
    }

    if (flightIds.length) {
      await seatRepo.delete({ flight_id: In(flightIds) });
    }

    await flightRepo.delete({ code: In(FLIGHT_CODES) });
    await airportRepo.delete({ code: In(AIRPORT_CODES) });
  }
}
