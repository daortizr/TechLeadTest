import { z } from 'zod';
import { DocumentType } from '@flight-reservations/shared';

const airportCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);

function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

// MM/YY, valid until the end of that month
function isNotExpired(value: string): boolean {
  const [month, year] = value.split('/').map(Number);
  return new Date(2000 + year, month, 1).getTime() > Date.now();
}

// Params and query
export const searchFlightsSchema = z
  .object({
    origin: airportCode,
    destination: airportCode,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isRealDate)
  })
  .refine((query) => query.origin !== query.destination, {
    message: 'origin y destination deben ser distintos',
    path: ['destination']
  });

export const flightParamsSchema = z.object({
  id: z.string().uuid()
});

export const seatParamsSchema = z.object({
  id: z.string().uuid(),
  seat: z.string().regex(/^[1-9][0-9]{0,2}[A-Z]$/)
});

export const reservationCodeSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(16)
});

// Headers
export const clientIdSchema = z.string().uuid();
export const idempotencyKeySchema = z.string().trim().min(1).max(128);

// Body: values are normalized before validation (trim, lowercase e-mail, uppercase document,
// phone without spaces, hyphens or parentheses)
const passengerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().max(254).email(),
    documentType: z.nativeEnum(DocumentType),
    documentNumber: z.string().trim().toUpperCase().max(15),
    phone: z
      .string()
      .transform((value) => value.replace(/[\s\-()]/g, ''))
      .pipe(z.string().regex(/^\+[1-9][0-9]{7,14}$/))
  })
  .superRefine((passenger, ctx) => {
    const valid =
      passenger.documentType === DocumentType.CC
        ? /^[0-9]{6,10}$/.test(passenger.documentNumber)
        : /^[A-Z0-9]{5,15}$/.test(passenger.documentNumber);
    if (!valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['documentNumber'], message: 'Número de documento inválido' });
    }
  });

const paymentSchema = z.object({
  holderName: z.string().trim().min(2).max(80),
  cardNumber: z
    .string()
    .transform((value) => value.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{16}$/)),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/)
    .refine(isNotExpired),
  cvv: z.string().regex(/^\d{3,4}$/)
});

export const createReservationSchema = z.object({
  flightId: z.string().uuid(),
  seat: z.string().regex(/^[1-9][0-9]{0,2}[A-Z]$/),
  passenger: passengerSchema,
  payment: paymentSchema
});

export type SearchFlightsParams = z.infer<typeof searchFlightsSchema>;
export type CreateReservationBody = z.infer<typeof createReservationSchema>;
