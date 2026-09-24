import { PaymentGateway } from '../outputPorts';
import { config } from '../config/env';

interface StoredAuthorization {
  authorizationRef: string;
  cardNumber: string;
  holderName: string;
  amountCents: number;
}

export class FakePaymentGateway implements PaymentGateway {
  private authorizations: Map<string, StoredAuthorization> = new Map();

  async authorize(
    idempotencyKey: string,
    amountCents: number,
    cardNumber: string,
    holderName: string,
    expiry: string,
    cvv: string
  ): Promise<{ authorizationRef: string }> {
    // Simulate payment latency
    if (config.PAYMENT_LATENCY_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, config.PAYMENT_LATENCY_MS));
    }

    // Check if already authorized (idempotent by key)
    if (this.authorizations.has(idempotencyKey)) {
      return { authorizationRef: this.authorizations.get(idempotencyKey)!.authorizationRef };
    }

    // Reject cards ending in 0000
    if (cardNumber.endsWith('0000')) {
      throw new Error('PAYMENT_DECLINED');
    }

    // Generate authorization reference
    const authorizationRef = `AUTH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store for idempotency
    this.authorizations.set(idempotencyKey, {
      authorizationRef,
      cardNumber: cardNumber.slice(-4),
      holderName,
      amountCents
    });

    return { authorizationRef };
  }

  async void(authorizationRef: string): Promise<void> {
    // Simulate voiding - in a real implementation, this would call the payment gateway
    // For testing, we can simulate failures by checking the ref format
    if (!authorizationRef.startsWith('AUTH-') && !authorizationRef.startsWith('SEED-')) {
      throw new Error('VOID_FAILED');
    }
  }

  // For testing only
  reset(): void {
    this.authorizations.clear();
  }
}
