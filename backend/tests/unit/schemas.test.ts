import { describe, it, expect } from 'vitest';
import { createReservationSchema, searchFlightsSchema } from '../../src/infraestructure/api/schemas';
import { hashRequest } from '../../src/application/helpers';

const FLIGHT_ID = '2a50be1e-9fd9-4e1b-923f-9ed2d1f58679';

function body(overrides: { passenger?: object; payment?: object } = {}) {
  return {
    flightId: FLIGHT_ID,
    seat: '12C',
    passenger: {
      fullName: '  Ana Gómez ',
      email: ' ANA@Example.COM ',
      documentType: 'CC',
      documentNumber: '1000200300',
      phone: '+57 (300) 123-4567',
      ...overrides.passenger
    },
    payment: {
      holderName: 'ANA GOMEZ',
      cardNumber: '4111 1111 1111 1111',
      expiry: '12/99',
      cvv: '123',
      ...overrides.payment
    }
  };
}

describe('createReservationSchema normalization (9.3)', () => {
  it('trims names, lowercases the e-mail and strips the phone and card number', () => {
    const parsed = createReservationSchema.parse(body());
    expect(parsed.passenger.fullName).toBe('Ana Gómez');
    expect(parsed.passenger.email).toBe('ana@example.com');
    expect(parsed.passenger.phone).toBe('+573001234567');
    expect(parsed.payment.cardNumber).toBe('4111111111111111');
  });

  it('uppercases the document number', () => {
    const parsed = createReservationSchema.parse(
      body({ passenger: { documentType: 'PASSPORT', documentNumber: ' ab123456 ' } })
    );
    expect(parsed.passenger.documentNumber).toBe('AB123456');
  });

  it('CC accepts only 6 to 10 digits; CE and PASSPORT accept 5 to 15 alphanumerics', () => {
    expect(createReservationSchema.safeParse(body({ passenger: { documentNumber: 'ABC123' } })).success).toBe(false);
    expect(createReservationSchema.safeParse(body({ passenger: { documentNumber: '12345' } })).success).toBe(false);
    expect(createReservationSchema.safeParse(body({ passenger: { documentType: 'CE', documentNumber: 'AB123' } })).success).toBe(true);
  });

  it('requires an E.164 phone of 8 to 15 digits', () => {
    expect(createReservationSchema.safeParse(body({ passenger: { phone: '3001234567' } })).success).toBe(false);
    expect(createReservationSchema.safeParse(body({ passenger: { phone: '+571234' } })).success).toBe(false);
  });

  it('rejects an invalid e-mail, an unknown document type and a short name', () => {
    expect(createReservationSchema.safeParse(body({ passenger: { email: 'nope' } })).success).toBe(false);
    expect(createReservationSchema.safeParse(body({ passenger: { documentType: 'DNI' } })).success).toBe(false);
    expect(createReservationSchema.safeParse(body({ passenger: { fullName: 'A' } })).success).toBe(false);
  });

  it('validates the card: 16 digits, MM/YY not expired, 3 or 4 digit CVV', () => {
    expect(createReservationSchema.safeParse(body({ payment: { cardNumber: '4111' } })).success).toBe(false);
    expect(createReservationSchema.safeParse(body({ payment: { expiry: '13/30' } })).success).toBe(false);
    expect(createReservationSchema.safeParse(body({ payment: { expiry: '01/20' } })).success).toBe(false);
    expect(createReservationSchema.safeParse(body({ payment: { cvv: '12' } })).success).toBe(false);
    expect(createReservationSchema.safeParse(body({ payment: { cvv: '1234' } })).success).toBe(true);
  });

  it('rejects a malformed seat and a non-uuid flight', () => {
    expect(createReservationSchema.safeParse({ ...body(), seat: 'C12' }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...body(), flightId: 'abc' }).success).toBe(false);
  });
});

describe('searchFlightsSchema', () => {
  it('normalizes airport codes to uppercase', () => {
    const parsed = searchFlightsSchema.parse({ origin: ' bog ', destination: 'mde', date: '2026-09-25' });
    expect(parsed).toEqual({ origin: 'BOG', destination: 'MDE', date: '2026-09-25' });
  });

  it('requires distinct airports and a real calendar date', () => {
    expect(searchFlightsSchema.safeParse({ origin: 'BOG', destination: 'bog', date: '2026-09-25' }).success).toBe(false);
    expect(searchFlightsSchema.safeParse({ origin: 'BOG', destination: 'MDE', date: '2026-02-30' }).success).toBe(false);
    expect(searchFlightsSchema.safeParse({ origin: 'BOG', destination: 'MDE', date: '25/09/2026' }).success).toBe(false);
    expect(searchFlightsSchema.safeParse({ origin: 'BOGOTA', destination: 'MDE', date: '2026-09-25' }).success).toBe(false);
  });
});

describe('hashRequest', () => {
  const base = {
    flightId: FLIGHT_ID,
    seat: '12C',
    fullName: 'Ana Gómez',
    email: 'ana@example.com',
    documentType: 'CC',
    documentNumber: '1000200300',
    phone: '+573001234567'
  };

  it('is stable for the same normalized values', () => {
    expect(hashRequest(base)).toBe(hashRequest({ ...base }));
  });

  it('changes when any passenger, flight or seat value changes', () => {
    for (const change of [{ seat: '12D' }, { fullName: 'Ana G' }, { phone: '+573009999999' }, { documentType: 'CE' }]) {
      expect(hashRequest({ ...base, ...change })).not.toBe(hashRequest(base));
    }
  });

  it('never depends on card data', () => {
    const withCard = { ...base, cardNumber: '4111111111111111' } as typeof base;
    expect(hashRequest(withCard)).toBe(hashRequest(base));
  });
});
