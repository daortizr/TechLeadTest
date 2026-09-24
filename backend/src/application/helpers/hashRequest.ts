import { createHash } from 'crypto';

export interface RequestHashInput {
  flightId: string;
  seat: string;
  fullName: string;
  email: string;
  documentNumber: string;
}

// Hash the request data for idempotency
// Excludes payment data (card, expiry, cvv) to avoid hashing sensitive info
export function hashRequest(input: RequestHashInput): string {
  const data = JSON.stringify({
    flightId: input.flightId,
    seat: input.seat,
    fullName: input.fullName.trim().toLowerCase(),
    email: input.email.trim().toLowerCase(),
    documentNumber: input.documentNumber.trim().toUpperCase()
  });

  return createHash('sha256').update(data).digest('hex');
}
