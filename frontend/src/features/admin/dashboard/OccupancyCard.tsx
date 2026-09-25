import React from 'react'
import { FlightStatus } from '@flight-reservations/shared'
import type { FlightDTO } from '@flight-reservations/shared'
import { StatusPill, XIcon } from '../../../components'
import { useThrottledValue } from '../../../hooks/useThrottledValue'
import { formatFlightCode } from '../../../lib/format'
import { ADMIN_LABELS, FLIGHT_STATUS_LABELS } from '../../../lib/labels'
import type { FlightCounts } from '../../../realtime'

interface OccupancyCardProps {
  flight: FlightDTO
  originCity: string
  destinationCity: string
  counts: FlightCounts
}

const D = ADMIN_LABELS.dashboard

export default function OccupancyCard({ flight, originCity, destinationCity, counts }: OccupancyCardProps): React.ReactElement {
  const { available, blocked, reserved, total, occupancyPercent } = counts
  const share = (value: number): string => `${total === 0 ? 0 : (value / total) * 100}%`

  // A polite live region: the summary is announced at most once per second
  const summary = `${occupancyPercent}% ocupado: ${available} libres, ${blocked} bloqueados, ${reserved} vendidos`
  const spoken = useThrottledValue(summary)

  const cancelledOrSold = flight.status !== FlightStatus.ON_SALE

  return (
    <section className="card dash-card" aria-labelledby="dash-title">
      <header className="dash-head">
        <h1 id="dash-title" className="dash-title">
          {formatFlightCode(flight.code)} · {originCity} a {destinationCity}
        </h1>
        {cancelledOrSold ? (
          <StatusPill tone="muted" icon={<XIcon size={14} />}>
            {FLIGHT_STATUS_LABELS[flight.status]}
          </StatusPill>
        ) : (
          <StatusPill tone="ok">{FLIGHT_STATUS_LABELS[flight.status]}</StatusPill>
        )}
      </header>

      <p className="dash-percent">
        {occupancyPercent}% {D.occupied}
      </p>

      {/* Sold in red, blocked in amber, the rest free: the tiles below carry the same numbers as text */}
      <div className="dash-bar" role="img" aria-label={summary}>
        <span className="dash-bar__sold" style={{ width: share(reserved) }} />
        <span className="dash-bar__blocked" style={{ width: share(blocked) }} />
      </div>

      <dl className="dash-tiles">
        <div className="dash-tile">
          <dt>{D.free}</dt>
          <dd>{available}</dd>
        </div>
        <div className="dash-tile">
          <dt>{D.blocked}</dt>
          <dd>{blocked}</dd>
        </div>
        <div className="dash-tile">
          <dt>{D.sold}</dt>
          <dd>{reserved}</dd>
        </div>
        <div className="dash-tile">
          <dt>{D.total}</dt>
          <dd>{total}</dd>
        </div>
      </dl>

      <p className="visually-hidden" role="status" aria-live="polite">
        {spoken}
      </p>
    </section>
  )
}
