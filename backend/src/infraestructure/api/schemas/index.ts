import { z } from 'zod';

// Query/Path parameters
export const searchFlightsSchema = z.object({
  origin: z.string().length(3).toUpperCase(),
  destination: z.string().length(3).toUpperCase(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const flightIdSchema = z.object({
  id: z.string().uuid()
});

export const seatLockSchema = z.object({
  flightId: z.string().uuid(),
  seat: z.string()
});

// Headers
export const clientIdHeaderSchema = z.object({
  'x-client-id': z.string().uuid()
});

export const adminKeyHeaderSchema = z.object({
  'x-admin-key': z.string()
});

export const idempotencyKeyHeaderSchema = z.object({
  'idempotency-key': z.string()
});

// Body schemas
export const createReservationSchema = z.object({
  flightId: z.string().uuid(),
  seat: z.string(),
  passenger: z.object({
    fullName: z.string().min(2).max(80),
    email: z.string().email(),
    documentType: z.enum(['CC', 'CE', 'PASSPORT']),
    documentNumber: z.string().min(5).max(15),
    phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/)
  }),
  payment: z.object({
    holderName: z.string().min(2).max(80),
    cardNumber: z.string().regex(/^\d{16}$/),
    expiry: z.string().regex(/^\d{2}\/\d{2}$/),
    cvv: z.string().regex(/^\d{3,4}$/)
  })
});

export const changeFlightStatusSchema = z.object({
  action: z.enum(['cancel'])
});

// Type exports
export type SearchFlightsParams = z.infer<typeof searchFlightsSchema>;
export type CreateReservationBody = z.infer<typeof createReservationSchema>;
export type ChangeFlightStatusBody = z.infer<typeof changeFlightStatusSchema>;
