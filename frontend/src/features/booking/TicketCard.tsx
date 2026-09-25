import React from 'react'
import type { ReservationDTO } from '@flight-reservations/shared'
import { formatDeparture, formatFlightCode, formatPrice } from '../../lib/format'
import { BOOKING_LABELS } from '../../lib/labels'

interface TicketCardProps {
  ticket: ReservationDTO
  originCity: string
  destinationCity: string
}

// Only the passenger's name: the ticket never shows document, phone or e-mail
export default function TicketCard({ ticket, originCity, destinationCity }: TicketCardProps): React.ReactElement {
  const { flight } = ticket

  return (
    <section className="card ticket" aria-label="Boleto">
      <p className="ticket__label">{BOOKING_LABELS.code}</p>
      {/* Spelled out for screen readers: "7 H K 3 F 9" */}
      <p className="ticket__code" aria-label={ticket.code.split('').join(' ')}>
        {ticket.code}
      </p>

      <dl className="ticket__rows">
        <div className="ticket__row">
          <dt>{BOOKING_LABELS.flight}</dt>
          <dd>{formatFlightCode(flight.code)}</dd>
        </div>
        <div className="ticket__row">
          <dt>{BOOKING_LABELS.route}</dt>
          <dd>
            {originCity} → {destinationCity}
          </dd>
        </div>
        <div className="ticket__row">
          <dt>{BOOKING_LABELS.date}</dt>
          <dd>{formatDeparture(flight.departureAt)}</dd>
        </div>
        <div className="ticket__row">
          <dt>{BOOKING_LABELS.seat}</dt>
          <dd>{ticket.seat}</dd>
        </div>
        <div className="ticket__row">
          <dt>{BOOKING_LABELS.passenger}</dt>
          <dd>{ticket.passengerName}</dd>
        </div>
        <div className="ticket__row ticket__row--total">
          <dt>{BOOKING_LABELS.totalPaid}</dt>
          <dd>{formatPrice(ticket.priceCents, ticket.currency)}</dd>
        </div>
      </dl>
    </section>
  )
}
