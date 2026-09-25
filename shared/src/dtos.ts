import { FlightStatus, SeatStatus } from './enums';

// Flight DTOs
export interface FlightDTO {
  id: string;
  code: string;
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  priceCents: number;
  currency: string;
  status: FlightStatus;
  version: number;
  availableSeats?: number;
}

// Seat DTOs
export interface SeatDTO {
  seatNumber: string;
  status: SeatStatus;
  mine: boolean;
  lockedUntil?: string;
  payableUntil?: string;
  version: number;
}

export interface SeatSnapshotDTO {
  flight: FlightDTO;
  serverTime: string;
  counts: {
    available: number;
    blocked: number;
    reserved: number;
    total: number;
  };
  seats: SeatDTO[];
}

// Reservation DTOs
export interface ReservationDTO {
  code: string;
  flightId: string;
  seat: string;
  passengerName: string;
  priceCents: number;
  currency: string;
  createdAt: string;
}

// Passenger DTOs
export interface PassengerDTO {
  fullName: string;
  email: string;
  documentType: string;
  documentNumber: string;
  phone: string;
}

// Payment DTOs
export interface PaymentDTO {
  holderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

// Error DTOs
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
