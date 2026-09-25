import React from 'react'
import { TextField } from '../../components'
import { CHECKOUT_LABELS } from '../../lib/labels'
import type { CheckoutForm, FieldName, FormErrors } from './validation'

interface CardFormProps {
  form: CheckoutForm
  errors: FormErrors
  disabled: boolean
  onChange: (name: FieldName, value: string) => void
  onBlur: (name: FieldName) => void
}

const F = CHECKOUT_LABELS.fields

// Simulated card. Its values live only in this form's state: never in the store or in storage.
export default function CardForm({ form, errors, disabled, onChange, onBlur }: CardFormProps): React.ReactElement {
  const bind = (name: FieldName) => ({
    value: form[name],
    error: errors[name],
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(name, event.target.value),
    onBlur: () => onBlur(name)
  })

  return (
    <section className="card checkout-card" aria-labelledby="card-title">
      <h2 id="card-title" className="checkout-card__title">
        {CHECKOUT_LABELS.cardTitle}
      </h2>

      <div className="checkout-grid">
        <div className="checkout-grid__full">
          <TextField
            id="holderName"
            label={F.holderName.label}
            placeholder={F.holderName.placeholder}
            autoComplete="cc-name"
            {...bind('holderName')}
          />
        </div>
        <div className="checkout-grid__full">
          <TextField
            id="cardNumber"
            label={F.cardNumber.label}
            placeholder={F.cardNumber.placeholder}
            autoComplete="cc-number"
            inputMode="numeric"
            maxLength={19}
            {...bind('cardNumber')}
          />
        </div>
        <TextField
          id="expiry"
          label={F.expiry.label}
          placeholder={F.expiry.placeholder}
          autoComplete="cc-exp"
          inputMode="numeric"
          maxLength={5}
          {...bind('expiry')}
        />
        <TextField
          id="cvv"
          type="password"
          label={F.cvv.label}
          placeholder={F.cvv.placeholder}
          autoComplete="cc-csc"
          inputMode="numeric"
          maxLength={4}
          {...bind('cvv')}
        />
      </div>
    </section>
  )
}
