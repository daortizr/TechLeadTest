import { randomUUID } from 'crypto';
import { CardData, PaymentDeclinedError, PaymentGateway } from '../outputPorts';
import { config } from '../config/env';

// In-memory authorizations by idempotency key; lost on restart (limit of the simulation).
// Card data is never stored: only the authorization reference is kept.
export class FakePaymentGateway implements PaymentGateway {
  private authorizations: Map<string, string> = new Map();

  async authorize(idempotencyKey: string, _amount: number, card: CardData): Promise<{ authorizationRef: string }> {
    if (config.paymentLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, config.paymentLatencyMs));
    }

    const existing = this.authorizations.get(idempotencyKey);
    if (existing) {
      return { authorizationRef: existing };
    }

    if (card.cardNumber.endsWith('0000')) {
      throw new PaymentDeclinedError();
    }

    const authorizationRef = `AUTH-${randomUUID()}`;
    this.authorizations.set(idempotencyKey, authorizationRef);
    return { authorizationRef };
  }

  async void(authorizationRef: string): Promise<void> {
    if (!authorizationRef.startsWith('AUTH-')) {
      throw new Error('VOID_FAILED');
    }
    for (const [key, ref] of this.authorizations) {
      if (ref === authorizationRef) {
        this.authorizations.delete(key);
      }
    }
  }

  reset(): void {
    this.authorizations.clear();
  }
}
