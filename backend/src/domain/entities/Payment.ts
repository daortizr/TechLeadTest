import { PaymentStatus } from '../enums';

export class Payment {
  constructor(
    readonly id: string,
    readonly idempotencyKey: string,
    readonly reservationId: string | null,
    readonly authorizationRef: string | null,
    readonly amount: number,
    readonly status: PaymentStatus,
    readonly createdAt: Date
  ) {}
}
