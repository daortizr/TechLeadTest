import { IdempotencyKeyStatus } from '../enums';

export class IdempotencyKey {
  constructor(
    readonly key: string,
    readonly clientId: string,
    readonly requestHash: string,
    readonly status: IdempotencyKeyStatus,
    readonly reservationId: string | null,
    readonly createdAt: Date
  ) {}
}
