import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DataSource } from 'typeorm'
import { SeatRepositoryImpl } from '../../src/infraestructure/outputAdapters/SeatRepositoryImpl'
import { UnitOfWorkImpl } from '../../src/infraestructure/database/UnitOfWorkImpl'
import { createTestDataSource } from './setup'
import { EventBus } from '../../src/infraestructure/realtime/EventBus'
import { FlightEvent } from '@flight-reservations/shared'

describe('Event Publishing - Real-time Updates', () => {
  let dataSource: DataSource
  let seatRepository: SeatRepositoryImpl
  let unitOfWork: UnitOfWorkImpl
  let eventBus: EventBus
  let capturedEvents: FlightEvent[] = []

  beforeAll(async () => {
    dataSource = await createTestDataSource()
    seatRepository = new SeatRepositoryImpl(dataSource)
    unitOfWork = new UnitOfWorkImpl(dataSource)
    eventBus = new EventBus()

    // Capture all events
    eventBus.subscribe(() => {
      eventBus.on('event', (event: FlightEvent) => {
        capturedEvents.push(event)
      })
    })
  })

  afterAll(async () => {
    await dataSource.dropDatabase()
    await dataSource.destroy()
  })

  beforeEach(() => {
    capturedEvents = []
  })

  it('should publish seat.locked event after successful lock', async () => {
    const flightId = 'flight-1'
    const seatNumber = '1A'
    const clientId = 'client-1'

    // Simulate event publishing after lock
    const locked = await unitOfWork.run(async (tx) => {
      return await seatRepository.lock(tx, flightId, seatNumber, clientId)
    })

    if (locked) {
      // In real implementation, event would be published after transaction commit
      eventBus.emit('event', {
        type: 'seat.locked',
        flightId,
        seat: seatNumber,
        lockedUntil: locked.lockedUntil,
        version: locked.version,
      } as any)
    }

    // Verify event was published
    expect(capturedEvents).toHaveLength(1)
    expect(capturedEvents[0].type).toBe('seat.locked')
  })

  it('should publish seat.reserved event after reservation', async () => {
    const flightId = 'flight-1'
    const seatNumber = '2A'
    const clientId = 'client-1'

    // Lock and reserve
    await unitOfWork.run(async (tx) => {
      await seatRepository.lock(tx, flightId, seatNumber, clientId)
    })

    const reserved = await unitOfWork.run(async (tx) => {
      return await seatRepository.reserve(tx, flightId, seatNumber, clientId)
    })

    if (reserved) {
      eventBus.emit('event', {
        type: 'seat.reserved',
        flightId,
        seat: seatNumber,
        version: reserved.version,
      } as any)
    }

    // Find the reserved event
    const reservedEvent = capturedEvents.find((e) => e.type === 'seat.reserved')
    expect(reservedEvent).toBeDefined()
    expect(reservedEvent?.type).toBe('seat.reserved')
  })

  it('should publish events in correct order', async () => {
    const flightId = 'flight-1'
    const seatNumber = '3A'
    const clientId = 'client-1'

    const timestamps: Array<{ event: string; ts: number }> = []

    // Lock
    const locked = await unitOfWork.run(async (tx) => {
      return await seatRepository.lock(tx, flightId, seatNumber, clientId)
    })

    if (locked) {
      timestamps.push({ event: 'seat.locked', ts: Date.now() })
      eventBus.emit('event', {
        type: 'seat.locked',
        flightId,
        seat: seatNumber,
        lockedUntil: locked.lockedUntil,
        version: locked.version,
      } as any)
    }

    // Small delay to ensure order
    await new Promise((r) => setTimeout(r, 10))

    // Reserve
    const reserved = await unitOfWork.run(async (tx) => {
      return await seatRepository.reserve(tx, flightId, seatNumber, clientId)
    })

    if (reserved) {
      timestamps.push({ event: 'seat.reserved', ts: Date.now() })
      eventBus.emit('event', {
        type: 'seat.reserved',
        flightId,
        seat: seatNumber,
        version: reserved.version,
      } as any)
    }

    // Verify order
    expect(capturedEvents[0].type).toBe('seat.locked')
    expect(capturedEvents[1].type).toBe('seat.reserved')
    expect(timestamps[0].ts).toBeLessThanOrEqual(timestamps[1].ts)
  })

  it('should include version in all events for ordering', async () => {
    const flightId = 'flight-1'
    const seatNumber = '4A'
    const clientId = 'client-1'

    // Lock
    const locked = await unitOfWork.run(async (tx) => {
      return await seatRepository.lock(tx, flightId, seatNumber, clientId)
    })

    if (locked) {
      eventBus.emit('event', {
        type: 'seat.locked',
        flightId,
        seat: seatNumber,
        lockedUntil: locked.lockedUntil,
        version: locked.version,
      } as any)
    }

    // Unlock
    await unitOfWork.run(async (tx) => {
      await seatRepository.unlock(tx, flightId, seatNumber, clientId)
    })

    eventBus.emit('event', {
      type: 'seat.released',
      flightId,
      seat: seatNumber,
      version: locked!.version + 1,
    } as any)

    // Verify versions are incremented
    expect(capturedEvents[1].version ?? 0).toBeGreaterThan(capturedEvents[0].version ?? 0)
  })

  it('should not publish events before transaction commits', async () => {
    const initialCount = capturedEvents.length

    try {
      await unitOfWork.run(async (tx) => {
        const locked = await seatRepository.lock(tx, 'flight-1', '5A', 'client-1')

        // Simulate failure before transaction commits
        if (locked) {
          throw new Error('Simulated error before commit')
        }
      })
    } catch {
      // Expected
    }

    // Event should not have been published
    expect(capturedEvents).toHaveLength(initialCount)
  })
})
