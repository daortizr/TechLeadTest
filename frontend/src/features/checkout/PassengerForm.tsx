import React from 'react'
import { DocumentType } from '@flight-reservations/shared'
import { SelectField, TextField } from '../../components'
import { CHECKOUT_LABELS } from '../../lib/labels'
import type { CheckoutForm, FieldName, FormErrors } from './validation'

interface FormSectionProps {
  form: CheckoutForm
  errors: FormErrors
  disabled: boolean
  onChange: (name: FieldName, value: string) => void
  onBlur: (name: FieldName) => void
}

const F = CHECKOUT_LABELS.fields

const DOCUMENT_OPTIONS = [
  { value: DocumentType.CC, label: CHECKOUT_LABELS.documentTypes.CC },
  { value: DocumentType.CE, label: CHECKOUT_LABELS.documentTypes.CE },
  { value: DocumentType.PASSPORT, label: CHECKOUT_LABELS.documentTypes.PASSPORT }
]

export default function PassengerForm({ form, errors, disabled, onChange, onBlur }: FormSectionProps): React.ReactElement {
  const bind = (name: FieldName) => ({
    value: form[name],
    error: errors[name],
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(name, event.target.value),
    onBlur: () => onBlur(name)
  })

  return (
    <section className="card checkout-card" aria-labelledby="passenger-title">
      <h2 id="passenger-title" className="checkout-card__title">
        {CHECKOUT_LABELS.passengerTitle}
      </h2>

      <div className="checkout-grid">
        <div className="checkout-grid__full">
          <TextField
            id="fullName"
            label={F.fullName.label}
            placeholder={F.fullName.placeholder}
            autoComplete="name"
            {...bind('fullName')}
          />
        </div>
        <TextField
          id="email"
          type="email"
          label={F.email.label}
          placeholder={F.email.placeholder}
          autoComplete="email"
          inputMode="email"
          {...bind('email')}
        />
        <TextField
          id="phone"
          type="tel"
          label={F.phone.label}
          placeholder={F.phone.placeholder}
          autoComplete="tel"
          inputMode="tel"
          {...bind('phone')}
        />
        <SelectField
          id="documentType"
          label={F.documentType.label}
          options={DOCUMENT_OPTIONS}
          {...bind('documentType')}
        />
        <TextField
          id="documentNumber"
          label={F.documentNumber.label}
          placeholder={F.documentNumber.placeholder}
          autoComplete="off"
          {...bind('documentNumber')}
        />
      </div>
    </section>
  )
}
