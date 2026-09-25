import { describe, it, expect } from 'vitest';
import { diagnoseSeat } from '../../src/application/helpers';
import { SeatDiagnosis } from '../../src/domain/interfaces';
import { FlightStatus, SeatStatus } from '../../src/domain/enums';

const LOCKED_UNTIL = new Date('2026-01-01T10:00:00Z');

function diagnosis(overrides: Partial<SeatDiagnosis> = {}): SeatDiagnosis {
  return {
    seatExists: true,
    seatStatus: SeatStatus.AVAILABLE,
    seatVersion: 3,
    lockedUntil: null,
    lockedByCaller: false,
    lockActive: false,
    checkoutStarted: false,
    flightStatus: FlightStatus.ON_SALE,
    flightDepartsLater: true,
    ...overrides
  };
}

const mine = { seatStatus: SeatStatus.BLOCKED, lockedUntil: LOCKED_UNTIL, lockedByCaller: true, lockActive: true };
const theirs = { seatStatus: SeatStatus.BLOCKED, lockedUntil: LOCKED_UNTIL, lockedByCaller: false, lockActive: true };

describe('diagnoseSeat - LOCK (7.1)', () => {
  it('1. no flight row or no seat -> SEAT_NOT_FOUND', () => {
    expect(diagnoseSeat(null, 'LOCK')).toEqual({ kind: 'SEAT_NOT_FOUND' });
    expect(diagnoseSeat(diagnosis({ seatExists: false, seatStatus: null }), 'LOCK')).toEqual({
      kind: 'SEAT_NOT_FOUND'
    });
  });

  it('2. flight not bookable -> FLIGHT_NOT_BOOKABLE, ahead of SEAT_RESERVED', () => {
    for (const flightStatus of [FlightStatus.CANCELLED, FlightStatus.SOLD_OUT]) {
      expect(diagnoseSeat(diagnosis({ flightStatus, seatStatus: SeatStatus.RESERVED }), 'LOCK')).toEqual({
        kind: 'FLIGHT_NOT_BOOKABLE'
      });
    }
    expect(diagnoseSeat(diagnosis({ flightDepartsLater: false }), 'LOCK')).toEqual({ kind: 'FLIGHT_NOT_BOOKABLE' });
  });

  it('3. reserved seat -> SEAT_RESERVED', () => {
    expect(diagnoseSeat(diagnosis({ seatStatus: SeatStatus.RESERVED }), 'LOCK')).toEqual({ kind: 'SEAT_RESERVED' });
  });

  it('4. already mine and active -> idempotent with the original expiry', () => {
    expect(diagnoseSeat(diagnosis(mine), 'LOCK')).toEqual({ kind: 'ALREADY_MINE', lockedUntil: LOCKED_UNTIL });
  });

  it('5. locked by someone else and active -> SEAT_LOCKED with lockedUntil', () => {
    expect(diagnoseSeat(diagnosis(theirs), 'LOCK')).toEqual({ kind: 'SEAT_LOCKED', lockedUntil: LOCKED_UNTIL });
  });

  it('6. free or expired (state changed between statements) -> RETRY', () => {
    expect(diagnoseSeat(diagnosis(), 'LOCK')).toEqual({ kind: 'RETRY' });
    expect(diagnoseSeat(diagnosis({ ...theirs, lockActive: false }), 'LOCK')).toEqual({ kind: 'RETRY' });
  });
});

describe('diagnoseSeat - CHECKOUT (7.2)', () => {
  it('SEAT_NOT_FOUND and FLIGHT_NOT_BOOKABLE come first', () => {
    expect(diagnoseSeat(null, 'CHECKOUT')).toEqual({ kind: 'SEAT_NOT_FOUND' });
    expect(diagnoseSeat(diagnosis({ ...mine, flightStatus: FlightStatus.CANCELLED }), 'CHECKOUT')).toEqual({
      kind: 'FLIGHT_NOT_BOOKABLE'
    });
  });

  it('mine, active and already in checkout -> idempotent', () => {
    expect(diagnoseSeat(diagnosis({ ...mine, checkoutStarted: true }), 'CHECKOUT')).toEqual({
      kind: 'ALREADY_MINE',
      lockedUntil: LOCKED_UNTIL
    });
  });

  it('anything else uses a single code so the holder is never revealed', () => {
    const cases = [
      diagnosis(),
      diagnosis({ seatStatus: SeatStatus.RESERVED }),
      diagnosis(theirs),
      diagnosis({ ...mine, lockActive: false }),
      diagnosis(mine) // mine but checkout not started (the UPDATE would have succeeded)
    ];
    for (const value of cases) {
      expect(diagnoseSeat(value, 'CHECKOUT')).toEqual({ kind: 'LOCK_EXPIRED_OR_NOT_OWNED' });
    }
  });
});

describe('diagnoseSeat - RELEASE (7.1)', () => {
  it('no seat -> SEAT_NOT_FOUND', () => {
    expect(diagnoseSeat(null, 'RELEASE')).toEqual({ kind: 'SEAT_NOT_FOUND' });
  });

  it("someone else's active lock -> LOCK_NOT_OWNED", () => {
    expect(diagnoseSeat(diagnosis(theirs), 'RELEASE')).toEqual({ kind: 'LOCK_NOT_OWNED' });
  });

  it('free, expired or already released -> idempotent', () => {
    expect(diagnoseSeat(diagnosis(), 'RELEASE')).toEqual({ kind: 'ALREADY_FREE' });
    expect(diagnoseSeat(diagnosis({ ...theirs, lockActive: false }), 'RELEASE')).toEqual({ kind: 'ALREADY_FREE' });
  });

  it('does not depend on the flight being bookable', () => {
    expect(diagnoseSeat(diagnosis({ flightStatus: FlightStatus.CANCELLED }), 'RELEASE')).toEqual({
      kind: 'ALREADY_FREE'
    });
  });
});

describe('diagnoseSeat - PURCHASE', () => {
  it('maps to the same codes as checkout, without the idempotent case', () => {
    expect(diagnoseSeat(diagnosis({ ...mine, checkoutStarted: true }), 'PURCHASE')).toEqual({
      kind: 'LOCK_EXPIRED_OR_NOT_OWNED'
    });
    expect(diagnoseSeat(diagnosis({ flightStatus: FlightStatus.SOLD_OUT }), 'PURCHASE')).toEqual({
      kind: 'FLIGHT_NOT_BOOKABLE'
    });
  });
});
