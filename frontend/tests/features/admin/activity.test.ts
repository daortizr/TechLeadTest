import { describe, it, expect } from 'vitest'
import { FlightStatus } from '@flight-reservations/shared'
import { describeActivity, relativeTime, seatLabel } from '../../../src/features/admin/activity'

describe('activity feed text', () => {
  it('pads single-digit rows', () => {
    expect(seatLabel('3B')).toBe('03B')
    expect(seatLabel('12C')).toBe('12C')
  })

  it('describes each event', () => {
    const base = { flightId: 'f', version: 1 }
    expect(describeActivity({ ...base, type: 'seat.locked', seat: '12C', lockedUntil: 'x' })).toBe('12C bloqueado')
    expect(describeActivity({ ...base, type: 'seat.released', seat: '14F', reason: 'EXPIRED' })).toBe('14F liberado por expiración')
    expect(describeActivity({ ...base, type: 'seat.released', seat: '14F', reason: 'USER' })).toBe('14F liberado')
    expect(describeActivity({ ...base, type: 'seat.reserved', seat: '9A' })).toBe('09A reservado')
    expect(
      describeActivity({ ...base, type: 'flight.updated', status: FlightStatus.CANCELLED, availableSeats: 0 })
    ).toBe('Vuelo cancelado')
  })

  it('formats relative time', () => {
    expect(relativeTime(1000, 1000)).toBe('ahora')
    expect(relativeTime(0, 4_000)).toBe('hace 4 s')
    expect(relativeTime(0, 90_000)).toBe('hace 1 min')
    expect(relativeTime(0, 7_300_000)).toBe('hace 2 h')
  })
})
