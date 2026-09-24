import { FlightStatus } from './enums';

export type FlightEvent =
  | SeatLockedEvent
  | SeatReleasedEvent
  | SeatReservedEvent
  | FlightUpdatedEvent
  | HeartbeatEvent;

export interface SeatLockedEvent {
  type: 'seat.locked';
  flightId: string;
  seat: string;
  version: number;
  lockedUntil: string;
}

export interface SeatReleasedEvent {
  type: 'seat.released';
  flightId: string;
  seat: string;
  version: number;
  reason: 'EXPIRED' | 'RELEASED';
}

export interface SeatReservedEvent {
  type: 'seat.reserved';
  flightId: string;
  seat: string;
  version: number;
}

export interface FlightUpdatedEvent {
  type: 'flight.updated';
  flightId: string;
  status: FlightStatus;
  availableSeats: number;
  version: number;
}

export interface HeartbeatEvent {
  type: 'heartbeat';
}
