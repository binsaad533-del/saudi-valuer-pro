/**
 * Payment Provider Abstraction Layer
 * Supports mock mode and Moyasar integration.
 * Switch providers by changing the active provider config.
 */

export type PaymentMethod = 'mada' | 'visa' | 'mastercard' | 'applepay';
export type PaymentStage = 'first' | 'final' | 'full';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'manual_review';

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  requestId: string;
  paymentStage: PaymentStage;
  paymentMethod?: PaymentMethod;
  callbackUrl: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  paymentStatus: PaymentStatus;
  gatewayResponse: Record<string, any>;
  checkoutUrl?: string;
  paymentReference: string;
  isMock: boolean;
}

export interface PaymentProvider {
  name: string;
  createPayment(req: PaymentRequest): Promise<PaymentResult>;
  verifyPayment(transactionId: string): Promise<PaymentResult>;
  isConfigured(): boolean;
}

// ── Mock Provider ──────────────────────────────────────────────
class MockPaymentProvider implements PaymentProvider {
  name = 'moyasar_mock';

  isConfigured() { return true; }

  async createPayment(req: PaymentRequest): Promise<PaymentResult> {
    const txId = `mock_txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ref = `PAY-${Date.now().toString(36).toUpperCase()}`;
    return {
      success: true,
      transactionId: txId,
      paymentStatus: 'pending',
      gatewayResponse: {
        id: txId,
        status: 'initiated',
        amount: req.amount * 100, // halalah
        currency: req.currency,
        description: req.description,
        source: { type: 'creditcard', company: req.paymentMethod || 'mada' },
      },
      checkoutUrl: undefined, // mock doesn't redirect
      paymentReference: ref,
      isMock: true,
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    return {
      success: true,
      transactionId,
      paymentStatus: 'paid',
      gatewayResponse: { id: transactionId, status: 'paid', verified: true },
      paymentReference: `PAY-VERIFIED-${Date.now().toString(36).toUpperCase()}`,
      isMock: true,
    };
  }
}

// ── Moyasar Provider (placeholder for real keys) ──────────────
class MoyasarProvider implements PaymentProvider {
  name = 'moyasar';
  private publishableKey: string;

  constructor(publishableKey: string) {
    this.publishableKey = publishableKey;
  }

  isConfigured() {
    return !!this.publishableKey && !this.publishableKey.startsWith('pk_test_mock');
  }

  async createPayment(req: PaymentRequest): Promise<PaymentResult> {
    // When real keys are provided, this will call Moyasar API
    // For now, fall through to mock
    const mock = new MockPaymentProvider();
    return mock.createPayment(req);
  }

  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    const mock = new MockPaymentProvider();
    return mock.verifyPayment(transactionId);
  }
}

// ── Provider Factory ───────────────────────────────────────────
let activeProvider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!activeProvider) {
    // Always use mock until real keys are configured
    activeProvider = new MockPaymentProvider();
  }
  return activeProvider;
}

export function setPaymentProvider(provider: PaymentProvider) {
  activeProvider = provider;
}

// ── Simulation helpers (for test UI) ───────────────────────────
export type SimulationScenario = 'success' | 'failed' | 'pending';

export function simulatePaymentResult(
  scenario: SimulationScenario,
  req: PaymentRequest
): PaymentResult {
  const txId = `mock_${scenario}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ref = `SIM-${scenario.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const statusMap: Record<SimulationScenario, PaymentStatus> = {
    success: 'paid',
    failed: 'failed',
    pending: 'pending',
  };

  return {
    success: scenario === 'success',
    transactionId: txId,
    paymentStatus: statusMap[scenario],
    gatewayResponse: {
      id: txId,
      status: scenario === 'success' ? 'paid' : scenario === 'failed' ? 'failed' : 'initiated',
      amount: req.amount * 100,
      currency: req.currency,
      source: { type: 'creditcard', company: req.paymentMethod || 'mada' },
      message: scenario === 'failed' ? 'Insufficient funds' : undefined,
    },
    paymentReference: ref,
    isMock: true,
  };
}

// Payment method display helpers
export const PAYMENT_METHODS: { value: PaymentMethod; label: string; labelAr: string; icon: string }[] = [
  { value: 'mada', label: 'Mada', labelAr: 'مدى', icon: '💳' },
  { value: 'visa', label: 'Visa', labelAr: 'فيزا', icon: '💳' },
  { value: 'mastercard', label: 'Mastercard', labelAr: 'ماستركارد', icon: '💳' },
  { value: 'applepay', label: 'Apple Pay', labelAr: 'آبل باي', icon: '🍎' },
];
