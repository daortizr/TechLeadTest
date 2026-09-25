import { FlightStatus } from '@flight-reservations/shared'
import type { FlightDTO } from '@flight-reservations/shared'
import { SEARCH_LABELS, unavailableReason } from '../../lib/labels'
import type { CardAction } from './FlightCard'

// The customer's rule: only a flight on sale with free seats can be opened
export function customerAction(flight: FlightDTO, open: (flightId: string) => void): CardAction {
  const available = flight.availableSeats ?? 0
  const bookable = flight.status === FlightStatus.ON_SALE && available > 0

  return {
    label: bookable
      ? SEARCH_LABELS.viewSeats
      : flight.status === FlightStatus.SOLD_OUT
        ? SEARCH_LABELS.soldOutAction
        : SEARCH_LABELS.unavailableAction,
    disabled: !bookable,
    muted: !bookable,
    reason: unavailableReason(flight.status, available),
    onClick: () => open(flight.id)
  }
}
