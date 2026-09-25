import { createHash } from 'crypto';

export interface RequestHashInput {
  flightId: string;
  seat: string;
  fullName: string;
  email: string;
  documentType: string;
  documentNumber: string;
  phone: string;
}

// Hash of the already-normalized flight, seat and passenger values.
// Card data is excluded so nothing derived from the number is stored.
export function hashRequest(input: RequestHashInput): string {
  const data = JSON.stringify({
    flightId: input.flightId,
    seat: input.seat,
    fullName: input.fullName,
    email: input.email,
    documentType: input.documentType,
    documentNumber: input.documentNumber,
    phone: input.phone
  });

  return createHash('sha256').update(data).digest('hex');
}
