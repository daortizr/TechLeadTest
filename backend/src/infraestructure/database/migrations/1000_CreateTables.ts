import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTables1000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE airports (
        code     CHAR(3) PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
        name     TEXT NOT NULL,
        city     TEXT NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'America/Bogota'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE flights (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code          TEXT NOT NULL,
        origin        CHAR(3) NOT NULL REFERENCES airports(code) ON DELETE RESTRICT,
        destination   CHAR(3) NOT NULL REFERENCES airports(code) ON DELETE RESTRICT,
        departure_at  TIMESTAMPTZ NOT NULL,
        arrival_at    TIMESTAMPTZ NOT NULL,
        price_cents   INTEGER NOT NULL CHECK (price_cents > 0),
        currency      CHAR(3) NOT NULL DEFAULT 'COP',
        status        TEXT NOT NULL DEFAULT 'ON_SALE'
                      CHECK (status IN ('ON_SALE','SOLD_OUT','CANCELLED')),
        version       INTEGER NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (origin <> destination),
        CHECK (arrival_at > departure_at)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX ix_flights_search ON flights (origin, destination, departure_at)
    `);

    await queryRunner.query(`
      CREATE TABLE seats (
        flight_id           UUID NOT NULL REFERENCES flights(id) ON DELETE RESTRICT,
        seat_number         TEXT NOT NULL,
        row_number          INTEGER NOT NULL CHECK (row_number > 0),
        column_letter       CHAR(1) NOT NULL CHECK (column_letter ~ '^[A-Z]$'),
        status              TEXT NOT NULL DEFAULT 'AVAILABLE'
                            CHECK (status IN ('AVAILABLE','BLOCKED','RESERVED')),
        locked_by           TEXT,
        locked_until        TIMESTAMPTZ,
        checkout_started_at TIMESTAMPTZ,
        version             INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (flight_id, seat_number),
        CHECK (seat_number = row_number::text || column_letter),
        CHECK (
          (status = 'BLOCKED' AND locked_by IS NOT NULL AND locked_until IS NOT NULL)
          OR (status <> 'BLOCKED' AND locked_by IS NULL AND locked_until IS NULL
              AND checkout_started_at IS NULL)
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX ix_seats_expiry ON seats (locked_until) WHERE status = 'BLOCKED'
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX ux_seats_one_lock_per_client
        ON seats (flight_id, locked_by) WHERE status = 'BLOCKED'
    `);

    await queryRunner.query(`
      CREATE TABLE reservations (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code            TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
        flight_id       UUID NOT NULL,
        seat_number     TEXT NOT NULL,
        passenger_name  TEXT NOT NULL,
        passenger_email TEXT NOT NULL,
        client_id       TEXT NOT NULL,
        price_cents     INTEGER NOT NULL CHECK (price_cents > 0),
        currency        CHAR(3) NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (flight_id, seat_number),
        FOREIGN KEY (flight_id, seat_number)
          REFERENCES seats (flight_id, seat_number) ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE idempotency_keys (
        key            TEXT PRIMARY KEY,
        client_id      TEXT NOT NULL,
        request_hash   TEXT NOT NULL,
        status         TEXT NOT NULL CHECK (status IN ('IN_PROGRESS','COMPLETED','FAILED')),
        reservation_id UUID REFERENCES reservations(id) ON DELETE RESTRICT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK ((status = 'COMPLETED') = (reservation_id IS NOT NULL))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX ix_idempotency_created ON idempotency_keys (created_at)
    `);

    await queryRunner.query(`
      CREATE TABLE payments (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        idempotency_key   TEXT NOT NULL REFERENCES idempotency_keys(key) ON DELETE RESTRICT,
        reservation_id    UUID REFERENCES reservations(id) ON DELETE RESTRICT,
        authorization_ref TEXT,
        amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
        status            TEXT NOT NULL
                          CHECK (status IN ('AUTHORIZED','DECLINED','VOIDED','VOID_FAILED')),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX ix_payments_key ON payments (idempotency_key)
    `);

    await queryRunner.query(`
      CREATE INDEX ix_payments_reservation ON payments (reservation_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE payments`);
    await queryRunner.query(`DROP TABLE idempotency_keys`);
    await queryRunner.query(`DROP TABLE reservations`);
    await queryRunner.query(`DROP TABLE seats`);
    await queryRunner.query(`DROP TABLE flights`);
    await queryRunner.query(`DROP TABLE airports`);
  }
}
