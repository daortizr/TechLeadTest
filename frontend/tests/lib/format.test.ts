import { describe, it, expect } from 'vitest'
import { bogotaDate, formatCountdown, formatPrice, formatShortDate, formatTime } from '../../src/lib/format'
import { clockOffsetFrom, serverNow } from '../../src/lib/clock'
import { flightsFoundLabel, seatsLabel, unavailableReason } from '../../src/lib/labels'
import { FlightStatus } from '@flight-reservations/shared'

describe('formatPrice', () => {
  it('divides the minor unit by 100 and formats Colombian pesos without decimals', () => {
    const text = formatPrice(41_200_000).replace(/\s/g, ' ')
    expect(text).toContain('412.000')
    expect(text).toContain('$')
    expect(text).not.toContain(',')
  })
})

describe('formatTime', () => {
  it('shows 24-hour Bogotá time (UTC-5)', () => {
    expect(formatTime('2026-09-25T11:30:00.000Z')).toBe('06:30')
    expect(formatTime('2026-09-25T23:00:00.000Z')).toBe('18:00')
  })

  it('does not depend on the machine time zone at the day boundary', () => {
    expect(formatTime('2026-09-26T04:59:00.000Z')).toBe('23:59')
    expect(formatTime('2026-09-26T05:00:00.000Z')).toBe('00:00')
  })
})

describe('dates', () => {
  it('formatShortDate gives "25 sep" for a plain calendar date', () => {
    expect(formatShortDate('2026-09-25')).toBe('25 sep')
    expect(formatShortDate('2026-01-03')).toBe('3 ene')
  })

  it('bogotaDate returns YYYY-MM-DD and steps by days', () => {
    expect(bogotaDate(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const today = new Date(`${bogotaDate(0)}T00:00:00Z`).getTime()
    expect(new Date(`${bogotaDate(1)}T00:00:00Z`).getTime() - today).toBe(86_400_000)
    expect(today - new Date(`${bogotaDate(-1)}T00:00:00Z`).getTime()).toBe(86_400_000)
  })
})

describe('formatCountdown', () => {
  it('shows minutes and zero-padded seconds, rounding up so it hits zero last', () => {
    expect(formatCountdown(300_000)).toBe('5:00')
    expect(formatCountdown(61_000)).toBe('1:01')
    expect(formatCountdown(59_001)).toBe('1:00')
    expect(formatCountdown(500)).toBe('0:01')
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(-5_000)).toBe('0:00')
  })
})

describe('server clock', () => {
  it('turns serverTime into an offset and back', () => {
    const local = new Date('2026-09-25T10:00:00.000Z').getTime()
    const offset = clockOffsetFrom('2026-09-25T10:00:07.000Z', local)
    expect(offset).toBe(7_000)
    expect(serverNow(offset, local)).toBe(local + 7_000)
  })
})

describe('labels', () => {
  it('pluralizes the result count', () => {
    expect(flightsFoundLabel(1)).toBe('1 vuelo encontrado')
    expect(flightsFoundLabel(3)).toBe('3 vuelos encontrados')
    expect(seatsLabel(18, 48)).toBe('18 de 48 libres')
  })

  it('explains why a flight cannot be booked, and stays silent when it can', () => {
    expect(unavailableReason(FlightStatus.SOLD_OUT, 0)).toMatch(/vendidos/)
    expect(unavailableReason(FlightStatus.CANCELLED, 10)).toMatch(/cancelado/)
    expect(unavailableReason(FlightStatus.ON_SALE, 0)).toMatch(/bloqueados/)
    expect(unavailableReason(FlightStatus.ON_SALE, 5)).toBeNull()
  })
})
