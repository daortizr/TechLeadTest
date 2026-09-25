import React from 'react'
import { Button, Countdown } from '../../components'
import { formatPrice } from '../../lib/format'
import { SEAT_LABELS } from '../../lib/labels'
import type { MyLock } from '../../realtime'

interface SelectionPanelProps {
  lock: MyLock | null
  priceCents: number
  currency: string
  // The flight can still be bought and nothing is in flight
  canContinue: boolean
  busy: boolean
  onContinue: () => void
  onRelease: () => void
  onExpire: () => void
}

export default function SelectionPanel({
  lock,
  priceCents,
  currency,
  canContinue,
  busy,
  onContinue,
  onRelease,
  onExpire
}: SelectionPanelProps): React.ReactElement {
  // Selecting counts down to lockedUntil; once checkout started, to payableUntil (never lockedUntil)
  const countdownTarget = lock ? (lock.payableUntil ?? lock.lockedUntil) : null

  return (
    <section className="card selection" aria-labelledby="selection-title">
      <p id="selection-title" className="selection__title">
        {SEAT_LABELS.selection}
      </p>

      <p className="selection__seat" aria-live="polite">
        {lock ? lock.seat : SEAT_LABELS.noSeat}
      </p>

      {lock ? (
        <p className="selection__hint">{formatPrice(priceCents, currency)}</p>
      ) : (
        <p className="selection__hint">{SEAT_LABELS.chooseSeat}</p>
      )}

      {lock && countdownTarget && (
        <Countdown
          until={countdownTarget}
          label={lock.payableUntil ? SEAT_LABELS.payingCountdown : SEAT_LABELS.selectingCountdown}
          onExpire={onExpire}
        />
      )}

      <Button fullWidth disabled={!lock || !canContinue || busy} onClick={onContinue}>
        {SEAT_LABELS.continueToPayment}
      </Button>

      {lock && (
        <button type="button" className="link-button selection__release" disabled={busy} onClick={onRelease}>
          {SEAT_LABELS.release}
        </button>
      )}
    </section>
  )
}
