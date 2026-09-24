// Input DTOs for use cases
export interface LockSeatRequest {
  flightId: string;
  seat: string;
  clientId: string;
}

export interface CreateReservationRequest {
  flightId: string;
  seat: string;
  clientId: string;
  idempotencyKey: string;
  requestHash: string;
  passenger: {
    fullName: string;
    email: string;
    documentType: string;
    documentNumber: string;
    phone: string;
  };
  payment: {
    holderName: string;
    cardNumber: string;
    expiry: string;
    cvv: string;
  };
}

export interface SearchFlightsRequest {
  origin: string;
  destination: string;
  date: string;
}

export interface ChangeFlightStatusRequest {
  flightId: string;
  action: 'cancel';
}
