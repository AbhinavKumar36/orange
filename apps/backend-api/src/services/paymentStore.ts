import type { PaymentStatus, RefundStatus } from '@orange/api-contracts';

export interface MockPaymentRecord {
  id: string;
  orderId: string;
  provider: string;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  providerSignature?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  rawPayload?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface MockRefundRecord {
  id: string;
  paymentId: string;
  orderId: string;
  providerRefundId?: string | null;
  amount: number;
  currency: string;
  status: RefundStatus;
  idempotencyKey: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export const mockPaymentsStore = new Map<string, MockPaymentRecord>();
export const mockRefundsStore = new Map<string, MockRefundRecord>();
export const mockWebhookEvents = new Set<string>();

export function resetMockPaymentStores(): void {
  mockPaymentsStore.clear();
  mockRefundsStore.clear();
  mockWebhookEvents.clear();
}
