import { Flight, Seat, Reservation, Payment, Airport } from '../../domain/entities';
import {
  AcquiredSeat,
  ExpiredSeat,
  ExtendedLock,
  FlightAvailability,
  IdempotencyClaim,
  LockStageCounts,
  PayableLock,
  ReleasedSeat,
  SeatDiagnosis
} from '../../domain/interfaces';
import { TransactionContext } from './TransactionContext';

export interface FlightRepository {
  findById(tx: TransactionContext, id: string): Promise<Flight | null>;
  search(tx: TransactionContext, origin: string, destination: string, date: string): Promise<FlightAvailability[]>;
  // SELECT ... FOR NO KEY UPDATE on a bookable flight; false when it is not bookable
  lockForReservation(tx: TransactionContext, flightId: string): Promise<boolean>;
  // Returns the new version, or null when it was not the last seat
  markSoldOutIfFull(tx: TransactionContext, flightId: string): Promise<number | null>;
  // Returns the new version, or null when the flight is not ON_SALE
  cancel(tx: TransactionContext, flightId: string): Promise<number | null>;
}

export interface SeatRepository {
  findByFlightId(tx: TransactionContext, flightId: string): Promise<Seat[]>;
  databaseNow(tx: TransactionContext): Promise<Date>;
  releaseOtherLocks(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string): Promise<ReleasedSeat[]>;
  acquire(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string, ttlSeconds: number): Promise<AcquiredSeat | null>;
  release(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string): Promise<ReleasedSeat | null>;
  extend(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string, ttlSeconds: number): Promise<ExtendedLock | null>;
  reserve(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string): Promise<number | null>;
  expireLocks(tx: TransactionContext): Promise<ExpiredSeat[]>;
  // null means the flight does not exist
  diagnose(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string): Promise<SeatDiagnosis | null>;
  // Phase B of the purchase: own lock with payableUntil > now() on a bookable flight
  verifyPayable(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string, marginSeconds: number): Promise<PayableLock | null>;
  countLockStages(tx: TransactionContext, flightId: string): Promise<LockStageCounts>;
}

export interface ReservationRepository {
  // Returns null when the generated code collided with an existing one
  create(tx: TransactionContext, reservation: Reservation): Promise<Reservation | null>;
  findById(tx: TransactionContext, id: string): Promise<Reservation | null>;
  findByCode(tx: TransactionContext, code: string): Promise<Reservation | null>;
}

export interface PaymentRepository {
  insertAuthorized(tx: TransactionContext, idempotencyKey: string, authorizationRef: string, amount: number): Promise<void>;
  insertDeclined(tx: TransactionContext, idempotencyKey: string, amount: number): Promise<void>;
  findAuthorizedWithoutReservation(tx: TransactionContext, idempotencyKey: string): Promise<Payment | null>;
  // Number of rows linked; T2 requires exactly one
  linkReservation(tx: TransactionContext, idempotencyKey: string, reservationId: string): Promise<number>;
  markVoided(tx: TransactionContext, idempotencyKey: string): Promise<void>;
  markVoidFailed(tx: TransactionContext, idempotencyKey: string): Promise<void>;
}

export interface IdempotencyRepository {
  claim(tx: TransactionContext, key: string, clientId: string, requestHash: string): Promise<IdempotencyClaim>;
  // Number of rows completed; T2 requires exactly one
  complete(tx: TransactionContext, key: string, reservationId: string): Promise<number>;
  fail(tx: TransactionContext, key: string): Promise<void>;
  // Reservation id when the key is COMPLETED, null otherwise
  findCompletedReservationId(tx: TransactionContext, key: string): Promise<string | null>;
}

export interface AirportRepository {
  findAll(tx: TransactionContext): Promise<Airport[]>;
  findByCode(tx: TransactionContext, code: string): Promise<Airport | null>;
  // Today's date (YYYY-MM-DD) in the airport's time zone, from the database clock
  todayAt(tx: TransactionContext, code: string): Promise<string | null>;
}
