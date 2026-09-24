import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedData1001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert airports
    await queryRunner.query(`
      INSERT INTO airports (code, name, city, timezone) VALUES
        ('BOG', 'El Dorado', 'Bogotá', 'America/Bogota'),
        ('MDE', 'José María Córdova', 'Medellín', 'America/Bogota'),
        ('CLO', 'Alfonso Bonilla Aragón', 'Cali', 'America/Bogota'),
        ('CTG', 'Rafael Núñez', 'Cartagena', 'America/Bogota'),
        ('BAQ', 'Ernesto Cortissoz', 'Barranquilla', 'America/Bogota'),
        ('BGA', 'Eldorado', 'Bucaramanga', 'America/Bogota')
    `);

    // Insert flights
    await queryRunner.query(`
      INSERT INTO flights (code, origin, destination, departure_at, arrival_at, price_cents, currency, status)
      VALUES
        ('AV101', 'BOG', 'MDE', now() + interval '1 day' + interval '6 hours 30 minutes', now() + interval '1 day' + interval '7 hours 50 minutes', 250000, 'COP', 'ON_SALE'),
        ('AV102', 'BOG', 'MDE', now() + interval '1 day' + interval '12 hours', now() + interval '1 day' + interval '13 hours 20 minutes', 250000, 'COP', 'ON_SALE'),
        ('AV103', 'BOG', 'MDE', now() + interval '1 day' + interval '18 hours', now() + interval '1 day' + interval '19 hours 20 minutes', 250000, 'COP', 'ON_SALE'),
        ('AV104', 'MDE', 'BOG', now() + interval '1 day' + interval '9 hours', now() + interval '1 day' + interval '10 hours 20 minutes', 250000, 'COP', 'ON_SALE'),
        ('AV105', 'BOG', 'CTG', now() + interval '2 days' + interval '8 hours', now() + interval '2 days' + interval '9 hours 30 minutes', 350000, 'COP', 'ON_SALE'),
        ('AV106', 'BOG', 'CLO', now() + interval '1 day' + interval '15 hours', now() + interval '1 day' + interval '16 hours 15 minutes', 280000, 'COP', 'SOLD_OUT'),
        ('AV107', 'BOG', 'BAQ', now() + interval '2 days' + interval '14 hours', now() + interval '2 days' + interval '15 hours 30 minutes', 320000, 'COP', 'ON_SALE')
    `);

    // Insert seats for all flights (48 per flight: 8 rows, 6 columns A-F)
    await queryRunner.query(`
      INSERT INTO seats (flight_id, seat_number, row_number, column_letter, status)
      SELECT
        f.id,
        (row_num::text || col_letter::text) as seat_number,
        row_num,
        col_letter,
        'AVAILABLE'
      FROM flights f
      CROSS JOIN LATERAL (
        SELECT row_num, col_letter
        FROM generate_series(1, 8) AS row_num
        CROSS JOIN LATERAL (
          SELECT unnest(ARRAY['A', 'B', 'C', 'D', 'E', 'F']::text[]) AS col_letter
        ) AS cols
      ) AS seats
    `);

    // Insert some reserved seats for AV101 (12 seats)
    await queryRunner.query(`
      WITH target_flight AS (
        SELECT id FROM flights WHERE code = 'AV101'
      ),
      reserved_codes AS (
        SELECT
          'SEED' || substr(md5(random()::text), 1, 4) as code_base,
          row_number() over () as rnum
        FROM generate_series(1, 12)
      )
      INSERT INTO reservations (code, flight_id, seat_number, passenger_name, passenger_email, client_id, price_cents, currency)
      SELECT
        rc.code_base || CASE WHEN rc.rnum < 10 THEN '0' ELSE '' END || rc.rnum as code,
        tf.id,
        (row_num::text || col_letter::text),
        'Pasajero ' || rc.rnum,
        'pasajero' || rc.rnum || '@example.com',
        'seed-client-' || rc.rnum,
        250000,
        'COP'
      FROM target_flight tf
      CROSS JOIN reserved_codes rc
      CROSS JOIN LATERAL (
        SELECT
          row_num,
          col_letter,
          row_number() over () as seat_index
        FROM generate_series(1, 3) AS row_num
        CROSS JOIN LATERAL (
          SELECT unnest(ARRAY['A', 'B', 'C', 'D']::text[]) AS col_letter
        ) AS cols
      ) AS seats
      WHERE seats.seat_index <= 12
    `);

    // Update seats to RESERVED for the reserved seats
    await queryRunner.query(`
      UPDATE seats
      SET status = 'RESERVED'
      WHERE (flight_id, seat_number) IN (
        SELECT flight_id, seat_number FROM reservations
      )
    `);

    // Insert idempotency keys for the reserved seats
    await queryRunner.query(`
      INSERT INTO idempotency_keys (key, client_id, request_hash, status, reservation_id, created_at)
      SELECT
        'idempotency-' || md5(random()::text),
        r.client_id,
        'hash-' || md5(r.id::text),
        'COMPLETED',
        r.id,
        now()
      FROM reservations r
    `);

    // Insert payments for the reserved seats
    await queryRunner.query(`
      INSERT INTO payments (idempotency_key, reservation_id, authorization_ref, amount_cents, status, created_at)
      SELECT
        ik.key,
        r.id,
        'SEED-' || md5(random()::text),
        r.price_cents,
        'AUTHORIZED',
        now()
      FROM reservations r
      JOIN idempotency_keys ik ON ik.reservation_id = r.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete in reverse order of foreign keys
    await queryRunner.query(`DELETE FROM payments WHERE idempotency_key LIKE 'idempotency-%'`);
    await queryRunner.query(`DELETE FROM idempotency_keys WHERE key LIKE 'idempotency-%'`);
    await queryRunner.query(`DELETE FROM reservations WHERE code LIKE 'SEED%'`);
    await queryRunner.query(`UPDATE seats SET status = 'AVAILABLE' WHERE status = 'RESERVED'`);
    await queryRunner.query(`DELETE FROM flights WHERE code IN ('AV101', 'AV102', 'AV103', 'AV104', 'AV105', 'AV106', 'AV107')`);
    await queryRunner.query(`DELETE FROM airports WHERE code IN ('BOG', 'MDE', 'CLO', 'CTG', 'BAQ', 'BGA')`);
  }
}
