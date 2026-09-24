import { SeatStatus } from '../enums';

export class Seat {
  constructor(
    readonly flightId: string,
    readonly seatNumber: string,
    readonly rowNumber: number,
    readonly columnLetter: string,
    readonly status: SeatStatus,
    readonly lockedBy: string | null,
    readonly lockedUntil: Date | null,
    readonly checkoutStartedAt: Date | null,
    readonly version: number
  ) {}

  isLocked(now: Date): boolean {
    return this.status === SeatStatus.BLOCKED && this.lockedUntil ? this.lockedUntil > now : false;
  }

  isExpired(now: Date): boolean {
    return this.status === SeatStatus.BLOCKED && this.lockedUntil ? this.lockedUntil <= now : false;
  }
}
