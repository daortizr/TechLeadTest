import React, { useEffect, useRef, useState } from 'react'
import { useServerNow } from '../hooks/useServerNow'
import { formatCountdown } from '../lib/format'
import { ClockIcon } from './icons'
import './Countdown.css'

interface CountdownProps {
  // ISO instant the countdown runs to
  until: string
  // "split": label on the left, time on the right. "sentence": "Tienes 2:11 para pagar".
  label: string
  suffix?: string
  variant?: 'split' | 'sentence'
  // From here on it stands out (bold, icon, soft background), not only by color
  warnAtMs?: number
  onExpire?: () => void
}

// Counts on the server's clock. Announces "Te queda 1 minuto" once, for screen readers.
export default function Countdown({
  until,
  label,
  suffix,
  variant = 'split',
  warnAtMs = 60_000,
  onExpire
}: CountdownProps): React.ReactElement {
  const now = useServerNow(500)
  const remaining = Math.max(0, new Date(until).getTime() - now)
  const warning = remaining <= warnAtMs
  const [announcement, setAnnouncement] = useState('')
  const announced = useRef(false)
  const expired = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    announced.current = false
    expired.current = false
    setAnnouncement('')
  }, [until])

  useEffect(() => {
    if (warning && remaining > 0 && !announced.current) {
      announced.current = true
      setAnnouncement('Te queda 1 minuto')
    }
    if (remaining === 0 && !expired.current) {
      expired.current = true
      onExpireRef.current?.()
    }
  }, [warning, remaining])

  const time = formatCountdown(remaining)
  const classes = ['countdown', `countdown--${variant}`, warning ? 'countdown--warning' : ''].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <span className="countdown__icon" aria-hidden="true">
        <ClockIcon size={20} />
      </span>
      {variant === 'sentence' ? (
        <span className="countdown__sentence">
          {label} <span className="countdown__time" role="timer" aria-live="off">{time}</span>
          {suffix ? ` ${suffix}` : ''}
        </span>
      ) : (
        <>
          <span className="countdown__label">{label}</span>
          <span className="countdown__time" role="timer" aria-live="off">
            {time}
          </span>
        </>
      )}
      {warning && remaining > 0 && <span className="countdown__hint">Te queda 1 minuto</span>}
      <span className="visually-hidden" role="status" aria-live="assertive">
        {announcement}
      </span>
    </div>
  )
}
