import { FlightStatus } from '@flight-reservations/shared'
import type { ActivityItem } from '../../realtime'

// "3B" reads as "03B" in the feed so the seat column lines up
export function seatLabel(seat: string): string {
  return seat.replace(/^(\d)([A-Z])$/, '0$1$2')
}

// One line per event, as the administrator reads it: "12C bloqueado", "14F liberado por expiración"
export function describeActivity(event: ActivityItem['event']): string {
  switch (event.type) {
    case 'seat.locked':
      return `${seatLabel(event.seat)} bloqueado`
    case 'seat.released':
      return event.reason === 'EXPIRED'
        ? `${seatLabel(event.seat)} liberado por expiración`
        : `${seatLabel(event.seat)} liberado`
    case 'seat.reserved':
      return `${seatLabel(event.seat)} reservado`
    case 'flight.updated':
      if (event.status === FlightStatus.CANCELLED) return 'Vuelo cancelado'
      if (event.status === FlightStatus.SOLD_OUT) return 'Vuelo vendido por completo'
      return 'Vuelo en venta'
  }
}

// "hace 4 s", "hace 1 min", "hace 2 h"
export function relativeTime(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000))
  if (seconds < 1) return 'ahora'
  if (seconds < 60) return `hace ${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  return `hace ${Math.floor(minutes / 60)} h`
}
