import React from 'react'
import { LockIcon, XIcon } from '../../components'
import { SEAT_LABELS, seatAriaLabel } from '../../lib/labels'
import type { SeatView } from '../../realtime'

interface SeatContentProps {
  seat: string
  view: SeatView
}

// A seat is never only a color: sold shows an X, someone else's lock shows a padlock
export function SeatContent({ seat, view }: SeatContentProps): React.ReactElement {
  if (view === 'RESERVED') return <XIcon size={18} />
  if (view === 'BLOCKED_BY_OTHER') return <LockIcon size={18} />
  return <>{seat}</>
}

interface SeatButtonProps extends SeatContentProps {
  // Whole map read-only (cancelled, sold out, departed) or an action in progress
  locked: boolean
  onSelect: (seat: string) => void
}

export default function SeatButton({ seat, view, locked, onSelect }: SeatButtonProps): React.ReactElement {
  // Taken seats stay focusable (aria-disabled) so keyboard and screen reader users can find and hear them
  const selectable = !locked && (view === 'AVAILABLE' || view === 'MINE')

  return (
    <button
      type="button"
      className={`seat seat--${view.toLowerCase()}`}
      aria-label={seatAriaLabel(seat, SEAT_LABELS.stateOf[view])}
      aria-pressed={view === 'MINE'}
      aria-disabled={!selectable}
      onClick={() => selectable && onSelect(seat)}
    >
      <SeatContent seat={seat} view={view} />
    </button>
  )
}
