import React from 'react'
import { FlightStatus } from '@flight-reservations/shared'
import type { FlightDTO } from '@flight-reservations/shared'
import { Button, LockIcon, StatusPill, XIcon } from '../../components'
import { formatFlightCode, formatPrice, formatTime } from '../../lib/format'
import { FLIGHT_STATUS_LABELS, NO_SEATS_NOW_LABEL, seatsLabel } from '../../lib/labels'

// What the card's button does. The screen using the card decides: a customer can only open
// flights that are on sale, an administrator can open any of them.
export interface CardAction {
  label: string
  disabled: boolean
  // Quieter card for a flight that cannot be used, with the reason next to it
  muted: boolean
  reason: string | null
  onClick: () => void
}

interface FlightCardProps {
  flight: FlightDTO
  originCity: string
  destinationCity: string
  action: CardAction
}

function StatusBadge({ status, available }: { status: FlightStatus; available: number }): React.ReactElement {
  if (status === FlightStatus.CANCELLED || status === FlightStatus.SOLD_OUT) {
    return (
      <StatusPill tone="muted" icon={<XIcon size={14} />}>
        {FLIGHT_STATUS_LABELS[status]}
      </StatusPill>
    )
  }
  // ON_SALE with every seat locked for now: not the same as sold out
  if (available === 0) {
    return (
      <StatusPill tone="amber" icon={<LockIcon size={14} />}>
        {NO_SEATS_NOW_LABEL}
      </StatusPill>
    )
  }
  return <StatusPill tone="ok">{FLIGHT_STATUS_LABELS[status]}</StatusPill>
}

export default function FlightCard({ flight, originCity, destinationCity, action }: FlightCardProps): React.ReactElement {
  const available = flight.availableSeats ?? 0
  const total = flight.totalSeats ?? 0

  return (
    <li className={`flight-card${action.muted ? ' flight-card--unavailable' : ''}`}>
      <div className="flight-card__main">
        <p className="flight-card__title">
          <span className="flight-card__code">{formatFlightCode(flight.code)}</span>
          <span className="flight-card__route">
            {originCity} → {destinationCity}
          </span>
        </p>
        <p className="flight-card__times">
          <span className="visually-hidden">Salida y llegada: </span>
          {formatTime(flight.departureAt)} – {formatTime(flight.arrivalAt)}
        </p>
      </div>

      <div className="flight-card__status">
        <StatusBadge status={flight.status} available={available} />
      </div>

      <p className="flight-card__seats">{seatsLabel(available, total)}</p>

      <p className="flight-card__price">{formatPrice(flight.price, flight.currency)}</p>

      <div className="flight-card__action">
        <Button
          variant="outline"
          disabled={action.disabled}
          onClick={action.onClick}
          aria-label={`${action.label}, vuelo ${formatFlightCode(flight.code)}`}
        >
          {action.label}
        </Button>
      </div>

      {action.reason && <p className="flight-card__reason">{action.reason}</p>}
    </li>
  )
}
