import { DataSource } from 'typeorm';
import { config } from '../config/env';
import {
  AirportEntity,
  FlightEntity,
  SeatEntity,
  ReservationEntity,
  IdempotencyKeyEntity,
  PaymentEntity
} from './entities';
import { CreateTables1700000000000 } from './migrations/1000_CreateTables';
import { SeedData1700000000001 } from './migrations/1001_SeedData';

// The raw SQL of the adapters uses unqualified table names, so a non-default schema
// (used by the integration tests) must also be on the connection's search_path.
const connectionExtras = {
  ...(config.dbUsesSsl && { ssl: { rejectUnauthorized: false } }),
  ...(config.dbSchema !== 'public' && { options: `-c search_path=${config.dbSchema}` })
};

export const dataSource = new DataSource({
  type: 'postgres',
  schema: config.dbSchema,
  host: config.dbHost,
  port: config.dbPort,
  username: config.dbUserName,
  password: config.dbPassword,
  database: config.dbName,
  ssl: false,
  extra: connectionExtras,
  synchronize: false,
  logging: false,
  entities: [
    AirportEntity,
    FlightEntity,
    SeatEntity,
    ReservationEntity,
    IdempotencyKeyEntity,
    PaymentEntity
  ],
  migrations: [CreateTables1700000000000, SeedData1700000000001]
});
