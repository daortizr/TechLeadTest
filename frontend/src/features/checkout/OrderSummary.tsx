import React from 'react'
import type { FlightDTO } from '@flight-reservations/shared'
import { AlertIcon, Button, Countdown } from '../../components'
import { formatDeparture, formatFlightCode, formatPrice, formatTime } from '../../lib/format'
import { CHECKOUT_LABELS } from '../../lib/labels'

interface OrderSummaryProps {
  flight: FlightDTO
  originCity: string
  destinationCity: string
  seat: string
  // The countdown runs to payableUntil, never to lockedUntil
  payableUntil: string
  submitting: boolean
  canSubmit: boolean
  message: string | null
  onBack: () => void
  onExpire: () => void
}

export default function OrderSummary({
  flight,
  originCity,
  destinationCity,
  seat,
  payableUntil,
  submitting,
  canSubmit,
  message,
  onBack,
  onExpire
}: OrderSummaryProps): React.ReactElement {
  const price = formatPrice(flight.priceCents, flight.currency)

  return (
    <aside className="card summary" aria-labelledby="summary-title">
      <h2 id="summary-title" className="checkout-card__title">
        {CHECKOUT_LABELS.summaryTitle}
      </h2>

      <p className="summary__flight">
        {formatFlightCode(flight.code)} · {originCity} a {destinationCity}
      </p>
      <p className="summary__when">
        {formatDeparture(flight.departureAt)} – {formatTime(flight.arrivalAt)}
      </p>

      <dl className="summary__rows">
        <div className="summary__row">
          <dt>{CHECKOUT_LABELS.seat}</dt>
          <dd>{seat}</dd>
        </div>
        <div className="summary__row">
          <dt>{CHECKOUT_LABELS.fare}</dt>
          <dd>{price}</dd>
        </div>
        <div className="summary__row summary__row--total">
          <dt>{CHECKOUT_LABELS.total}</dt>
          <dd>{price}</dd>
        </div>
      </dl>

      <Countdown
        variant="sentence"
        until={payableUntil}
        label={CHECKOUT_LABELS.countdownBefore}
        suffix={CHECKOUT_LABELS.countdownAfter}
        onExpire={onExpire}
      />

      <div className="summary__message" role="alert">
        {message && (
          <p className="summary__error">
            <AlertIcon size={18} />
            <span>{message}</span>
          </p>
        )}
      </div>

      <Button type="submit" fullWidth disabled={!canSubmit || submitting}>
        {submitting ? CHECKOUT_LABELS.submitting : CHECKOUT_LABELS.submit}
      </Button>

      <button type="button" className="summary__back" disabled={submitting} onClick={onBack}>
        {CHECKOUT_LABELS.backToMap}
      </button>
    </aside>
  )
}
