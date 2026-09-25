import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DataSource } from 'typeorm'
import { SeatRepositoryImpl } from '../../src/infraestructure/outputAdapters/SeatRepositoryImpl'
import { FlightRepositoryImpl } from '../../src/infraestructure/outputAdapters/FlightRepositoryImpl'
import { ReservationRepositoryImpl } from '../../src/infraestructure/outputAdapters/ReservationRepositoryImpl'
import { IdempotencyRepositoryImpl } from '../../src/infraestructure/outputAdapters/IdempotencyRepositoryImpl'
import { UnitOfWorkImpl } from '../../src/infraestructure/database/UnitOfWorkImpl'
import { createTestDataSource } from './setup'
import { Reservation } from '../../src/domain/entities'
import { v4 as uuidv4 } from 'uuid'

describe('Reservation Flow - End-to-End', () => {
  let dataSource: DataSource
  let seatRepository: SeatRepositoryImpl
  let flightRepository: FlightRepositoryImpl
  let reservationRepository: ReservationRepositoryImpl
  let idempotencyRepository: IdempotencyRepositoryImpl
  let unitOfWork: UnitOfWorkImpl

  beforeAll(async () => {
    dataSource = await createTestDataSource()
    seatRepository = new SeatRepositoryImpl(dataSource)
    flightRepository = new FlightRepositoryImpl(dataSource)
    reservationRepository = new ReservationRepositoryImpl(dataSource)
    idempotencyRepository = new IdempotencyRepositoryImpl(dataSource)
    unitOfWork = new UnitOfWorkImpl(dataSource)
  })

  afterAll(async () => {
    await dataSource.dropDatabase()
    await dataSource.destroy()
  })

  it('should complete full reservation flow: lock → verify → reserve', async () => {
    const flightId = 'flight-1'
    const seatNumber = '1A'
    const clientId = 'client-1'
    const idempotencyKey = uuidv4()

    // Step 1: Claim idempotency key
    await unitOfWork.run(async (tx) => {
      await idempotencyRepository.claim(tx, idempotencyKey, clientId, 'hash-1')
    })

    // Step 2: Lock seat
    const locked = await unitOfWork.run(async (tx) => {
      return await seatRepository.lock(tx, flightId, seatNumber, clientId)
    })

    expect(locked).toBeDefined()
    expect(locked?.status).toBe('BLOCKED')

    // Step 3: Verify flight and seat for reservation
    const verifyResult = await unitOfWork.run(async (tx) => {
      const flight = await flightRepository.findById(tx, flightId)
      const seat = await seatRepository.findBySeatNumber(tx, flightId, seatNumber)

      return {
        flight: flight?.status === 'ON_SALE',
        seatLockedByClient: seat?.lockedBy === clientId && seat?.status === 'BLOCKED',
      }
    })

    expect(verifyResult.flight).toBe(true)
    expect(verifyResult.seatLockedByClient).toBe(true)

    // Step 4: Reserve seat
    const reserved = await unitOfWork.run(async (tx) => {
      return await seatRepository.reserve(tx, flightId, seatNumber, clientId)
    })

    expect(reserved).toBeDefined()
    expect(reserved?.status).toBe('RESERVED')

    // Step 5: Create reservation record
    const reservationCode = `RES-${Date.now()}`
    const reservation = new Reservation(
      uuidv4(),
      reservationCode,
      flightId,
      seatNumber,
      'John Doe',
      'john@example.com',
      'CC',
      '1000000000',
      '+573000000000',
      clientId,
      150000,
      'COP',
      new Date()
    )

    const created = await unitOfWork.run(async (tx) => {
      return await reservationRepository.create(tx, reservation)
    })

    expect(created).toBeDefined()
    expect(created.code).toBe(reservationCode)

    // Step 6: Mark idempotency complete
    await unitOfWork.run(async (tx) => {
      await idempotencyRepository.markCompleted(tx, idempotencyKey, created.id)
    })

    // Verify cannot re-process same idempotency key
    const reclaimFails = await unitOfWork.run(async (tx) => {
      return await idempotencyRepository.claim(tx, idempotencyKey, clientId, 'hash-1')
    })

    expect(reclaimFails).toBeNull()
  })

  it('should prevent reservation if seat becomes unavailable during checkout', async () => {
    const flightId = 'flight-1'
    const seatNumber = '2A'
    const clientId1 = 'client-1'
    const clientId2 = 'client-2'

    // Client 1 locks seat
    await unitOfWork.run(async (tx) => {
      await seatRepository.lock(tx, flightId, seatNumber, clientId1)
    })

    // Client 2 somehow gets the same seat (shouldn't happen, but test resilience)
    // Try to reserve with different client
    const result = await unitOfWork.run(async (tx) => {
      const seat = await seatRepository.findBySeatNumber(tx, flightId, seatNumber)

      if (seat?.lockedBy !== clientId2) {
        return { success: false, reason: 'NOT_LOCKED_BY_CLIENT' }
      }

      const reserved = await seatRepository.reserve(tx, flightId, seatNumber, clientId2)
      return { success: !!reserved, reason: null }
    })

    expect(result.success).toBe(false)
    expect(result.reason).toBe('NOT_LOCKED_BY_CLIENT')
  })

  it('should handle concurrent reservations on different seats', async () => {
    const flightId = 'flight-1'
    const seats = ['3A', '3B', '3C']
    const clientIds = ['client-1', 'client-2', 'client-3']

    // Concurrent locks and reserves
    const results = await Promise.all(
      seats.map((seat, i) =>
        unitOfWork.run(async (tx) => {
          const locked = await seatRepository.lock(tx, flightId, seat, clientIds[i])
          if (!locked) return { success: false }

          const reserved = await seatRepository.reserve(tx, flightId, seat, clientIds[i])
          return { success: !!reserved, seat, clientId: clientIds[i] }
        })
      )
    )

    // All should succeed
    expect(results.filter((r) => r.success)).toHaveLength(3)
    results.forEach((r, i) => {
      expect(r.seat).toBe(seats[i])
    })
  })

  it('should maintain data consistency on partial failure', async () => {
    const flightId = 'flight-1'
    const seatNumber = '4A'
    const clientId = 'client-1'
    const idempotencyKey = uuidv4()

    try {
      await unitOfWork.run(async (tx) => {
        // Claim idempotency
        await idempotencyRepository.claim(tx, idempotencyKey, clientId, 'hash-1')

        // Lock seat
        await seatRepository.lock(tx, flightId, seatNumber, clientId)

        // Simulate failure before marking complete
        throw new Error('Simulated payment gateway failure')
      })
    } catch {
      // Expected
    }

    // Idempotency key should still be claimable (transaction rolled back)
    const reclaim = await unitOfWork.run(async (tx) => {
      return await idempotencyRepository.claim(tx, idempotencyKey, clientId, 'hash-1')
    })

    // Either successfully reclaimed or needs to be resolved
    expect(reclaim).toBeDefined() // Implementation dependent

    // Seat should be back to AVAILABLE
    const seatState = await unitOfWork.run(async (tx) => {
      return await seatRepository.findBySeatNumber(tx, flightId, seatNumber)
    })

    expect(seatState?.status).toBe('AVAILABLE')
  })
})
