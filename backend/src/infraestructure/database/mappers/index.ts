import { Airport, Flight, Seat, Reservation, Payment, IdempotencyKey } from '../../../domain/entities';
import { FlightStatus, SeatStatus, IdempotencyKeyStatus, PaymentStatus } from '../../../domain/enums';
import {
  AirportEntity,
  FlightEntity,
  SeatEntity,
  ReservationEntity,
  PaymentEntity,
  IdempotencyKeyEntity
} from '../entities';

export const AirportMapper = {
  toDomain(entity: AirportEntity): Airport {
    return new Airport(entity.code, entity.name, entity.city, entity.timezone);
  }
};

export const FlightMapper = {
  toDomain(entity: FlightEntity): Flight {
    return new Flight(
      entity.id,
      entity.code,
      entity.origin,
      entity.destination,
      entity.departure_at,
      entity.arrival_at,
      entity.price_cents,
      entity.currency,
      entity.status as FlightStatus,
      entity.version,
      entity.created_at
    );
  },

  toEntity(domain: Flight): FlightEntity {
    const entity = new FlightEntity();
    entity.id = domain.id;
    entity.code = domain.code;
    entity.origin = domain.origin;
    entity.destination = domain.destination;
    entity.departure_at = domain.departureAt;
    entity.arrival_at = domain.arrivalAt;
    entity.price_cents = domain.priceCents;
    entity.currency = domain.currency;
    entity.status = domain.status;
    entity.version = domain.version;
    entity.created_at = domain.createdAt;
    return entity;
  }
};

export const SeatMapper = {
  toDomain(entity: SeatEntity): Seat {
    return new Seat(
      entity.flight_id,
      entity.seat_number,
      entity.row_number,
      entity.column_letter,
      entity.status as SeatStatus,
      entity.locked_by,
      entity.locked_until,
      entity.checkout_started_at,
      entity.version
    );
  },

  toEntity(domain: Seat): SeatEntity {
    const entity = new SeatEntity();
    entity.flight_id = domain.flightId;
    entity.seat_number = domain.seatNumber;
    entity.row_number = domain.rowNumber;
    entity.column_letter = domain.columnLetter;
    entity.status = domain.status;
    entity.locked_by = domain.lockedBy;
    entity.locked_until = domain.lockedUntil;
    entity.checkout_started_at = domain.checkoutStartedAt;
    entity.version = domain.version;
    return entity;
  }
};

export const ReservationMapper = {
  toDomain(entity: ReservationEntity): Reservation {
    return new Reservation(
      entity.id,
      entity.code,
      entity.flight_id,
      entity.seat_number,
      entity.passenger_name,
      entity.passenger_email,
      entity.client_id,
      entity.price_cents,
      entity.currency,
      entity.created_at
    );
  },

  toEntity(domain: Reservation): ReservationEntity {
    const entity = new ReservationEntity();
    entity.id = domain.id;
    entity.code = domain.code;
    entity.flight_id = domain.flightId;
    entity.seat_number = domain.seatNumber;
    entity.passenger_name = domain.passengerName;
    entity.passenger_email = domain.passengerEmail;
    entity.client_id = domain.clientId;
    entity.price_cents = domain.priceCents;
    entity.currency = domain.currency;
    entity.created_at = domain.createdAt;
    return entity;
  }
};

export const PaymentMapper = {
  toDomain(entity: PaymentEntity): Payment {
    return new Payment(
      entity.id,
      entity.idempotency_key,
      entity.reservation_id,
      entity.authorization_ref,
      entity.amount_cents,
      entity.status as PaymentStatus,
      entity.created_at
    );
  },

  toEntity(domain: Payment): PaymentEntity {
    const entity = new PaymentEntity();
    entity.id = domain.id;
    entity.idempotency_key = domain.idempotencyKey;
    entity.reservation_id = domain.reservationId;
    entity.authorization_ref = domain.authorizationRef;
    entity.amount_cents = domain.amountCents;
    entity.status = domain.status;
    entity.created_at = domain.createdAt;
    return entity;
  }
};

export const IdempotencyKeyMapper = {
  toDomain(entity: IdempotencyKeyEntity): IdempotencyKey {
    return new IdempotencyKey(
      entity.key,
      entity.client_id,
      entity.request_hash,
      entity.status as IdempotencyKeyStatus,
      entity.reservation_id,
      entity.created_at
    );
  },

  toEntity(domain: IdempotencyKey): IdempotencyKeyEntity {
    const entity = new IdempotencyKeyEntity();
    entity.key = domain.key;
    entity.client_id = domain.clientId;
    entity.request_hash = domain.requestHash;
    entity.status = domain.status;
    entity.reservation_id = domain.reservationId;
    entity.created_at = domain.createdAt;
    return entity;
  }
};
