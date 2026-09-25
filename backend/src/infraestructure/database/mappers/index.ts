import { Airport, Flight, Seat, Reservation, Payment } from '../../../domain/entities';
import { FlightStatus, SeatStatus, PaymentStatus } from '../../../domain/enums';
import { AirportEntity, FlightEntity, SeatEntity, ReservationEntity, PaymentEntity } from '../entities';

// Raw SQL rows have the same column names as the entities, without relations
export type AirportRecord = AirportEntity;
export type FlightRecord = Omit<FlightEntity, 'originAirport' | 'destinationAirport' | 'seats'>;
export type SeatRecord = Omit<SeatEntity, 'flight'>;
export type ReservationRecord = ReservationEntity;
export type PaymentRecord = PaymentEntity;

export const AirportMapper = {
  toDomain(record: AirportRecord): Airport {
    return new Airport(record.code, record.name, record.city, record.timezone);
  }
};

export const FlightMapper = {
  toDomain(record: FlightRecord): Flight {
    return new Flight(
      record.id,
      record.code,
      record.origin,
      record.destination,
      record.departure_at,
      record.arrival_at,
      record.price_cents,
      record.currency,
      record.status as FlightStatus,
      record.version,
      record.created_at
    );
  }
};

export const SeatMapper = {
  toDomain(record: SeatRecord): Seat {
    return new Seat(
      record.flight_id,
      record.seat_number,
      record.row_number,
      record.column_letter,
      record.status as SeatStatus,
      record.locked_by,
      record.locked_until,
      record.checkout_started_at,
      record.version
    );
  }
};

export const ReservationMapper = {
  toDomain(record: ReservationRecord): Reservation {
    return new Reservation(
      record.id,
      record.code,
      record.flight_id,
      record.seat_number,
      record.passenger_name,
      record.passenger_email,
      record.passenger_document_type,
      record.passenger_document_number,
      record.passenger_phone,
      record.client_id,
      record.price_cents,
      record.currency,
      record.created_at
    );
  }
};

export const PaymentMapper = {
  toDomain(record: PaymentRecord): Payment {
    return new Payment(
      record.id,
      record.idempotency_key,
      record.reservation_id,
      record.authorization_ref,
      record.amount_cents,
      record.status as PaymentStatus,
      record.created_at
    );
  }
};
