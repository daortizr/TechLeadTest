import { describe, it, expect } from 'vitest'
import { DocumentType } from '@flight-reservations/shared'
import {
  emptyForm,
  firstInvalidField,
  formatCardNumber,
  formatExpiry,
  isExpired,
  normalizePhone,
  toReservationInput,
  validateField,
  validateForm
} from '../../../src/features/checkout/validation'
import type { CheckoutForm } from '../../../src/features/checkout/validation'

const NOW = new Date('2026-09-25T10:00:00.000Z').getTime()

const valid: CheckoutForm = {
  fullName: 'Laura Gómez Peña',
  email: 'laura@correo.com',
  phone: '+57 300 123 4567',
  documentType: DocumentType.CC,
  documentNumber: '1234567890',
  holderName: 'LAURA GOMEZ',
  cardNumber: '4111 1111 1111 1111',
  expiry: '12/30',
  cvv: '123'
}

const field = (name: keyof CheckoutForm, value: string, overrides: Partial<CheckoutForm> = {}) =>
  validateField(name, { ...valid, ...overrides, [name]: value } as CheckoutForm, NOW)

describe('input formatting', () => {
  it('groups the card number in fours and caps it at 16 digits', () => {
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111')
    expect(formatCardNumber('4111-1111 abcd 1111 1111 9999')).toBe('4111 1111 1111 1111')
    expect(formatCardNumber('41')).toBe('41')
    expect(formatCardNumber('')).toBe('')
  })

  it('puts the slash in the expiry by itself', () => {
    expect(formatExpiry('1')).toBe('1')
    expect(formatExpiry('12')).toBe('12')
    expect(formatExpiry('123')).toBe('12/3')
    expect(formatExpiry('1230')).toBe('12/30')
    expect(formatExpiry('12/3099')).toBe('12/30')
  })

  it('accepts spaces, hyphens and parentheses in the phone and sends none', () => {
    expect(normalizePhone('+57 (300) 123-4567')).toBe('+573001234567')
  })
})

describe('validateField', () => {
  it('requires every field', () => {
    for (const name of ['fullName', 'email', 'documentNumber', 'holderName', 'cardNumber', 'expiry', 'cvv'] as const) {
      expect(field(name, '')).toBe('Este campo es obligatorio')
    }
  })

  it('full name: 2 to 80 characters after trimming', () => {
    expect(field('fullName', 'A')).not.toBeNull()
    expect(field('fullName', '  Ana  ')).toBeNull()
    expect(field('fullName', 'x'.repeat(81))).not.toBeNull()
  })

  it('e-mail: must look like an address', () => {
    expect(field('email', 'sin-arroba')).not.toBeNull()
    expect(field('email', 'a@b')).not.toBeNull()
    expect(field('email', ' ana@correo.com ')).toBeNull()
  })

  it('phone: international format of 8 to 15 digits, whatever separators were typed', () => {
    expect(field('phone', '+57')).toBe('Este campo es obligatorio')
    expect(field('phone', '3001234567')).not.toBeNull()
    expect(field('phone', '+571234')).not.toBeNull()
    expect(field('phone', '+57 300 123 4567')).toBeNull()
    expect(field('phone', '+57-(300)-1234567')).toBeNull()
  })

  it('CC document: only 6 to 10 digits', () => {
    expect(field('documentNumber', 'ABC123', { documentType: DocumentType.CC })).toMatch(/cédula/)
    expect(field('documentNumber', '12345', { documentType: DocumentType.CC })).not.toBeNull()
    expect(field('documentNumber', '123456', { documentType: DocumentType.CC })).toBeNull()
  })

  it('CE and passport: 5 to 15 letters or digits, case-insensitive', () => {
    for (const documentType of [DocumentType.CE, DocumentType.PASSPORT]) {
      expect(field('documentNumber', 'ab123', { documentType })).toBeNull()
      expect(field('documentNumber', 'ab-123', { documentType })).not.toBeNull()
      expect(field('documentNumber', 'A123', { documentType })).not.toBeNull()
    }
  })

  it('card number: exactly 16 digits, spaces ignored', () => {
    expect(field('cardNumber', '4111 1111 1111 1111')).toBeNull()
    expect(field('cardNumber', '4111 1111 1111')).not.toBeNull()
  })

  it('expiry: MM/AA, real month, not expired', () => {
    expect(field('expiry', '1230')).toMatch(/MM\/AA/)
    expect(field('expiry', '13/30')).toMatch(/MM\/AA/)
    expect(field('expiry', '00/30')).toMatch(/MM\/AA/)
    expect(field('expiry', '08/26')).toBe('La tarjeta está vencida')
    expect(field('expiry', '12/30')).toBeNull()
  })

  it('CVV: 3 or 4 digits', () => {
    expect(field('cvv', '12')).not.toBeNull()
    expect(field('cvv', '123')).toBeNull()
    expect(field('cvv', '1234')).toBeNull()
    expect(field('cvv', '12345')).not.toBeNull()
  })
})

describe('isExpired', () => {
  it('a card is good until the end of its month', () => {
    expect(isExpired('09/26', NOW)).toBe(false) // September 2026 is still running
    expect(isExpired('08/26', NOW)).toBe(true)
    expect(isExpired('12/25', NOW)).toBe(true)
  })

  it('turns expired at the first instant of the next month', () => {
    const lastMoment = new Date(2026, 9, 1).getTime() - 1
    expect(isExpired('09/26', lastMoment)).toBe(false)
    expect(isExpired('09/26', lastMoment + 1)).toBe(true)
  })
})

describe('validateForm', () => {
  it('a complete form has no errors', () => {
    expect(validateForm(valid, NOW)).toEqual({})
  })

  it('an empty form fails everywhere except the document type, and the phone prefix does not count', () => {
    const errors = validateForm(emptyForm, NOW)
    expect(Object.keys(errors).sort()).toEqual(
      ['cardNumber', 'cvv', 'documentNumber', 'email', 'expiry', 'fullName', 'holderName', 'phone'].sort()
    )
  })

  it('the first invalid field follows the order on screen', () => {
    expect(firstInvalidField(validateForm(emptyForm, NOW))).toBe('fullName')
    expect(firstInvalidField(validateForm({ ...valid, cvv: '1', expiry: '01/20' }, NOW))).toBe('expiry')
    expect(firstInvalidField({})).toBeNull()
  })
})

describe('toReservationInput', () => {
  it('sends normalized values, like the server would', () => {
    const input = toReservationInput(
      { ...valid, fullName: '  Laura Gómez Peña ', email: ' Laura@Correo.COM ', documentNumber: ' ab123456 ', documentType: DocumentType.PASSPORT },
      'flight-1',
      '12C'
    )

    expect(input).toEqual({
      flightId: 'flight-1',
      seat: '12C',
      passenger: {
        fullName: 'Laura Gómez Peña',
        email: 'laura@correo.com',
        documentType: 'PASSPORT',
        documentNumber: 'AB123456',
        phone: '+573001234567'
      },
      payment: { holderName: 'LAURA GOMEZ', cardNumber: '4111111111111111', expiry: '12/30', cvv: '123' }
    })
  })
})
