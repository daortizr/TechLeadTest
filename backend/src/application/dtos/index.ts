// Settings and commands of the use cases

export interface SeatLockSettings {
  lockTtlSeconds: number;
  checkoutTtlSeconds: number;
  paymentMarginSeconds: number;
}

export interface SearchFlightsQuery {
  origin: string;
  destination: string;
  date: string;
}

export interface CreateReservationCommand {
  flightId: string;
  seat: string;
  clientId: string;
  idempotencyKey: string;
  // Values are already trimmed and normalized at the HTTP edge
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
