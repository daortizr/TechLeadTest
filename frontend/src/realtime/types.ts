import type { FlightDTO, FlightEvent, SeatSnapshotDTO, SeatStatus } from '@flight-reservations/shared'

export type ConnectionState = 'connecting' | 'live' | 'reconnecting'

export interface StoredSeat {
  status: SeatStatus
  version: number
  lockedUntil: string | null
  mine: boolean
}

// The seat this tab holds on a flight
export interface MyLock {
  seat: string
  lockedUntil: string
  // Only once checkout started: the countdown runs to here, never to lockedUntil
  payableUntil: string | null
}

export interface ActivityItem {
  id: number
  // Local time (ms) when the event reached this tab, for "hace 4 s"
  at: number
  event: Exclude<FlightEvent, { type: 'heartbeat' }>
}

export interface Notice {
  id: number
  kind: 'info' | 'warning'
  text: string
}

export interface AppState {
  connection: { state: ConnectionState; lastMessageAt: number | null }
  // serverTime minus local time, from the last snapshot
  clockOffsetMs: number
  flights: Record<string, FlightDTO>
  seats: Record<string, Record<string, StoredSeat>>
  myLock: Record<string, MyLock | null>
  // Last 10 events per flight, memory only
  activity: Record<string, ActivityItem[]>
  notice: Notice | null
}

export type AppAction =
  | { type: 'CONNECTION_CHANGED'; state: ConnectionState }
  | { type: 'MESSAGE_RECEIVED'; at: number }
  | { type: 'FLIGHTS_LOADED'; flights: FlightDTO[] }
  | { type: 'SNAPSHOT_LOADED'; snapshot: SeatSnapshotDTO; receivedAt: number }
  | { type: 'MY_LOCK_SET'; flightId: string; lock: MyLock | null }
  | { type: 'EVENTS_RECEIVED'; events: FlightEvent[]; receivedAt: number }
  | { type: 'NOTICE_SHOWN'; kind: Notice['kind']; text: string }
  | { type: 'NOTICE_DISMISSED'; id: number }
