import { describe, it, expect } from 'vitest'
import { appReducer } from '../../src/realtime/reducer'
import { AppState, AppAction } from '../../src/realtime/types'
import { SeatStatus } from '@flight-reservations/shared'

describe('appReducer', () => {
  const initialState: AppState = {
    connection: { state: 'connecting', lastMessageAt: null },
    clockOffsetMs: 0,
    flights: {},
    seats: {},
    myLock: {},
    activity: {},
  }

  it('should handle CONNECTION_LIVE action', () => {
    const action: AppAction = { type: 'CONNECTION_LIVE' }
    const newState = appReducer(initialState, action)

    expect(newState.connection.state).toBe('live')
    expect(newState.connection.lastMessageAt).toBeTruthy()
  })

  it('should handle SET_FLIGHTS action', () => {
    const flights = [
      { id: 'flight-1', code: 'AV001', status: 'ON_SALE' } as any,
      { id: 'flight-2', code: 'AV002', status: 'ON_SALE' } as any,
    ]
    const action: AppAction = { type: 'SET_FLIGHTS', flights }

    const newState = appReducer(initialState, action)

    expect(Object.keys(newState.flights)).toHaveLength(2)
    expect(newState.flights['flight-1']).toEqual(flights[0])
    expect(newState.flights['flight-2']).toEqual(flights[1])
  })

  it('should handle SET_SEAT_SNAPSHOT action', () => {
    const seats = [
      { seatNumber: '1A', status: SeatStatus.AVAILABLE } as any,
      { seatNumber: '1B', status: SeatStatus.BLOCKED } as any,
    ]
    const flight = { id: 'flight-1', code: 'AV001' } as any

    const action: AppAction = {
      type: 'SET_SEAT_SNAPSHOT',
      flightId: 'flight-1',
      seats,
      flight,
    }

    const newState = appReducer(initialState, action)

    expect(newState.flights['flight-1']).toEqual(flight)
    expect(newState.seats['flight-1']['1A']).toEqual(seats[0])
    expect(newState.seats['flight-1']['1B']).toEqual(seats[1])
  })

  it('should handle seat.locked event', () => {
    const state: AppState = {
      ...initialState,
      flights: { 'flight-1': { id: 'flight-1' } as any },
      seats: { 'flight-1': { '1A': { seatNumber: '1A', status: SeatStatus.AVAILABLE } } } as any,
    }

    const action: AppAction = {
      type: 'EVENT',
      event: {
        type: 'seat.locked',
        flightId: 'flight-1',
        seat: '1A',
        lockedUntil: new Date().toISOString(),
        version: 1,
      } as any,
    }

    const newState = appReducer(state, action)

    expect(newState.seats['flight-1']['1A'].status).toBe(SeatStatus.BLOCKED)
    expect(newState.seats['flight-1']['1A'].version).toBe(1)
  })

  it('should handle seat.released event', () => {
    const state: AppState = {
      ...initialState,
      flights: { 'flight-1': { id: 'flight-1' } as any },
      seats: {
        'flight-1': {
          '1A': { seatNumber: '1A', status: SeatStatus.BLOCKED, version: 1 } as any,
        },
      },
    }

    const action: AppAction = {
      type: 'EVENT',
      event: {
        type: 'seat.released',
        flightId: 'flight-1',
        seat: '1A',
        version: 2,
      } as any,
    }

    const newState = appReducer(state, action)

    expect(newState.seats['flight-1']['1A'].status).toBe(SeatStatus.AVAILABLE)
    expect(newState.seats['flight-1']['1A'].version).toBe(2)
  })

  it('should handle seat.reserved event', () => {
    const state: AppState = {
      ...initialState,
      flights: { 'flight-1': { id: 'flight-1' } as any },
      seats: {
        'flight-1': {
          '1A': { seatNumber: '1A', status: SeatStatus.BLOCKED, version: 1 } as any,
        },
      },
      myLock: { 'flight-1': { seat: '1A', lockedUntil: new Date() } },
    }

    const action: AppAction = {
      type: 'EVENT',
      event: {
        type: 'seat.reserved',
        flightId: 'flight-1',
        seat: '1A',
        version: 2,
      } as any,
    }

    const newState = appReducer(state, action)

    expect(newState.seats['flight-1']['1A'].status).toBe(SeatStatus.RESERVED)
    expect(newState.myLock['flight-1']).toBeNull()
  })

  it('should handle flight.updated event', () => {
    const state: AppState = {
      ...initialState,
      flights: {
        'flight-1': { id: 'flight-1', status: 'ON_SALE', availableSeats: 10, version: 1 } as any,
      },
    }

    const action: AppAction = {
      type: 'EVENT',
      event: {
        type: 'flight.updated',
        flightId: 'flight-1',
        status: 'SOLD_OUT',
        availableSeats: 0,
        version: 2,
      } as any,
    }

    const newState = appReducer(state, action)

    expect(newState.flights['flight-1'].status).toBe('SOLD_OUT')
    expect(newState.flights['flight-1'].availableSeats).toBe(0)
    expect(newState.flights['flight-1'].version).toBe(2)
  })

  it('should ignore stale events (older version)', () => {
    const state: AppState = {
      ...initialState,
      flights: { 'flight-1': { id: 'flight-1', status: 'ON_SALE', version: 3 } as any },
    }

    const action: AppAction = {
      type: 'EVENT',
      event: {
        type: 'flight.updated',
        flightId: 'flight-1',
        status: 'CANCELLED',
        version: 2, // Older version
      } as any,
    }

    const newState = appReducer(state, action)

    // Status should not change since event version is older
    expect(newState.flights['flight-1'].status).toBe('ON_SALE')
  })

  it('should handle SET_MY_LOCK action', () => {
    const action: AppAction = {
      type: 'SET_MY_LOCK',
      flightId: 'flight-1',
      lock: { seat: '1A', lockedUntil: new Date().toISOString() },
    }

    const newState = appReducer(initialState, action)

    expect(newState.myLock['flight-1']).toBeTruthy()
    expect(newState.myLock['flight-1'].seat).toBe('1A')
    expect(newState.myLock['flight-1'].lockedUntil instanceof Date).toBe(true)
  })

  it('should handle CLEAR_MY_LOCK action', () => {
    const state: AppState = {
      ...initialState,
      myLock: { 'flight-1': { seat: '1A', lockedUntil: new Date() } },
    }

    const action: AppAction = { type: 'CLEAR_MY_LOCK', flightId: 'flight-1' }

    const newState = appReducer(state, action)

    expect(newState.myLock['flight-1']).toBeNull()
  })

  it('should maintain activity log with limit', () => {
    const state: AppState = {
      ...initialState,
      flights: { 'flight-1': { id: 'flight-1' } as any },
    }

    // Add 15 events
    let currentState = state
    for (let i = 0; i < 15; i++) {
      const action: AppAction = {
        type: 'EVENT',
        event: {
          type: 'seat.locked',
          flightId: 'flight-1',
          seat: `${i}A`,
          version: i,
        } as any,
      }
      currentState = appReducer(currentState, action)
    }

    // Activity should be limited to 10
    expect(currentState.activity['flight-1']).toHaveLength(10)
  })
})
