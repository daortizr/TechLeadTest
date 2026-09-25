import { Flight, Seat, Reservation, Payment, IdempotencyKey, Airport } from '../../domain/entities';
import { TransactionContext } from './TransactionContext';

export interface FlightRepository {
  findById(tx: TransactionContext, id: string): Promise<Flight | null>;
  findByCode(tx: TransactionContext, code: string): Promise<Flight | null>;
  search(tx: TransactionContext, origin: string, destination: string, startDate: Date, endDate: Date): Promise<Flight[]>;
  update(tx: TransactionContext, flight: Flight): Promise<void>;
}

export interface SeatRepository {
  findBySeatNumber(tx: TransactionContext, flightId: string, seatNumber: string): Promise<Seat | null>;
  findByFlightId(tx: TransactionContext, flightId: string): Promise<Seat[]>;
  lock(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string, ttlSeconds: number): Promise<Seat | null>;
  unlock(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string): Promise<Seat | null>;
  reserve(tx: TransactionContext, flightId: string, seatNumber: string, clientId: string): Promise<Seat | null>;
}

export interface ReservationRepository {
  create(tx: TransactionContext, reservation: Reservation): Promise<Reservation>;
  findById(tx: TransactionContext, id: string): Promise<Reservation | null>;
  findByCode(tx: TransactionContext, code: string): Promise<Reservation | null>;
}

export interface PaymentRepository {
  create(tx: TransactionContext, payment: Payment): Promise<Payment>;
  findById(tx: TransactionContext, id: string): Promise<Payment | null>;
  update(tx: TransactionContext, payment: Payment): Promise<void>;
}

export interface IdempotencyRepository {
  claim(tx: TransactionContext, key: string, clientId: string, requestHash: string): Promise<IdempotencyKey | null>;
  findByKey(tx: TransactionContext, key: string): Promise<IdempotencyKey | null>;
  markCompleted(tx: TransactionContext, key: string, reservationId: string): Promise<void>;
  markFailed(tx: TransactionContext, key: string): Promise<void>;
}

export interface AirportRepository {
  findAll(tx: TransactionContext): Promise<Airport[]>;
  findByCode(tx: TransactionContext, code: string): Promise<Airport | null>;
}
