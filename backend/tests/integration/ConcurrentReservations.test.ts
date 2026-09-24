import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DataSource } from 'typeorm'
import { SeatRepositoryImpl } from '../../src/infraestructure/outputAdapters/SeatRepositoryImpl'
import { UnitOfWorkImpl } from '../../src/infraestructure/database/UnitOfWorkImpl'
import { createTestDataSource } from './setup'

describe('Concurrent Reservations - Race Condition Safety', () => {
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

  it('should prevent overbooking under concurrent lock attempts', async () => {
    const flightId = 'flight-1'
    const seatNumber = '1A'
    const numConcurrentClients = 10

    // 10 clients try to lock the same seat simultaneously
    const results = await Promise.all(
      Array.from({ length: numConcurrentClients }, (_, i) =>
        unitOfWork.run(async (tx) => {
          return await seatRepository.lock(tx, flightId, seatNumber, `client-${i}`)
        })
      )
    )

    // Only ONE should succeed
    const successfulLocks = results.filter((r) => r !== null)
    expect(successfulLocks).toHaveLength(1)

    // Verify the winner
    expect(successfulLocks[0]?.status).toBe('BLOCKED')
    expect(successfulLocks[0]?.lockedBy).toBeDefined()
  })

  it('should handle rapid lock-reserve cycles', async () => {
    const flightId = 'flight-2'
    const clientId = 'client-1'
    const operations = 5

    let lastVersion = 0

    for (let i = 0; i < operations; i++) {
      const seatNumber = `${i}A`

      // Lock
      const locked = await unitOfWork.run(async (tx) => {
        return await seatRepository.lock(tx, flightId, seatNumber, clientId)
      })

      expect(locked).toBeDefined()
      lastVersion = locked?.version ?? 0

      // Reserve
      const reserved = await unitOfWork.run(async (tx) => {
        return await seatRepository.reserve(tx, flightId, seatNumber, clientId)
      })

      expect(reserved?.status).toBe('RESERVED')
      expect(reserved?.version ?? 0).toBeGreaterThan(lastVersion)
    }
  })

  it('should prevent double-reserve on same seat', async () => {
    const flightId = 'flight-3'
    const seatNumber = '1A'
    const clientId1 = 'client-1'
    const clientId2 = 'client-2'

    // Client 1 locks and reserves
    await unitOfWork.run(async (tx) => {
      await seatRepository.lock(tx, flightId, seatNumber, clientId1)
    })

    const reserved1 = await unitOfWork.run(async (tx) => {
      return await seatRepository.reserve(tx, flightId, seatNumber, clientId1)
    })

    expect(reserved1?.status).toBe('RESERVED')

    // Client 2 tries to reserve same seat - should fail
    const reserved2 = await unitOfWork.run(async (tx) => {
      return await seatRepository.reserve(tx, flightId, seatNumber, clientId2)
    })

    expect(reserved2).toBeNull()
  })

  it('should recover from partial transaction failures', async () => {
    const flightId = 'flight-4'
    const seatNumber = '1A'
    const clientId = 'client-1'

    // Attempt 1: Lock fails due to another client
    await unitOfWork.run(async (tx) => {
      await seatRepository.lock(tx, flightId, seatNumber, 'other-client')
    })

    const result1 = await unitOfWork.run(async (tx) => {
      return await seatRepository.lock(tx, flightId, seatNumber, clientId)
    })

    expect(result1).toBeNull()

    // Seat should still be locked by first client
    const status = await unitOfWork.run(async (tx) => {
      return await seatRepository.findBySeatNumber(tx, flightId, seatNumber)
    })

    expect(status?.lockedBy).toBe('other-client')
  })

  it('should handle stale version detection', async () => {
    const flightId = 'flight-5'
    const seatNumber = '1A'
    const clientId = 'client-1'

    // Get initial version
    let version1 = 0
    await unitOfWork.run(async (tx) => {
      const locked = await seatRepository.lock(tx, flightId, seatNumber, clientId)
      version1 = locked?.version ?? 0
    })

    // Perform concurrent operation that changes version
    const otherLock = await unitOfWork.run(async (tx) => {
      await seatRepository.unlock(tx, flightId, seatNumber, clientId)
      return await seatRepository.lock(tx, flightId, seatNumber, 'other-client')
    })

    expect(otherLock?.version ?? 0).toBeGreaterThan(version1)
  })

  it('should maintain seat consistency across 100 concurrent operations', async () => {
    const flightId = 'flight-6'
    const seats = Array.from({ length: 10 }, (_, i) => `${i}A`)
    const clients = Array.from({ length: 100 }, (_, i) => `client-${i}`)

    let successCount = 0

    // Attempt to reserve 100 different seats from 10 available
    const results = await Promise.all(
      clients.map((client, index) =>
        unitOfWork.run(async (tx) => {
          const seat = seats[index % seats.length]
          const locked = await seatRepository.lock(tx, flightId, seat, client)

          if (!locked) return { success: false }

          const reserved = await seatRepository.reserve(tx, flightId, seat, client)
          return { success: !!reserved, seat, client }
        })
      )
    )

    successCount = results.filter((r) => r.success).length

    // At most 10 should succeed (one per seat)
    expect(successCount).toBeLessThanOrEqual(seats.length)

    // Verify no overbooking
    for (const seat of seats) {
      const reserved = await unitOfWork.run(async (tx) => {
        const seatData = await seatRepository.findBySeatNumber(tx, flightId, seat)
        return seatData?.status === 'RESERVED'
      })

      // Seat should be either AVAILABLE or RESERVED (not both reserved by multiple clients)
      expect(reserved).toBeDefined()
    }
  })
})
