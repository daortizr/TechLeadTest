import { Seat } from '../../domain/entities';
import { SeatStatus } from '../../domain/enums';

// Determine the effective status of a seat
// A BLOCKED seat with lockedUntil <= now() is treated as AVAILABLE
export function seatEffectiveStatus(seat: Seat, now: Date): SeatStatus {
  if (seat.status === SeatStatus.BLOCKED && seat.lockedUntil && seat.lockedUntil <= now) {
    return SeatStatus.AVAILABLE;
  }
  return seat.status;
}
