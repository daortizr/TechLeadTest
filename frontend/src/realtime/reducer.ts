import { SeatStatus } from '@flight-reservations/shared'
import type { FlightDTO, FlightEvent } from '@flight-reservations/shared'
import { clockOffsetFrom } from '../lib/clock'
import type { ActivityItem, AppAction, AppState, MyLock, StoredSeat } from './types'

export const initialState: AppState = {
  connection: { state: 'connecting', lastMessageAt: null },
  clockOffsetMs: 0,
  flights: {},
  seats: {},
  myLock: {},
  activity: {},
  notice: null
}

const ACTIVITY_LIMIT = 10
const LOCK_EXPIRED_TEXT = 'Tu bloqueo venció'

let sequence = 0
function nextId(): number {
  sequence += 1
  return sequence
}

type SeatEvent = Extract<FlightEvent, { type: 'seat.locked' | 'seat.released' | 'seat.reserved' }>

// A seat is replaced only by a strictly newer version, so late or duplicated events are harmless
function applySeatEvent(state: AppState, event: SeatEvent): AppState {
  const flightSeats = state.seats[event.flightId]
  const stored = flightSeats?.[event.seat]
  if (!flightSeats || (stored && event.version <= stored.version)) {
    return state
  }

  const mineHere = state.myLock[event.flightId]?.seat === event.seat
  let seat: StoredSeat
  let myLock = state.myLock
  let notice = state.notice

  if (event.type === 'seat.locked') {
    // My own lock (or its checkout extension): keep it mine, don't show it as "someone else's"
    seat = { status: SeatStatus.BLOCKED, version: event.version, lockedUntil: event.lockedUntil, mine: mineHere }
    if (mineHere) {
      const current = state.myLock[event.flightId]
      if (current) {
        myLock = { ...myLock, [event.flightId]: { ...current, lockedUntil: event.lockedUntil } }
      }
    }
  } else if (event.type === 'seat.released') {
    seat = { status: SeatStatus.AVAILABLE, version: event.version, lockedUntil: null, mine: false }
    if (mineHere) {
      myLock = { ...myLock, [event.flightId]: null }
      if (event.reason === 'EXPIRED') {
        notice = { id: nextId(), kind: 'warning', text: LOCK_EXPIRED_TEXT }
      }
    }
  } else {
    seat = { status: SeatStatus.RESERVED, version: event.version, lockedUntil: null, mine: false }
    if (mineHere) {
      myLock = { ...myLock, [event.flightId]: null }
    }
  }

  return {
    ...state,
    seats: { ...state.seats, [event.flightId]: { ...flightSeats, [event.seat]: seat } },
    myLock,
    notice
  }
}

function applyFlightEvent(state: AppState, event: Extract<FlightEvent, { type: 'flight.updated' }>): AppState {
  const flight = state.flights[event.flightId]
  if (!flight || event.version <= flight.version) {
    return state
  }
  return {
    ...state,
    flights: {
      ...state.flights,
      [event.flightId]: { ...flight, status: event.status, availableSeats: event.availableSeats, version: event.version }
    }
  }
}

function recordActivity(state: AppState, event: Exclude<FlightEvent, { type: 'heartbeat' }>, receivedAt: number): AppState {
  const item: ActivityItem = { id: nextId(), at: receivedAt, event }
  const previous = state.activity[event.flightId] ?? []
  return {
    ...state,
    activity: { ...state.activity, [event.flightId]: [item, ...previous].slice(0, ACTIVITY_LIMIT) }
  }
}

function applyEvent(state: AppState, event: FlightEvent, receivedAt: number): AppState {
  if (event.type === 'heartbeat') return state
  const withActivity = recordActivity(state, event, receivedAt)
  return event.type === 'flight.updated' ? applyFlightEvent(withActivity, event) : applySeatEvent(withActivity, event)
}

function mergeFlight(existing: FlightDTO | undefined, incoming: FlightDTO): FlightDTO {
  // Same version still refreshes availability, which locks change without bumping the flight
  return existing && incoming.version < existing.version ? existing : incoming
}

export function appReducer(state: AppState = initialState, action: AppAction): AppState {
  switch (action.type) {
    case 'CONNECTION_CHANGED':
      return { ...state, connection: { ...state.connection, state: action.state } }

    case 'MESSAGE_RECEIVED':
      return { ...state, connection: { ...state.connection, lastMessageAt: action.at } }

    case 'FLIGHTS_LOADED': {
      const flights = { ...state.flights }
      for (const flight of action.flights) {
        flights[flight.id] = mergeFlight(flights[flight.id], flight)
      }
      return { ...state, flights }
    }

    case 'SNAPSHOT_LOADED': {
      const { snapshot, receivedAt } = action
      const flightId = snapshot.flight.id
      const previous = state.seats[flightId] ?? {}
      const seats: Record<string, StoredSeat> = {}
      const serverTimeMs = new Date(snapshot.serverTime).getTime()
      let mine: MyLock | null = null

      for (const dto of snapshot.seats) {
        const stored = previous[dto.seatNumber]
        // Newer local state (an event that beat the response) wins
        if (stored && stored.version > dto.version) {
          seats[dto.seatNumber] = stored
        } else {
          seats[dto.seatNumber] = {
            status: dto.status,
            version: dto.version,
            lockedUntil: dto.lockedUntil ?? null,
            mine: dto.mine
          }
        }
        // A lock that already ran out (by the server's clock) is not a selection any more
        if (dto.mine && dto.status === SeatStatus.BLOCKED && dto.lockedUntil && new Date(dto.lockedUntil).getTime() > serverTimeMs) {
          mine = { seat: dto.seatNumber, lockedUntil: dto.lockedUntil, payableUntil: dto.payableUntil ?? null }
        }
      }

      return {
        ...state,
        clockOffsetMs: clockOffsetFrom(snapshot.serverTime, receivedAt),
        flights: { ...state.flights, [flightId]: mergeFlight(state.flights[flightId], snapshot.flight) },
        seats: { ...state.seats, [flightId]: seats },
        myLock: { ...state.myLock, [flightId]: mine }
      }
    }

    case 'MY_LOCK_SET': {
      const flightSeats = state.seats[action.flightId]
      let seats = state.seats
      if (flightSeats) {
        // Reflect the lock on the map right away. The server released my previous seat in the same
        // operation, so it is free now (its event, with a higher version, will confirm it).
        const updated: Record<string, StoredSeat> = {}
        for (const [number, seat] of Object.entries(flightSeats)) {
          updated[number] = seat.mine
            ? { ...seat, status: SeatStatus.AVAILABLE, lockedUntil: null, mine: false }
            : seat
        }
        if (action.lock) {
          const current = updated[action.lock.seat]
          updated[action.lock.seat] = {
            status: SeatStatus.BLOCKED,
            version: current?.version ?? 0,
            lockedUntil: action.lock.lockedUntil,
            mine: true
          }
        }
        seats = { ...state.seats, [action.flightId]: updated }
      }
      return { ...state, seats, myLock: { ...state.myLock, [action.flightId]: action.lock } }
    }

    case 'EVENTS_RECEIVED':
      return action.events.reduce((current, event) => applyEvent(current, event, action.receivedAt), state)

    case 'NOTICE_SHOWN':
      return { ...state, notice: { id: nextId(), kind: action.kind, text: action.text } }

    case 'NOTICE_DISMISSED':
      return state.notice?.id === action.id ? { ...state, notice: null } : state

    default:
      return state
  }
}
