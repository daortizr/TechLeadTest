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
import { CreateTables1000 } from './migrations/1000_CreateTables';
import { SeedData1001 } from './migrations/1001_SeedData';

export const dataSource = new DataSource({
  type: 'postgres',
  url: config.DATABASE_URL,
  synchronize: false,
  logging: config.NODE_ENV === 'development',
  entities: [
    AirportEntity,
    FlightEntity,
    SeatEntity,
    ReservationEntity,
    IdempotencyKeyEntity,
    PaymentEntity
  ],
  migrations: [CreateTables1000, SeedData1001]
});
