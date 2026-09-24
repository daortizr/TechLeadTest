import { FlightStatus } from '../enums';

export class Flight {
  constructor(
    readonly id: string,
    readonly code: string,
    readonly origin: string,
    readonly destination: string,
    readonly departureAt: Date,
    readonly arrivalAt: Date,
    readonly priceCents: number,
    readonly currency: string,
    readonly status: FlightStatus,
    readonly version: number,
    readonly createdAt: Date
  ) {}
}
