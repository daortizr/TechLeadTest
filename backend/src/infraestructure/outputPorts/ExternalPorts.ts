import { FlightEvent } from '@flight-reservations/shared';

export interface CardData {
  cardNumber: string;
  holderName: string;
  expiry: string;
  cvv: string;
}

// Thrown by a gateway when the card is declined
export class PaymentDeclinedError extends Error {
  constructor() {
    super('PAYMENT_DECLINED');
    this.name = 'PaymentDeclinedError';
  }
}

export interface PaymentGateway {
  // Idempotent by key: repeating it returns the same authorization and never charges twice
  authorize(idempotencyKey: string, amountCents: number, card: CardData): Promise<{ authorizationRef: string }>;
  void(authorizationRef: string): Promise<void>;
}

export interface EventPublisher {
  publish(event: FlightEvent): Promise<void>;
  publishBatch(events: FlightEvent[]): Promise<void>;
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}
