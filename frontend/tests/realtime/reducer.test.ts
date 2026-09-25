import { describe, it, expect } from 'vitest'
import { FlightStatus, SeatStatus } from '@flight-reservations/shared'
import type { FlightDTO, FlightEvent, SeatDTO, SeatSnapshotDTO } from '@flight-reservations/shared'
import { appReducer, initialState } from '../../src/realtime/reducer'
import type { AppState } from '../../src/realtime/types'

const FLIGHT_ID = 'flight-1'

function flight(overrides: Partial<FlightDTO> = {}): FlightDTO {
  return {
    id: FLIGHT_ID,
    code: 'AV101',
    origin: 'BOG',
    destination: 'MDE',
    departureAt: '2026-09-25T11:30:00.000Z',
    arrivalAt: '2026-09-25T12:50:00.000Z',
    price: 412000,
    currency: 'COP',
    status: FlightStatus.ON_SALE,
    version: 0,
    availableSeats: 3,
    totalSeats: 3,
    ...overrides
  }
}

function seat(seatNumber: string, overrides: Partial<SeatDTO> = {}): SeatDTO {
  return { seatNumber, status: SeatStatus.AVAILABLE, mine: false, version: 0, ...overrides }
}

function snapshot(seats: SeatDTO[], serverTime = '2026-09-25T10:00:00.000Z'): SeatSnapshotDTO {
  return {
    flight: flight(),
    serverTime,
    counts: { available: seats.length, blocked: 0, reserved: 0, total: seats.length },
    seats
  }
}

function withSnapshot(seats: SeatDTO[] = [seat('1A'), seat('1B'), seat('1C')]): AppState {
  return appReducer(initialState, { type: 'SNAPSHOT_LOADED', snapshot: snapshot(seats), receivedAt: 0 })
}

function receive(state: AppState, ...events: FlightEvent[]): AppState {
  return appReducer(state, { type: 'EVENTS_RECEIVED', events, receivedAt: 1_000 })
}

const locked = (seatNumber: string, version: number, lockedUntil = '2026-09-25T10:05:00.000Z'): FlightEvent => ({
  type: 'seat.locked',
  flightId: FLIGHT_ID,
  seat: seatNumber,
  version,
  lockedUntil
})

describe('connection', () => {
  it('tracks the connection state and the last message time', () => {
    let state = appReducer(initialState, { type: 'CONNECTION_CHANGED', state: 'live' })
    state = appReducer(state, { type: 'MESSAGE_RECEIVED', at: 1234 })
    expect(state.connection).toEqual({ state: 'live', lastMessageAt: 1234 })
  })
})

describe('flights', () => {
  it('stores loaded flights by id', () => {
    const state = appReducer(initialState, { type: 'FLIGHTS_LOADED', flights: [flight(), flight({ id: 'flight-2' })] })
    expect(Object.keys(state.flights)).toEqual([FLIGHT_ID, 'flight-2'])
  })

  it('a newer or equal version refreshes a flight, an older one is ignored', () => {
    let state = appReducer(initialState, { type: 'FLIGHTS_LOADED', flights: [flight({ version: 2, availableSeats: 10 })] })
    state = appReducer(state, { type: 'FLIGHTS_LOADED', flights: [flight({ version: 2, availableSeats: 7 })] })
    expect(state.flights[FLIGHT_ID].availableSeats).toBe(7)
    state = appReducer(state, { type: 'FLIGHTS_LOADED', flights: [flight({ version: 1, availableSeats: 99 })] })
    expect(state.flights[FLIGHT_ID].availableSeats).toBe(7)
  })

  it('flight.updated applies only with a greater version', () => {
    let state = appReducer(initialState, { type: 'FLIGHTS_LOADED', flights: [flight({ version: 1 })] })
    const cancelled: FlightEvent = {
      type: 'flight.updated',
      flightId: FLIGHT_ID,
      status: FlightStatus.CANCELLED,
      availableSeats: 0,
      version: 2
    }

    state = receive(state, { ...cancelled, version: 1 })
    expect(state.flights[FLIGHT_ID].status).toBe(FlightStatus.ON_SALE)

    state = receive(state, cancelled)
    expect(state.flights[FLIGHT_ID]).toEqual(expect.objectContaining({ status: FlightStatus.CANCELLED, availableSeats: 0, version: 2 }))
  })

  it('flight.updated for a flight that was never loaded is ignored', () => {
    const state = receive(initialState, {
      type: 'flight.updated',
      flightId: 'unknown',
      status: FlightStatus.SOLD_OUT,
      availableSeats: 0,
      version: 1
    })
    expect(state.flights).toEqual({})
  })
})

describe('snapshot', () => {
  it('stores the seats, the flight and the clock offset from serverTime', () => {
    const state = appReducer(initialState, {
      type: 'SNAPSHOT_LOADED',
      snapshot: snapshot([seat('1A')], '2026-09-25T10:00:10.000Z'),
      receivedAt: new Date('2026-09-25T10:00:00.000Z').getTime()
    })

    expect(state.seats[FLIGHT_ID]['1A']).toEqual({ status: SeatStatus.AVAILABLE, version: 0, lockedUntil: null, mine: false })
    expect(state.flights[FLIGHT_ID].code).toBe('AV101')
    expect(state.clockOffsetMs).toBe(10_000)
  })

  it('derives my lock from the seat marked mine, with payableUntil during checkout', () => {
    const state = withSnapshot([
      seat('1A', {
        status: SeatStatus.BLOCKED,
        mine: true,
        version: 3,
        lockedUntil: '2026-09-25T10:05:10.000Z',
        payableUntil: '2026-09-25T10:05:00.000Z'
      }),
      seat('1B')
    ])
    expect(state.myLock[FLIGHT_ID]).toEqual({
      seat: '1A',
      lockedUntil: '2026-09-25T10:05:10.000Z',
      payableUntil: '2026-09-25T10:05:00.000Z'
    })
  })

  it('does not treat a lock that already expired (by the server clock) as my selection', () => {
    const state = appReducer(initialState, {
      type: 'SNAPSHOT_LOADED',
      snapshot: snapshot(
        [seat('1A', { status: SeatStatus.BLOCKED, mine: true, lockedUntil: '2026-09-25T09:59:59.000Z' })],
        '2026-09-25T10:00:00.000Z'
      ),
      receivedAt: 0
    })
    expect(state.myLock[FLIGHT_ID]).toBeNull()
  })

  it('a snapshot without a seat of mine clears my lock', () => {
    let state = withSnapshot()
    state = appReducer(state, { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: { seat: '1A', lockedUntil: '2026-09-25T10:05:00.000Z', payableUntil: null } })
    state = appReducer(state, { type: 'SNAPSHOT_LOADED', snapshot: snapshot([seat('1A', { version: 5 })]), receivedAt: 0 })
    expect(state.myLock[FLIGHT_ID]).toBeNull()
  })

  it('keeps a seat that an event already advanced beyond the snapshot', () => {
    let state = withSnapshot()
    state = receive(state, locked('1A', 4))
    state = appReducer(state, { type: 'SNAPSHOT_LOADED', snapshot: snapshot([seat('1A', { version: 2 })]), receivedAt: 0 })
    expect(state.seats[FLIGHT_ID]['1A'].status).toBe(SeatStatus.BLOCKED)
    expect(state.seats[FLIGHT_ID]['1A'].version).toBe(4)
  })
})

describe('seat events and versions', () => {
  it('seat.locked marks the seat as blocked by someone else', () => {
    const state = receive(withSnapshot(), locked('1A', 1))
    expect(state.seats[FLIGHT_ID]['1A']).toEqual({
      status: SeatStatus.BLOCKED,
      version: 1,
      lockedUntil: '2026-09-25T10:05:00.000Z',
      mine: false
    })
  })

  it('an event replaces a seat only with a strictly greater version', () => {
    let state = receive(withSnapshot(), locked('1A', 3))
    const before = state

    state = receive(state, { type: 'seat.released', flightId: FLIGHT_ID, seat: '1A', version: 3, reason: 'RELEASED' })
    state = receive(state, { type: 'seat.released', flightId: FLIGHT_ID, seat: '1A', version: 2, reason: 'RELEASED' })
    expect(state.seats).toEqual(before.seats)

    state = receive(state, { type: 'seat.released', flightId: FLIGHT_ID, seat: '1A', version: 4, reason: 'RELEASED' })
    expect(state.seats[FLIGHT_ID]['1A']).toEqual(expect.objectContaining({ status: SeatStatus.AVAILABLE, lockedUntil: null, version: 4 }))
  })

  it('applies a batch of events in order in a single action', () => {
    const state = receive(
      withSnapshot(),
      locked('1A', 1),
      { type: 'seat.released', flightId: FLIGHT_ID, seat: '1A', version: 2, reason: 'RELEASED' },
      locked('1B', 1)
    )
    expect(state.seats[FLIGHT_ID]['1A'].status).toBe(SeatStatus.AVAILABLE)
    expect(state.seats[FLIGHT_ID]['1B'].status).toBe(SeatStatus.BLOCKED)
  })

  it('seat.reserved marks the seat as sold', () => {
    const state = receive(withSnapshot(), { type: 'seat.reserved', flightId: FLIGHT_ID, seat: '1C', version: 1 })
    expect(state.seats[FLIGHT_ID]['1C']).toEqual(expect.objectContaining({ status: SeatStatus.RESERVED, mine: false }))
  })

  it('seat events for a flight without a snapshot are ignored, but still logged as activity', () => {
    const state = receive(initialState, locked('1A', 1))
    expect(state.seats).toEqual({})
    expect(state.activity[FLIGHT_ID]).toHaveLength(1)
  })

  it('heartbeats change nothing', () => {
    expect(receive(initialState, { type: 'heartbeat' })).toBe(initialState)
  })
})

describe('my lock (10.3)', () => {
  const myLock = { seat: '1A', lockedUntil: '2026-09-25T10:05:00.000Z', payableUntil: null }

  it('marks the new seat as mine and the previous one as not mine', () => {
    let state = withSnapshot()
    state = appReducer(state, { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: myLock })
    state = appReducer(state, { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: { ...myLock, seat: '1B' } })

    // The previous seat is free at once: it must not flash as "someone else's"
    expect(state.seats[FLIGHT_ID]['1A']).toEqual(
      expect.objectContaining({ mine: false, status: SeatStatus.AVAILABLE, lockedUntil: null })
    )
    expect(state.seats[FLIGHT_ID]['1B']).toEqual(expect.objectContaining({ mine: true, status: SeatStatus.BLOCKED }))
    expect(state.myLock[FLIGHT_ID]?.seat).toBe('1B')
  })

  it('releasing my lock frees the seat on the map', () => {
    let state = appReducer(withSnapshot(), { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: myLock })
    state = appReducer(state, { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: null })
    expect(state.seats[FLIGHT_ID]['1A'].status).toBe(SeatStatus.AVAILABLE)
    expect(state.myLock[FLIGHT_ID]).toBeNull()
  })

  it("a seat.locked that matches my lock is not shown as someone else's and refreshes the expiry", () => {
    let state = appReducer(withSnapshot(), { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: myLock })
    state = receive(state, locked('1A', 2, '2026-09-25T10:10:00.000Z'))

    expect(state.seats[FLIGHT_ID]['1A'].mine).toBe(true)
    expect(state.myLock[FLIGHT_ID]?.lockedUntil).toBe('2026-09-25T10:10:00.000Z')
  })

  it('an expired release of my seat clears my lock and announces it', () => {
    let state = appReducer(withSnapshot(), { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: myLock })
    state = receive(state, { type: 'seat.released', flightId: FLIGHT_ID, seat: '1A', version: 5, reason: 'EXPIRED' })

    expect(state.myLock[FLIGHT_ID]).toBeNull()
    expect(state.notice?.text).toBe('Tu bloqueo venció')
  })

  it('releasing my seat myself (or moving to another) shows no expiry notice', () => {
    let state = appReducer(withSnapshot(), { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: myLock })
    state = receive(state, { type: 'seat.released', flightId: FLIGHT_ID, seat: '1A', version: 5, reason: 'RELEASED' })
    expect(state.myLock[FLIGHT_ID]).toBeNull()
    expect(state.notice).toBeNull()
  })

  it("someone else's release does not touch my lock", () => {
    let state = appReducer(withSnapshot(), { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: myLock })
    state = receive(state, { type: 'seat.released', flightId: FLIGHT_ID, seat: '1B', version: 5, reason: 'EXPIRED' })
    expect(state.myLock[FLIGHT_ID]?.seat).toBe('1A')
    expect(state.notice).toBeNull()
  })

  it('a seat.reserved of my seat clears my lock', () => {
    let state = appReducer(withSnapshot(), { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: myLock })
    state = receive(state, { type: 'seat.reserved', flightId: FLIGHT_ID, seat: '1A', version: 9 })
    expect(state.myLock[FLIGHT_ID]).toBeNull()
  })
})

describe('activity and notices', () => {
  it('stamps each activity item with the time it arrived', () => {
    const state = receive(withSnapshot(), locked('1A', 1))
    expect(state.activity[FLIGHT_ID][0].at).toBe(1_000)
  })

  it('keeps the last 10 events per flight, newest first', () => {
    const events = Array.from({ length: 12 }, (_, i) => locked(`1A`, i + 1))
    const state = receive(withSnapshot(), ...events)

    expect(state.activity[FLIGHT_ID]).toHaveLength(10)
    expect((state.activity[FLIGHT_ID][0].event as { version: number }).version).toBe(12)
    expect((state.activity[FLIGHT_ID][9].event as { version: number }).version).toBe(3)
  })

  it('shows a notice and dismisses only the notice it belongs to', () => {
    let state = appReducer(initialState, { type: 'NOTICE_SHOWN', kind: 'info', text: 'Hola' })
    const id = state.notice!.id

    state = appReducer(state, { type: 'NOTICE_DISMISSED', id: id + 100 })
    expect(state.notice?.text).toBe('Hola')

    state = appReducer(state, { type: 'NOTICE_DISMISSED', id })
    expect(state.notice).toBeNull()
  })
})

describe('immutability', () => {
  it('never mutates the previous state', () => {
    const state = withSnapshot()
    const frozen = JSON.stringify(state)
    receive(state, locked('1A', 1), { type: 'seat.reserved', flightId: FLIGHT_ID, seat: '1B', version: 1 })
    appReducer(state, { type: 'MY_LOCK_SET', flightId: FLIGHT_ID, lock: { seat: '1C', lockedUntil: '2026-09-25T10:05:00.000Z', payableUntil: null } })
    expect(JSON.stringify(state)).toBe(frozen)
  })
})
