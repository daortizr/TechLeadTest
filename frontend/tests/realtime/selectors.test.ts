import { describe, it, expect } from 'vitest'
import { SeatStatus } from '@flight-reservations/shared'
import { flightCounts, isExpiredLock, seatView, serverNowMs } from '../../src/realtime/selectors'
import { initialState } from '../../src/realtime/reducer'
import type { AppState, StoredSeat } from '../../src/realtime/types'

const NOW = new Date('2026-09-25T10:00:00.000Z').getTime()

function stored(overrides: Partial<StoredSeat> = {}): StoredSeat {
  return { status: SeatStatus.AVAILABLE, version: 0, lockedUntil: null, mine: false, ...overrides }
}

const active = '2026-09-25T10:05:00.000Z'
const expired = '2026-09-25T09:59:59.000Z'

describe('seatView', () => {
  it('a free seat is available', () => {
    expect(seatView(stored(), NOW)).toBe('AVAILABLE')
  })

  it('an active lock is mine or someone else\'s', () => {
    expect(seatView(stored({ status: SeatStatus.BLOCKED, lockedUntil: active, mine: true }), NOW)).toBe('MINE')
    expect(seatView(stored({ status: SeatStatus.BLOCKED, lockedUntil: active }), NOW)).toBe('BLOCKED_BY_OTHER')
  })

  it('an expired lock counts as free even if the job has not released it yet', () => {
    const seat = stored({ status: SeatStatus.BLOCKED, lockedUntil: expired })
    expect(isExpiredLock(seat, NOW)).toBe(true)
    expect(seatView(seat, NOW)).toBe('AVAILABLE')
    expect(seatView({ ...seat, mine: true }, NOW)).toBe('AVAILABLE')
  })

  it('a lock that expires exactly now is expired (locked_until <= now)', () => {
    const seat = stored({ status: SeatStatus.BLOCKED, lockedUntil: new Date(NOW).toISOString() })
    expect(seatView(seat, NOW)).toBe('AVAILABLE')
  })

  it('a sold seat stays sold', () => {
    expect(seatView(stored({ status: SeatStatus.RESERVED }), NOW)).toBe('RESERVED')
  })
})

describe('flightCounts', () => {
  const state: AppState = {
    ...initialState,
    seats: {
      f1: {
        '1A': stored(),
        '1B': stored({ status: SeatStatus.BLOCKED, lockedUntil: active }),
        '1C': stored({ status: SeatStatus.BLOCKED, lockedUntil: expired }),
        '1D': stored({ status: SeatStatus.RESERVED }),
        '1E': stored({ status: SeatStatus.RESERVED })
      }
    }
  }

  it('counts free, blocked and reserved, treating expired locks as free', () => {
    expect(flightCounts(state, 'f1', NOW)).toEqual({
      available: 2,
      blocked: 1,
      reserved: 2,
      total: 5,
      occupancyPercent: 60 // 2 sold + 1 blocked of 5
    })
  })

  it('is null for a flight without a snapshot', () => {
    expect(flightCounts(state, 'missing', NOW)).toBeNull()
  })
})

describe('serverNowMs', () => {
  it('shifts the local time by the offset taken from serverTime', () => {
    expect(serverNowMs({ ...initialState, clockOffsetMs: 10_000 }, NOW)).toBe(NOW + 10_000)
    expect(serverNowMs({ ...initialState, clockOffsetMs: -2_500 }, NOW)).toBe(NOW - 2_500)
  })

  it('lets a lock expire by the server clock, not the local one', () => {
    // Local clock reads 09:54, the server is 6 minutes ahead (10:00): a lock until 09:57 is over
    const lock = stored({ status: SeatStatus.BLOCKED, lockedUntil: '2026-09-25T09:57:00.000Z' })
    const localNow = NOW - 6 * 60_000
    const state: AppState = { ...initialState, clockOffsetMs: 6 * 60_000 }

    expect(seatView(lock, localNow)).toBe('BLOCKED_BY_OTHER') // wrong if it trusted the local clock
    expect(seatView(lock, serverNowMs(state, localNow))).toBe('AVAILABLE')
  })
})
