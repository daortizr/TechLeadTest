import { useCallback, useState } from 'react'
import {
  emptyForm,
  firstInvalidField,
  formatCardNumber,
  formatExpiry,
  digitsOnly,
  validateField,
  validateForm
} from './validation'
import type { CheckoutForm, FieldName, FormErrors } from './validation'

interface UseCheckoutForm {
  form: CheckoutForm
  errors: FormErrors
  setField: (name: FieldName, value: string) => void
  blurField: (name: FieldName) => void
  // Validates everything; returns the first invalid field (already focused) or null
  validateAll: () => FieldName | null
}

// Form state only: nothing here is stored anywhere, and it goes away with the screen.
// `nowMs` is the server clock, used for the card's expiry.
export function useCheckoutForm(nowMs: () => number): UseCheckoutForm {
  const [form, setForm] = useState<CheckoutForm>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})

  const setField = useCallback(
    (name: FieldName, value: string) => {
      // Inputs are formatted as the user types: cards in groups of 4, expiry with its slash
      const next =
        name === 'cardNumber' ? formatCardNumber(value) : name === 'expiry' ? formatExpiry(value) : name === 'cvv' ? digitsOnly(value).slice(0, 4) : value

      const updated = { ...form, [name]: next } as CheckoutForm
      setForm(updated)

      // A field already marked invalid is re-checked as it is fixed, so the message goes away at once
      setErrors((current) => {
        const revalidate: FieldName[] = name === 'documentType' ? ['documentType', 'documentNumber'] : [name]
        const copy = { ...current }
        for (const field of revalidate) {
          if (!copy[field]) continue
          const error = validateField(field, updated, nowMs())
          if (error) copy[field] = error
          else delete copy[field]
        }
        return copy
      })
    },
    [form, nowMs]
  )

  const blurField = useCallback(
    (name: FieldName) => {
      const error = validateField(name, form, nowMs())
      setErrors((current) => {
        const copy = { ...current }
        if (error) copy[name] = error
        else delete copy[name]
        return copy
      })
    },
    [form, nowMs]
  )

  const validateAll = useCallback((): FieldName | null => {
    const all = validateForm(form, nowMs())
    setErrors(all)
    const first = firstInvalidField(all)
    if (first) document.getElementById(first)?.focus()
    return first
  }, [form, nowMs])

  return { form, errors, setField, blurField, validateAll }
}
