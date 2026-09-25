import React, { useMemo } from 'react'
import { seatView } from '../../realtime'
import type { StoredSeat } from '../../realtime'
import SeatButton from './SeatButton'
import { buildSeatRows } from './layout'

interface SeatGridProps {
  seats: Record<string, StoredSeat>
  // Server time in ms: an expired lock already counts as free
  now: number
  locked: boolean
  onSelect: (seat: string) => void
}

export default function SeatGrid({ seats, now, locked, onSelect }: SeatGridProps): React.ReactElement {
  const rows = useMemo(() => buildSeatRows(Object.keys(seats)), [seats])
  const leftCount = Math.max(1, ...rows.map((row) => row.left.length))
  const rightCount = Math.max(1, ...rows.map((row) => row.right.length))

  return (
    <div
      className="seat-grid"
      role="group"
      aria-label="Mapa de asientos"
      // Each block gets width in proportion to its seats: 3 | aisle | 3 for a 6-seat row
      style={{ '--seats-left': `${leftCount}fr`, '--seats-right': `${rightCount}fr` } as React.CSSProperties}
    >
      {rows.map((row) => (
        <div className="seat-row" key={row.row}>
          <div className="seat-row__block">
            {row.left.map((seat) => (
              <SeatButton key={seat} seat={seat} view={seatView(seats[seat], now)} locked={locked} onSelect={onSelect} />
            ))}
          </div>
          <span className="seat-row__number" aria-hidden="true">
            {row.row}
          </span>
          <div className="seat-row__block">
            {row.right.map((seat) => (
              <SeatButton key={seat} seat={seat} view={seatView(seats[seat], now)} locked={locked} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
