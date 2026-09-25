import React from 'react'
import { SEAT_LABELS } from '../../lib/labels'
import type { SeatView } from '../../realtime'
import { SeatContent } from './SeatButton'

const ITEMS: { view: SeatView; label: string }[] = [
  { view: 'AVAILABLE', label: SEAT_LABELS.legend.free },
  { view: 'MINE', label: SEAT_LABELS.legend.mine },
  { view: 'BLOCKED_BY_OTHER', label: SEAT_LABELS.legend.other },
  { view: 'RESERVED', label: SEAT_LABELS.legend.taken }
]

export default function SeatLegend(): React.ReactElement {
  return (
    <ul className="seat-legend" aria-label="Leyenda del mapa">
      {ITEMS.map(({ view, label }) => (
        <li key={view} className="seat-legend__item">
          <span className={`seat seat--${view.toLowerCase()} seat--swatch`} aria-hidden="true">
            {view === 'AVAILABLE' || view === 'MINE' ? null : <SeatContent seat="" view={view} />}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  )
}
