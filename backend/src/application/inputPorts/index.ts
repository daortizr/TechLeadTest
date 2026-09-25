// Input ports define the contract of each use case; controllers depend on these, not on the classes.
import {
  AirportDTO,
  CheckoutDTO,
  FlightDTO,
  LockDTO,
  LockStagesDTO,
  ReservationDTO,
  SeatSnapshotDTO
} from '@flight-reservations/shared';
import { CreateReservationCommand, SearchFlightsQuery } from '../dtos';

export interface ListAirportsInputPort {
  execute(): Promise<AirportDTO[]>;
}

export interface SearchFlightsInputPort {
  execute(query: SearchFlightsQuery): Promise<FlightDTO[]>;
}

export interface GetSeatSnapshotInputPort {
  execute(flightId: string, clientId?: string): Promise<SeatSnapshotDTO>;
}

export interface LockSeatInputPort {
  execute(flightId: string, seat: string, clientId: string): Promise<LockDTO>;
}

export interface UnlockSeatInputPort {
  execute(flightId: string, seat: string, clientId: string): Promise<void>;
}

export interface StartCheckoutInputPort {
  execute(flightId: string, seat: string, clientId: string): Promise<CheckoutDTO>;
}

export interface CreateReservationResult {
  reservation: ReservationDTO;
  // false when an earlier request with the same idempotency key had already completed
  created: boolean;
}

export interface CreateReservationInputPort {
  execute(command: CreateReservationCommand): Promise<CreateReservationResult>;
}

export interface GetReservationInputPort {
  execute(code: string): Promise<ReservationDTO>;
}

export interface ChangeFlightStatusInputPort {
  execute(flightId: string, action: 'cancel'): Promise<FlightDTO>;
}

export interface GetLockStagesInputPort {
  execute(flightId: string): Promise<LockStagesDTO>;
}

export interface ExpireLocksInputPort {
  // Number of locks released
  execute(): Promise<number>;
}
