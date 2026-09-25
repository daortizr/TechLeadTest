import { Flight, Seat, Reservation } from '../../domain/entities';
import { FlightDTO, SeatDTO, ReservationDTO, SeatSnapshotDTO } from '@flight-reservations/shared';
import { seatEffectiveStatus } from '../helpers';

export const FlightMapper = {
  toDTO(flight: Flight, availableSeats?: number): FlightDTO {
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
      availableSeats
    };
  }
};

export const SeatMapper = {
  toDTO(seat: Seat, clientId: string | undefined, now: Date): SeatDTO {
    const effectiveStatus = seatEffectiveStatus(seat, now);
    const mine = seat.status === 'BLOCKED' && seat.lockedBy === clientId;

    return {
      seatNumber: seat.seatNumber,
      status: effectiveStatus,
      mine,
      lockedUntil: seat.lockedUntil?.toISOString(),
      payableUntil: seat.checkoutStartedAt ? new Date(seat.lockedUntil!.getTime() - 10 * 1000).toISOString() : undefined,
      version: seat.version
    };
  }
};

export const ReservationMapper = {
  toDTO(reservation: Reservation): ReservationDTO {
    return {
      code: reservation.code,
      flightId: reservation.flightId,
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
        available: seats.filter(s => s.status === 'AVAILABLE').length,
        blocked: seats.filter(s => s.status === 'BLOCKED').length,
        reserved: seats.filter(s => s.status === 'RESERVED').length,
        total: seats.length
      },
      seats
    };
  }
};
