import { SeatStatus } from '@flight-reservations/shared'
import { serverNow } from '../lib/clock'
import type { AppState, StoredSeat } from './types'

// What the map draws for a seat. Free/blocked/reserved plus who holds it, never how.
export type SeatView = 'AVAILABLE' | 'MINE' | 'BLOCKED_BY_OTHER' | 'RESERVED'

export interface FlightCounts {
  available: number
  blocked: number
  reserved: number
  total: number
  // Seats no longer free (sold or blocked) over total, 0-100: 25 sold + 7 blocked of 48 is 67%
  occupancyPercent: number
}

export function serverNowMs(state: AppState, localNow: number = Date.now()): number {
  return serverNow(state.clockOffsetMs, localNow)
}

// A BLOCKED seat whose lock already expired counts as free, even if the job has not released it yet
export function isExpiredLock(seat: StoredSeat, nowMs: number): boolean {
  return seat.status === SeatStatus.BLOCKED && seat.lockedUntil !== null && new Date(seat.lockedUntil).getTime() <= nowMs
}

export function seatView(seat: StoredSeat, nowMs: number): SeatView {
  if (seat.status === SeatStatus.RESERVED) return 'RESERVED'
  if (seat.status === SeatStatus.BLOCKED && !isExpiredLock(seat, nowMs)) {
    return seat.mine ? 'MINE' : 'BLOCKED_BY_OTHER'
  }
  return 'AVAILABLE'
}

export function flightCounts(state: AppState, flightId: string, localNow: number = Date.now()): FlightCounts | null {
  const seats = state.seats[flightId]
  if (!seats) return null

  const nowMs = serverNowMs(state, localNow)
  let available = 0
  let blocked = 0
  let reserved = 0
  for (const seat of Object.values(seats)) {
    const view = seatView(seat, nowMs)
    if (view === 'RESERVED') reserved += 1
    else if (view === 'AVAILABLE') available += 1
    else blocked += 1
  }

  const total = available + blocked + reserved
  return { available, blocked, reserved, total, occupancyPercent: total === 0 ? 0 : Math.round(((reserved + blocked) / total) * 100) }
}
