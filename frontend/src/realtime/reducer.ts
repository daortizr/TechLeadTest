import { AppState, AppAction } from './types'
import { SeatStatus } from '@flight-reservations/shared'

const initialState: AppState = {
  connection: { state: 'connecting', lastMessageAt: null },
  clockOffsetMs: 0,
  flights: {},
  seats: {},
  myLock: {},
  activity: {},
}

export function appReducer(state: AppState = initialState, action: AppAction): AppState {
  switch (action.type) {
    case 'CONNECTION_CONNECTING':
      return {
        ...state,
        connection: { state: 'connecting', lastMessageAt: state.connection.lastMessageAt },
      }

    case 'CONNECTION_LIVE':
      return {
        ...state,
        connection: { state: 'live', lastMessageAt: new Date() },
      }

    case 'CONNECTION_RECONNECTING':
      return {
        ...state,
        connection: { state: 'reconnecting', lastMessageAt: state.connection.lastMessageAt },
      }

    case 'SET_CLOCK_OFFSET':
      return { ...state, clockOffsetMs: action.offset }

    case 'SET_FLIGHTS':
      return {
        ...state,
        flights: action.flights.reduce((acc, flight) => {
          acc[flight.id] = flight
          return acc
        }, {} as Record<string, any>),
      }

    case 'SET_SEAT_SNAPSHOT': {
      const { flightId, seats, flight } = action
      return {
        ...state,
        flights: { ...state.flights, [flightId]: flight },
        seats: {
          ...state.seats,
          [flightId]: seats.reduce((acc, seat) => {
            acc[seat.seatNumber] = seat
            return acc
          }, {} as Record<string, any>),
        },
      }
    }

    case 'EVENT': {
      const { event } = action

      // Add to activity log (limit to 10 per flight)
      const flightId = 'flightId' in event ? event.flightId : ''
      const activity = state.activity[flightId] || []
      const newActivity = [event, ...activity].slice(0, 10)

      let newState = {
        ...state,
        activity: { ...state.activity, [flightId]: newActivity },
      }

      // Handle specific event types
      if (event.type === 'seat.locked') {
        if (!newState.seats[event.flightId]) {
          newState.seats[event.flightId] = {}
        }
        newState.seats[event.flightId][event.seat] = {
          seatNumber: event.seat,
          status: SeatStatus.BLOCKED,
          mine: false,
          lockedUntil: event.lockedUntil,
          version: event.version,
        }
      } else if (event.type === 'seat.released') {
        if (newState.seats[event.flightId]?.[event.seat]) {
          newState.seats[event.flightId][event.seat] = {
            ...newState.seats[event.flightId][event.seat],
            status: SeatStatus.AVAILABLE,
            lockedUntil: undefined,
            version: event.version,
          }
        }
      } else if (event.type === 'seat.reserved') {
        if (newState.seats[event.flightId]?.[event.seat]) {
          newState.seats[event.flightId][event.seat] = {
            ...newState.seats[event.flightId][event.seat],
            status: SeatStatus.RESERVED,
            lockedUntil: undefined,
            mine: false,
            version: event.version,
          }
        }
        // Clear my lock if it was my seat
        if (newState.myLock[event.flightId]?.seat === event.seat) {
          newState.myLock[event.flightId] = null
        }
      } else if (event.type === 'flight.updated') {
        if (newState.flights[event.flightId]) {
          newState.flights[event.flightId] = {
            ...newState.flights[event.flightId],
            status: event.status,
            availableSeats: event.availableSeats,
            version: event.version,
          }
        }
      }

      return newState
    }

    case 'CLEAR_MY_LOCK':
      return {
        ...state,
        myLock: { ...state.myLock, [action.flightId]: null },
      }

    default:
      return state
  }
}
