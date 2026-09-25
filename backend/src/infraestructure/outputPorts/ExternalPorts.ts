import { FlightEvent } from '@flight-reservations/shared';

export interface PaymentGateway {
  authorize(idempotencyKey: string, amountCents: number, cardNumber: string, holderName: string, expiry: string, cvv: string): Promise<{ authorizationRef: string }>;
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
