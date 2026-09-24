// Input ports define the contracts for all use cases
// Each use case implements one of these interfaces

export interface ListAirportsInputPort {
  execute(): Promise<void>;
}

export interface SearchFlightsInputPort {
  execute(origin: string, destination: string, date: string): Promise<void>;
}

export interface GetSeatSnapshotInputPort {
  execute(flightId: string, clientId?: string): Promise<void>;
}

export interface LockSeatInputPort {
  execute(flightId: string, seat: string, clientId: string, ttlSeconds: number): Promise<void>;
}

export interface UnlockSeatInputPort {
  execute(flightId: string, seat: string, clientId: string): Promise<void>;
}

export interface StartCheckoutInputPort {
  execute(flightId: string, seat: string, clientId: string, ttlSeconds: number): Promise<void>;
}

export interface CreateReservationInputPort {
  execute(
    flightId: string,
    seat: string,
    clientId: string,
    idempotencyKey: string,
    requestHash: string,
    passenger: { fullName: string; email: string; documentType: string; documentNumber: string; phone: string },
    payment: { holderName: string; cardNumber: string; expiry: string; cvv: string }
  ): Promise<void>;
}

export interface GetReservationInputPort {
  execute(code: string): Promise<void>;
}

export interface ChangeFlightStatusInputPort {
  execute(flightId: string, action: 'cancel'): Promise<void>;
}

export interface GetLockStagesInputPort {
  execute(flightId: string): Promise<void>;
}

export interface ExpireLocksInputPort {
  execute(): Promise<void>;
}
