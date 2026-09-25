import { Flight } from '../entities';
import { FlightStatus, SeatStatus } from '../enums';

export interface FlightAvailability {
  flight: Flight;
  availableSeats: number;
  totalSeats: number;
}

export interface AcquiredSeat {
  seatNumber: string;
  version: number;
  lockedUntil: Date;
}

export interface ReleasedSeat {
  seatNumber: string;
  version: number;
}

export interface ExtendedLock {
  lockedUntil: Date;
  version: number;
}

export interface ExpiredSeat {
  flightId: string;
  seatNumber: string;
  version: number;
}

export interface PayableLock {
  price: number;
  currency: string;
}

export interface LockStageCounts {
  selecting: number;
  checkout: number;
}

// Explains why a conditional UPDATE affected no rows. It never exposes locked_by.
export interface SeatDiagnosis {
  seatExists: boolean;
  seatStatus: SeatStatus | null;
  seatVersion: number | null;
  lockedUntil: Date | null;
  lockedByCaller: boolean;
  lockActive: boolean;
  checkoutStarted: boolean;
  flightStatus: FlightStatus;
  flightDepartsLater: boolean;
}

export type IdempotencyClaim =
  | { outcome: 'CLAIMED' }
  | { outcome: 'COMPLETED'; reservationId: string }
  | { outcome: 'IN_PROGRESS' }
  | { outcome: 'MISMATCH' };
