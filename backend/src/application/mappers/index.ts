import { Airport, Flight, Seat, Reservation } from '../../domain/entities';
import { SeatStatus } from '../../domain/enums';
import {
  AirportDTO,
  FlightDTO,
  SeatDTO,
  ReservationDTO,
  SeatSnapshotDTO
} from '@flight-reservations/shared';
import { seatEffectiveStatus } from '../helpers';

export const AirportMapper = {
  toDTO(airport: Airport): AirportDTO {
    return {
      code: airport.code,
      name: airport.name,
      city: airport.city,
      timezone: airport.timezone
    };
  }
};

export const FlightMapper = {
  toDTO(flight: Flight, availableSeats?: number, totalSeats?: number): FlightDTO {
    return {
      id: flight.id,
      code: flight.code,
      origin: flight.origin,
      destination: flight.destination,
      departureAt: flight.departureAt.toISOString(),
      arrivalAt: flight.arrivalAt.toISOString(),
      priceCents: flight.priceCents,
      currency: flight.currency,
      status: flight.status,
      version: flight.version,
      ...(availableSeats !== undefined && { availableSeats }),
      ...(totalSeats !== undefined && { totalSeats })
    };
  }
};

// lockedBy never leaves the server: only `mine`, computed with the caller's client id
export const SeatMapper = {
  toDTO(
    seat: Seat,
    clientId: string | undefined,
    now: Date,
    paymentMarginSeconds: number
  ): SeatDTO {
    const status = seatEffectiveStatus(seat, now);
    const blocked = status === SeatStatus.BLOCKED && seat.lockedUntil !== null;
    const mine = blocked && clientId !== undefined && seat.lockedBy === clientId;
    const payableUntil =
      mine && seat.checkoutStartedAt && seat.lockedUntil
        ? new Date(seat.lockedUntil.getTime() - paymentMarginSeconds * 1000)
        : null;

    return {
      seatNumber: seat.seatNumber,
      status,
      mine,
      ...(blocked && seat.lockedUntil && { lockedUntil: seat.lockedUntil.toISOString() }),
      ...(payableUntil && { payableUntil: payableUntil.toISOString() }),
      version: seat.version
    };
  }
};

// The ticket only shows the passenger's name, never document, phone or email
export const ReservationMapper = {
  toDTO(reservation: Reservation, flight: FlightDTO): ReservationDTO {
    return {
      code: reservation.code,
      flight,
      seat: reservation.seatNumber,
      passengerName: reservation.passengerName,
      priceCents: reservation.priceCents,
      currency: reservation.currency,
      createdAt: reservation.createdAt.toISOString()
    };
  }
};

export const SeatSnapshotMapper = {
  toDTO(flight: FlightDTO, seats: SeatDTO[], now: Date): SeatSnapshotDTO {
    return {
      flight,
      serverTime: now.toISOString(),
      counts: {
        available: seats.filter((s) => s.status === SeatStatus.AVAILABLE).length,
        blocked: seats.filter((s) => s.status === SeatStatus.BLOCKED).length,
        reserved: seats.filter((s) => s.status === SeatStatus.RESERVED).length,
        total: seats.length
      },
      seats
    };
  }
};
