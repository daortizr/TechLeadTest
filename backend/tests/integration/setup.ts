import { DataSource } from 'typeorm'
import { SeatEntity } from '../../src/infraestructure/database/entities/SeatEntity'
import { FlightEntity } from '../../src/infraestructure/database/entities/FlightEntity'
import { ReservationEntity } from '../../src/infraestructure/database/entities/ReservationEntity'
import { PaymentEntity } from '../../src/infraestructure/database/entities/PaymentEntity'
import { IdempotencyKeyEntity } from '../../src/infraestructure/database/entities/IdempotencyKeyEntity'
import { AirportEntity } from '../../src/infraestructure/database/entities/AirportEntity'

export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME_TEST || 'flight_test',
    entities: [
      SeatEntity,
      FlightEntity,
      ReservationEntity,
      PaymentEntity,
      IdempotencyKeyEntity,
      AirportEntity,
    ],
    synchronize: true,
    dropSchema: true,
  })

  await dataSource.initialize()

  // Seed test data
  await seedTestData(dataSource)

  return dataSource
}

async function seedTestData(dataSource: DataSource): Promise<void> {
  const airportRepo = dataSource.getRepository(AirportEntity)
  const flightRepo = dataSource.getRepository(FlightEntity)
  const seatRepo = dataSource.getRepository(SeatEntity)

  // Create airports
  const airports = await airportRepo.save([
    { code: 'BOG', name: 'El Dorado', city: 'Bogotá' },
    { code: 'MDE', name: 'José María Córdova', city: 'Medellín' },
    { code: 'CTG', name: 'Rafael Núñez', city: 'Cartagena' },
  ])

  // Create test flights
  const flights = await flightRepo.save([
    {
      code: 'AV001',
      origin: 'BOG',
      destination: 'MDE',
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      arrivalAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      price: 150000,
      currency: 'COP',
      status: 'ON_SALE',
      availableSeats: 36,
      version: 0,
    },
    {
      code: 'AV002',
      origin: 'MDE',
      destination: 'CTG',
      departureAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      arrivalAt: new Date(Date.now() + 48 * 60 * 60 * 1000 + 90 * 60 * 1000),
      price: 120000,
      currency: 'COP',
      status: 'ON_SALE',
      availableSeats: 36,
      version: 0,
    },
  ])

  // Create seats for flights
  const seatNumbers = Array.from({ length: 36 }, (_, i) => {
    const row = String.fromCharCode(65 + Math.floor(i / 6))
    const col = (i % 6) + 1
    return `${row}${col}`
  })

  for (const flight of flights) {
    const seats = seatNumbers.map((seatNumber) => ({
      flightId: flight.id,
      seatNumber,
      status: 'AVAILABLE' as const,
      version: 0,
    }))
    await seatRepo.save(seats)
  }
}
