import { SeatDiagnosis } from '../../domain/interfaces';
import { FlightStatus, SeatStatus } from '../../domain/enums';

export type SeatOperation = 'LOCK' | 'CHECKOUT' | 'RELEASE' | 'PURCHASE';

export type SeatDiagnosisOutcome =
  | { kind: 'SEAT_NOT_FOUND' }
  | { kind: 'FLIGHT_NOT_BOOKABLE' }
  | { kind: 'SEAT_RESERVED' }
  // The caller already holds the lock: idempotent success with the current expiry
  | { kind: 'ALREADY_MINE'; lockedUntil: Date }
  | { kind: 'SEAT_LOCKED'; lockedUntil: Date | null }
  | { kind: 'LOCK_EXPIRED_OR_NOT_OWNED' }
  | { kind: 'LOCK_NOT_OWNED' }
  | { kind: 'ALREADY_FREE' }
  // The state changed between both statements: repeat the operation once
  | { kind: 'RETRY' };

export function isFlightBookable(diagnosis: SeatDiagnosis): boolean {
  return diagnosis.flightStatus === FlightStatus.ON_SALE && diagnosis.flightDepartsLater;
}

// Classifies why a conditional UPDATE affected no rows. It only explains, it never decides.
// A null diagnosis means the flight does not exist. Rules are evaluated in order (7.1 and 7.2).
export function diagnoseSeat(diagnosis: SeatDiagnosis | null, operation: SeatOperation): SeatDiagnosisOutcome {
  if (!diagnosis || !diagnosis.seatExists) {
    return { kind: 'SEAT_NOT_FOUND' };
  }

  const blocked = diagnosis.seatStatus === SeatStatus.BLOCKED;
  const mineAndActive = blocked && diagnosis.lockedByCaller && diagnosis.lockActive;

  if (operation === 'RELEASE') {
    if (blocked && !diagnosis.lockedByCaller && diagnosis.lockActive) {
      return { kind: 'LOCK_NOT_OWNED' };
    }
    return { kind: 'ALREADY_FREE' };
  }

  if (!isFlightBookable(diagnosis)) {
    return { kind: 'FLIGHT_NOT_BOOKABLE' };
  }

  if (operation === 'LOCK') {
    if (diagnosis.seatStatus === SeatStatus.RESERVED) return { kind: 'SEAT_RESERVED' };
    if (mineAndActive && diagnosis.lockedUntil) return { kind: 'ALREADY_MINE', lockedUntil: diagnosis.lockedUntil };
    if (blocked && !diagnosis.lockedByCaller && diagnosis.lockActive) {
      return { kind: 'SEAT_LOCKED', lockedUntil: diagnosis.lockedUntil };
    }
    return { kind: 'RETRY' };
  }

  if (operation === 'CHECKOUT' && mineAndActive && diagnosis.checkoutStarted && diagnosis.lockedUntil) {
    return { kind: 'ALREADY_MINE', lockedUntil: diagnosis.lockedUntil };
  }

  // Free, RESERVED, someone else's or expired: a single code so nobody learns who holds the seat
  return { kind: 'LOCK_EXPIRED_OR_NOT_OWNED' };
}
