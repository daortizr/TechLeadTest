import { FlightDTO, SeatDTO, FlightEvent } from '@flight-reservations/shared'

export type ConnectionState = 'connecting' | 'live' | 'reconnecting'

export interface AppState {
  connection: {
    state: ConnectionState
    lastMessageAt: Date | null
  }
  clockOffsetMs: number
  flights: Record<string, FlightDTO>
  seats: Record<string, Record<string, SeatDTO>>
  myLock: Record<string, { seat: string; lockedUntil: Date } | null>
  activity: Record<string, FlightEvent[]>
}

export type AppAction =
  | { type: 'CONNECTION_CONNECTING' }
  | { type: 'CONNECTION_LIVE' }
  | { type: 'CONNECTION_RECONNECTING' }
  | { type: 'SET_CLOCK_OFFSET'; offset: number }
  | { type: 'SET_FLIGHTS'; flights: FlightDTO[] }
  | { type: 'SET_SEAT_SNAPSHOT'; flightId: string; seats: SeatDTO[]; flight: FlightDTO }
  | { type: 'SET_MY_LOCK'; flightId: string; lock: { seat: string; lockedUntil: string } | null }
  | { type: 'EVENT'; event: FlightEvent }
  | { type: 'CLEAR_MY_LOCK'; flightId: string }
