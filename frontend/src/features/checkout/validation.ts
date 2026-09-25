import { DocumentType } from '@flight-reservations/shared'
import type { CreateReservationInput } from '../../api/client'
import { CHECKOUT_LABELS } from '../../lib/labels'

// Client-side mirror of the server rules (architecture.md 9.3). The server validates again and
// stays the authority: this only tells the user early and in place.

export interface CheckoutForm {
  fullName: string
  email: string
  phone: string
  documentType: DocumentType
  documentNumber: string
  holderName: string
  cardNumber: string
  expiry: string
  cvv: string
}

export type FieldName = keyof CheckoutForm
export type FormErrors = Partial<Record<FieldName, string>>

// Order on screen: the first invalid one takes the focus
export const FIELD_ORDER: FieldName[] = [
  'fullName',
  'email',
  'phone',
  'documentType',
  'documentNumber',
  'holderName',
  'cardNumber',
  'expiry',
  'cvv'
]

const DEFAULT_PHONE_PREFIX = '+57'

export const emptyForm: CheckoutForm = {
  fullName: '',
  email: '',
  phone: DEFAULT_PHONE_PREFIX,
  documentType: DocumentType.CC,
  documentNumber: '',
  holderName: '',
  cardNumber: '',
  expiry: '',
  cvv: ''
}

const E = CHECKOUT_LABELS.errors
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

// "4111111111111111" typed in any way becomes "4111 1111 1111 1111" (at most 16 digits)
export function formatCardNumber(value: string): string {
  return (digitsOnly(value).slice(0, 16).match(/.{1,4}/g) ?? []).join(' ')
}

// "1230" becomes "12/30"; the slash appears by itself
export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

// The user may type spaces, hyphens and parentheses; the value sent has none
export function normalizePhone(value: string): string {
  return value.replace(/[\s\-()]/g, '')
}

export function normalizeDocumentNumber(value: string): string {
  return value.trim().toUpperCase()
}

// MM/AA is valid until the end of that month. `nowMs` is the server's clock.
export function isExpired(expiry: string, nowMs: number): boolean {
  const [month, year] = expiry.split('/').map(Number)
  return new Date(2000 + year, month, 1).getTime() <= nowMs
}

export function validateField(name: FieldName, form: CheckoutForm, nowMs: number): string | null {
  const value = form[name]

  switch (name) {
    case 'fullName': {
      const trimmed = value.trim()
      if (!trimmed) return E.required
      return trimmed.length < 2 || trimmed.length > 80 ? E.fullName : null
    }
    case 'email': {
      const trimmed = value.trim()
      if (!trimmed) return E.required
      return EMAIL.test(trimmed) && trimmed.length <= 254 ? null : E.email
    }
    case 'phone': {
      const phone = normalizePhone(value)
      // The country prefix the field starts with does not count as a number typed by the user
      if (!phone || phone === '+' || phone === DEFAULT_PHONE_PREFIX) return E.required
      return /^\+[1-9][0-9]{7,14}$/.test(phone) ? null : E.phone
    }
    case 'documentType':
      return null
    case 'documentNumber': {
      const number = normalizeDocumentNumber(value)
      if (!number) return E.required
      if (form.documentType === DocumentType.CC) return /^[0-9]{6,10}$/.test(number) ? null : E.documentCC
      return /^[A-Z0-9]{5,15}$/.test(number) ? null : E.documentOther
    }
    case 'holderName': {
      const trimmed = value.trim()
      if (!trimmed) return E.required
      return trimmed.length < 2 || trimmed.length > 80 ? E.holderName : null
    }
    case 'cardNumber': {
      if (!value.trim()) return E.required
      return /^\d{16}$/.test(value.replace(/\s/g, '')) ? null : E.cardNumber
    }
    case 'expiry': {
      if (!value.trim()) return E.required
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value.trim())) return E.expiryFormat
      return isExpired(value.trim(), nowMs) ? E.expiryPast : null
    }
    case 'cvv': {
      if (!value) return E.required
      return /^\d{3,4}$/.test(value) ? null : E.cvv
    }
  }
}

export function validateForm(form: CheckoutForm, nowMs: number): FormErrors {
  const errors: FormErrors = {}
  for (const name of FIELD_ORDER) {
    const error = validateField(name, form, nowMs)
    if (error) errors[name] = error
  }
  return errors
}

export function firstInvalidField(errors: FormErrors): FieldName | null {
  return FIELD_ORDER.find((name) => errors[name]) ?? null
}

// What the server receives, already trimmed and normalized like the server would do
export function toReservationInput(form: CheckoutForm, flightId: string, seat: string): CreateReservationInput {
  return {
    flightId,
    seat,
    passenger: {
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      documentType: form.documentType,
      documentNumber: normalizeDocumentNumber(form.documentNumber),
      phone: normalizePhone(form.phone)
    },
    payment: {
      holderName: form.holderName.trim(),
      cardNumber: form.cardNumber.replace(/\s/g, ''),
      expiry: form.expiry.trim(),
      cvv: form.cvv
    }
  }
}
