export class Reservation {
  constructor(
    readonly id: string,
    readonly code: string,
    readonly flightId: string,
    readonly seatNumber: string,
    readonly passengerName: string,
    readonly passengerEmail: string,
    readonly passengerDocumentType: string,
    readonly passengerDocumentNumber: string,
    readonly passengerPhone: string,
    readonly clientId: string,
    readonly priceCents: number,
    readonly currency: string,
    readonly createdAt: Date
  ) {}
}
