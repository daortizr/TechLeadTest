import { MigrationInterface, QueryRunner, Table, TableCheck, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

export class CreateTables1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'airports',
        columns: [
          { name: 'code', type: 'char', length: '3', isPrimary: true },
          { name: 'name', type: 'text', isNullable: false },
          { name: 'city', type: 'text', isNullable: false },
          { name: 'timezone', type: 'text', isNullable: false, default: "'America/Bogota'" }
        ],
        checks: [
          new TableCheck({ name: 'CHK_airports_code', expression: "code ~ '^[A-Z]{3}$'" })
        ]
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: 'flights',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'code', type: 'text', isNullable: false },
          { name: 'origin', type: 'char', length: '3', isNullable: false },
          { name: 'destination', type: 'char', length: '3', isNullable: false },
          { name: 'departure_at', type: 'timestamptz', isNullable: false },
          { name: 'arrival_at', type: 'timestamptz', isNullable: false },
          { name: 'price_cents', type: 'integer', isNullable: false },
          { name: 'currency', type: 'char', length: '3', isNullable: false, default: "'COP'" },
          { name: 'status', type: 'text', isNullable: false, default: "'ON_SALE'" },
          { name: 'version', type: 'integer', isNullable: false, default: 0 },
          { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'now()' }
        ],
        checks: [
          new TableCheck({ name: 'CHK_flights_price_positive', expression: 'price_cents > 0' }),
          new TableCheck({ name: 'CHK_flights_status', expression: "status IN ('ON_SALE','SOLD_OUT','CANCELLED')" }),
          new TableCheck({ name: 'CHK_flights_origin_destination', expression: 'origin <> destination' }),
          new TableCheck({ name: 'CHK_flights_arrival_after_departure', expression: 'arrival_at > departure_at' })
        ]
      }),
      true
    );

    await queryRunner.createForeignKeys('flights', [
      new TableForeignKey({
        columnNames: ['origin'],
        referencedTableName: 'airports',
        referencedColumnNames: ['code'],
        onDelete: 'RESTRICT'
      }),
      new TableForeignKey({
        columnNames: ['destination'],
        referencedTableName: 'airports',
        referencedColumnNames: ['code'],
        onDelete: 'RESTRICT'
      })
    ]);

    await queryRunner.createIndex(
      'flights',
      new TableIndex({ name: 'ix_flights_search', columnNames: ['origin', 'destination', 'departure_at'] })
    );

    await queryRunner.createTable(
      new Table({
        name: 'seats',
        columns: [
          { name: 'flight_id', type: 'uuid', isPrimary: true },
          { name: 'seat_number', type: 'text', isPrimary: true },
          { name: 'row_number', type: 'integer', isNullable: false },
          { name: 'column_letter', type: 'char', length: '1', isNullable: false },
          { name: 'status', type: 'text', isNullable: false, default: "'AVAILABLE'" },
          { name: 'locked_by', type: 'text', isNullable: true },
          { name: 'locked_until', type: 'timestamptz', isNullable: true },
          { name: 'checkout_started_at', type: 'timestamptz', isNullable: true },
          { name: 'version', type: 'integer', isNullable: false, default: 0 }
        ],
        checks: [
          new TableCheck({ name: 'CHK_seats_row_positive', expression: 'row_number > 0' }),
          new TableCheck({ name: 'CHK_seats_column_letter', expression: "column_letter ~ '^[A-Z]$'" }),
          new TableCheck({ name: 'CHK_seats_status', expression: "status IN ('AVAILABLE','BLOCKED','RESERVED')" }),
          new TableCheck({ name: 'CHK_seats_number_matches', expression: "seat_number = row_number::text || column_letter" }),
          new TableCheck({
            name: 'CHK_seats_lock_consistency',
            expression:
              "(status = 'BLOCKED' AND locked_by IS NOT NULL AND locked_until IS NOT NULL) OR (status <> 'BLOCKED' AND locked_by IS NULL AND locked_until IS NULL AND checkout_started_at IS NULL)"
          })
        ]
      }),
      true
    );

    await queryRunner.createForeignKey(
      'seats',
      new TableForeignKey({
        columnNames: ['flight_id'],
        referencedTableName: 'flights',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT'
      })
    );

    await queryRunner.createIndices('seats', [
      new TableIndex({ name: 'ix_seats_expiry', columnNames: ['locked_until'], where: "status = 'BLOCKED'" }),
      new TableIndex({
        name: 'ux_seats_one_lock_per_client',
        columnNames: ['flight_id', 'locked_by'],
        isUnique: true,
        where: "status = 'BLOCKED'"
      })
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'reservations',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'code', type: 'text', isNullable: false, isUnique: true },
          { name: 'flight_id', type: 'uuid', isNullable: false },
          { name: 'seat_number', type: 'text', isNullable: false },
          { name: 'passenger_name', type: 'text', isNullable: false },
          { name: 'passenger_email', type: 'text', isNullable: false },
          { name: 'passenger_document_type', type: 'text', isNullable: false },
          { name: 'passenger_document_number', type: 'text', isNullable: false },
          { name: 'passenger_phone', type: 'text', isNullable: false },
          { name: 'client_id', type: 'text', isNullable: false },
          { name: 'price_cents', type: 'integer', isNullable: false },
          { name: 'currency', type: 'char', length: '3', isNullable: false },
          { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'now()' }
        ],
        checks: [
          new TableCheck({ name: 'CHK_reservations_code', expression: "code ~ '^[A-HJ-NP-Z2-9]{6}$'" }),
          new TableCheck({ name: 'CHK_reservations_document_type', expression: "passenger_document_type IN ('CC','CE','PASSPORT')" }),
          new TableCheck({ name: 'CHK_reservations_phone', expression: "passenger_phone ~ '^\\+[1-9][0-9]{7,14}$'" }),
          new TableCheck({ name: 'CHK_reservations_price_positive', expression: 'price_cents > 0' })
        ],
        uniques: [new TableUnique({ name: 'UQ_reservations_flight_seat', columnNames: ['flight_id', 'seat_number'] })]
      }),
      true
    );

    await queryRunner.createForeignKey(
      'reservations',
      new TableForeignKey({
        columnNames: ['flight_id', 'seat_number'],
        referencedTableName: 'seats',
        referencedColumnNames: ['flight_id', 'seat_number'],
        onDelete: 'RESTRICT'
      })
    );

    await queryRunner.createTable(
      new Table({
        name: 'idempotency_keys',
        columns: [
          { name: 'key', type: 'text', isPrimary: true },
          { name: 'client_id', type: 'text', isNullable: false },
          { name: 'request_hash', type: 'text', isNullable: false },
          { name: 'status', type: 'text', isNullable: false },
          { name: 'reservation_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'now()' }
        ],
        checks: [
          new TableCheck({ name: 'CHK_idempotency_status', expression: "status IN ('IN_PROGRESS','COMPLETED','FAILED')" }),
          new TableCheck({
            name: 'CHK_idempotency_completed_has_reservation',
            expression: "(status = 'COMPLETED') = (reservation_id IS NOT NULL)"
          })
        ]
      }),
      true
    );

    await queryRunner.createForeignKey(
      'idempotency_keys',
      new TableForeignKey({
        columnNames: ['reservation_id'],
        referencedTableName: 'reservations',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT'
      })
    );

    await queryRunner.createIndex(
      'idempotency_keys',
      new TableIndex({ name: 'ix_idempotency_created', columnNames: ['created_at'] })
    );

    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'idempotency_key', type: 'text', isNullable: false },
          { name: 'reservation_id', type: 'uuid', isNullable: true },
          { name: 'authorization_ref', type: 'text', isNullable: true },
          { name: 'amount_cents', type: 'integer', isNullable: false },
          { name: 'status', type: 'text', isNullable: false },
          { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'now()' }
        ],
        checks: [
          new TableCheck({ name: 'CHK_payments_amount_positive', expression: 'amount_cents > 0' }),
          new TableCheck({ name: 'CHK_payments_status', expression: "status IN ('AUTHORIZED','DECLINED','VOIDED','VOID_FAILED')" })
        ]
      }),
      true
    );

    await queryRunner.createForeignKeys('payments', [
      new TableForeignKey({
        columnNames: ['idempotency_key'],
        referencedTableName: 'idempotency_keys',
        referencedColumnNames: ['key'],
        onDelete: 'RESTRICT'
      }),
      new TableForeignKey({
        columnNames: ['reservation_id'],
        referencedTableName: 'reservations',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT'
      })
    ]);

    await queryRunner.createIndices('payments', [
      new TableIndex({ name: 'ix_payments_key', columnNames: ['idempotency_key'] }),
      new TableIndex({ name: 'ix_payments_reservation', columnNames: ['reservation_id'] })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payments', true, true, true);
    await queryRunner.dropTable('idempotency_keys', true, true, true);
    await queryRunner.dropTable('reservations', true, true, true);
    await queryRunner.dropTable('seats', true, true, true);
    await queryRunner.dropTable('flights', true, true, true);
    await queryRunner.dropTable('airports', true, true, true);
  }
}
