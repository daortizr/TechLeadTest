export enum FlightStatus {
  ON_SALE = 'ON_SALE',
  SOLD_OUT = 'SOLD_OUT',
  CANCELLED = 'CANCELLED'
}

export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  BLOCKED = 'BLOCKED',
  RESERVED = 'RESERVED'
}

export enum LockStage {
  SELECTING = 'SELECTING',
  CHECKOUT = 'CHECKOUT'
}

export enum IdempotencyKeyStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum PaymentStatus {
  AUTHORIZED = 'AUTHORIZED',
  DECLINED = 'DECLINED',
  VOIDED = 'VOIDED',
  VOID_FAILED = 'VOID_FAILED'
}

export enum DocumentType {
  CC = 'CC',
  CE = 'CE',
  PASSPORT = 'PASSPORT'
}
