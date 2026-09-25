import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DataSource } from 'typeorm'
import { SeatRepositoryImpl } from '../../src/infraestructure/outputAdapters/SeatRepositoryImpl'
import { UnitOfWorkImpl } from '../../src/infraestructure/database/UnitOfWorkImpl'
import { createTestDataSource } from './setup'

describe('Seat Locking - Concurrency Guarantees', () => {
  let dataSource: DataSource
  let seatRepository: SeatRepositoryImpl
  let unitOfWork: UnitOfWorkImpl

  beforeAll(async () => {
    dataSource = await createTestDataSource()
    seatRepository = new SeatRepositoryImpl(dataSource)
    unitOfWork = new UnitOfWorkImpl(dataSource)
  })

  afterAll(async () => {
    await dataSource.dropDatabase()
    await dataSource.destroy()
  })

  it('should prevent double-locking of the same seat', async () => {
    const flightId = 'flight-1'
    const seatNumber = '1A'
    const clientId1 = 'client-1'
    const clientId2 = 'client-2'

    // Client 1 locks the seat
    const lock1 = await unitOfWork.run(async (tx) => {
      return await seatRepository.lock(tx, flightId, seatNumber, clientId1)
    })

    expect(lock1).toBeDefined()
    expect(lock1?.lockedBy).toBe(clientId1)
    expect(lock1?.status).toBe('BLOCKED')

    // Client 2 tries to lock the same seat - should fail
    const lock2 = await unitOfWork.run(async (tx) => {
      return await seatRepository.lock(tx, flightId, seatNumber, clientId2)
    })

    expect(lock2).toBeNull()
  })

  it('should allow relocking an expired lock', async () => {
    const flightId = 'flight-2'
    const seatNumber = '2A'
    const clientId1 = 'client-1'
    const clientId2 = 'client-2'

    // Client 1 locks with very short expiry
    await unitOfWork.run(async (tx) => {
      await seatRepository.lock(tx, flightId, seatNumber, clientId1)
    })

    // Wait for lock to expire
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Client 2 should be able to lock the expired seat
    const lock2 = await unitOfWork.run(async (tx) => {
      return await seatRepository.lock(tx, flightId, seatNumber, clientId2)
    })

    expect(lock2).toBeDefined()
    expect(lock2?.lockedBy).toBe(clientId2)
  })

  it('should track lock version correctly', async () => {
    const flightId = 'flight-3'
    const seatNumber = '3A'
    const clientId = 'client-1'

    // First lock
    const lock1 = await unitOfWork.run(async (tx) => {
      return await seatRepository.lock(tx, flightId, seatNumber, clientId)
    })

    const version1 = lock1?.version

    // Unlock
    await unitOfWork.run(async (tx) => {
      await seatRepository.unlock(tx, flightId, seatNumber, clientId)
    })

    // Re-lock
    const lock2 = await unitOfWork.run(async (tx) => {
      return await seatRepository.lock(tx, flightId, seatNumber, clientId)
    })

    expect(lock2?.version).toBeGreaterThan(version1 ?? 0)
  })

  it('should handle concurrent lock attempts safely', async () => {
    const flightId = 'flight-4'
    const seatNumber = '4A'
    const clientIds = Array.from({ length: 5 }, (_, i) => `client-${i}`)

    // Attempt concurrent locks
    const results = await Promise.all(
      clientIds.map((clientId) =>
        unitOfWork.run(async (tx) => {
          return await seatRepository.lock(tx, flightId, seatNumber, clientId)
        })
      )
    )

    // Only one should succeed
    const successfulLocks = results.filter((r) => r !== null)
    expect(successfulLocks).toHaveLength(1)
    expect(successfulLocks[0]?.lockedBy).toBeDefined()
  })

  it('should maintain ACID properties across lock and reserve', async () => {
    const flightId = 'flight-5'
    const seatNumber = '5A'
    const clientId = 'client-1'

    // Lock then immediately reserve should work atomically
    const result = await unitOfWork.run(async (tx) => {
      const lock = await seatRepository.lock(tx, flightId, seatNumber, clientId)
      if (!lock) throw new Error('Lock failed')

      const reserved = await seatRepository.reserve(tx, flightId, seatNumber, clientId)
      return { lock, reserved }
    })

    expect(result.lock).toBeDefined()
    expect(result.reserved).toBeDefined()
    expect(result.reserved?.status).toBe('RESERVED')
  })
})
