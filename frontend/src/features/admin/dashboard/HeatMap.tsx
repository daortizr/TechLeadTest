import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LockIcon, XIcon } from '../../../components'
import { ADMIN_LABELS } from '../../../lib/labels'
import { seatView } from '../../../realtime'
import type { SeatView, StoredSeat } from '../../../realtime'
import { buildSeatRows } from '../../seat/layout'

interface HeatMapProps {
  seats: Record<string, StoredSeat>
  // Server time in ms: an expired lock already counts as free
  now: number
  summary: string
}

const D = ADMIN_LABELS.dashboard
const FLASH_MS = 600

// One cell, read-only. When its state changes it is highlighted for a moment (skipped for
// people who prefer reduced motion: the CSS turns the animation off).
function HeatCell({ seat, view }: { seat: string; view: SeatView }): React.ReactElement {
  const previous = useRef(view)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (previous.current === view) return
    previous.current = view
    setFlash(true)
    const timer = setTimeout(() => setFlash(false), FLASH_MS)
    return () => clearTimeout(timer)
  }, [view])

  const kind = view === 'RESERVED' ? 'sold' : view === 'AVAILABLE' ? 'free' : 'blocked'

  return (
    <span className={`heat-cell heat-cell--${kind}${flash ? ' heat-cell--flash' : ''}`} data-seat={seat}>
      {kind === 'sold' && <XIcon size={14} />}
      {kind === 'blocked' && <LockIcon size={14} />}
    </span>
  )
}

export default function HeatMap({ seats, now, summary }: HeatMapProps): React.ReactElement {
  const rows = useMemo(() => buildSeatRows(Object.keys(seats)), [seats])
  const columns = Math.max(1, ...rows.map((row) => row.left.length + row.right.length))

  return (
    <section className="card dash-card" aria-labelledby="heat-title">
      <h2 id="heat-title" className="dash-subtitle">
        {D.heatMap}
      </h2>

      {/* The grid is one picture for assistive technology; its numbers are in the cards */}
      <div
        className="heat-grid"
        role="img"
        aria-label={`${D.heatMap}: ${summary}`}
        style={{ '--heat-columns': columns } as React.CSSProperties}
      >
        {rows.flatMap((row) =>
          [...row.left, ...row.right].map((seat) => <HeatCell key={seat} seat={seat} view={seatView(seats[seat], now)} />)
        )}
      </div>

      <ul className="heat-legend" aria-hidden="true">
        <li>
          <span className="heat-cell heat-cell--free heat-cell--swatch" />
          {D.legend.free}
        </li>
        <li>
          <span className="heat-cell heat-cell--blocked heat-cell--swatch" />
          {D.legend.blocked}
        </li>
        <li>
          <span className="heat-cell heat-cell--sold heat-cell--swatch" />
          {D.legend.sold}
        </li>
      </ul>
    </section>
  )
}
