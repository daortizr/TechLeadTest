import React from 'react'
import { useThrottledValue } from '../../hooks/useThrottledValue'
import { SEAT_LABELS } from '../../lib/labels'
import type { FlightCounts } from '../../realtime'

interface OccupancyPanelProps {
  counts: FlightCounts
}

export default function OccupancyPanel({ counts }: OccupancyPanelProps): React.ReactElement {
  const summary = `${counts.available} libres, ${counts.blocked} bloqueados, ${counts.reserved} ocupados`
  const spoken = useThrottledValue(summary)

  return (
    <section className="card occupancy" aria-labelledby="occupancy-title">
      <p id="occupancy-title" className="occupancy__title">
        {SEAT_LABELS.occupancy}
      </p>
      <dl className="occupancy__tiles">
        <div className="occupancy__tile">
          <dt>{SEAT_LABELS.available}</dt>
          <dd>{counts.available}</dd>
        </div>
        <div className="occupancy__tile">
          <dt>{SEAT_LABELS.blocked}</dt>
          <dd>{counts.blocked}</dd>
        </div>
        <div className="occupancy__tile">
          <dt>{SEAT_LABELS.reserved}</dt>
          <dd>{counts.reserved}</dd>
        </div>
      </dl>
      <p className="visually-hidden" role="status" aria-live="polite">
        {spoken}
      </p>
    </section>
  )
}
