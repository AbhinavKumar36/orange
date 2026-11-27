import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/env.js';

export interface CreateOrderParams {
  amount: number; // in paise
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
  config: AppConfig;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

export interface VerifySignatureParams {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  secret: string;
}

export interface VerifyWebhookParams {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}

export interface CreateRefundParams {
  paymentId: string;
  amount: number; // in paise
  notes?: Record<string, string>;
  config: AppConfig;
}

export interface RazorpayRefundResult {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
}

export function isMockPaymentMode(config: AppConfig): boolean {
  return config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test');
}

function requireGatewayCredentials(config: AppConfig): void {
  if (!config.RAZORPAY_KEY_ID?.trim() || !config.RAZORPAY_KEY_SECRET?.trim() ||
      /(example|mock|placeholder|dummy)/i.test(config.RAZORPAY_KEY_ID + config.RAZORPAY_KEY_SECRET)) {
    throw new Error('Razorpay is not configured. Valid gateway credentials are required for payments and refunds.');
  }
}

/**
 * Creates a Razorpay order from the backend.
 * Uses official Razorpay API or deterministic mock in test/offline environment.
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrderResult> {
  const { amount, currency, receipt, notes, config } = params;

  if (amount <= 0) {
    throw new Error('Razorpay order amount must be greater than zero.');
  }

  if (currency !== 'INR') {
    throw new Error(`Invalid currency: ${currency}. Razorpay integration requires INR.`);
  }

  const keyId = config.RAZORPAY_KEY_ID;
  const keySecret = config.RAZORPAY_KEY_SECRET;

  // Use mock mode if explicitly allowed or in test environment without real credentials
  const isMockMode = isMockPaymentMode(config);

  if (isMockMode) {
    // Generate deterministic mock Razorpay order ID
    const mockId = `order_mock_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    return {
      id: mockId,
      amount,
      currency: 'INR',
      receipt,
      status: 'created',
    };
  }

  requireGatewayCredentials(config);

  // Real Razorpay API call using HTTP Basic Auth
  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt,
      notes: notes || {},
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      `Razorpay order creation failed (${response.status}): ${JSON.stringify(errorBody)}`
    );
  }

  const data = (await response.json()) as RazorpayOrderResult;
  return data;
}

/**
 * Verifies Razorpay payment signature using HMAC SHA256 of order_id + "|" + payment_id.
 */
export function verifyPaymentSignature(params: VerifySignatureParams): boolean {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, secret } = params;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !secret) {
    return false;
  }

  try {
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    const signatureBuf = Buffer.from(razorpaySignature, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (signatureBuf.length !== expectedBuf.length) {
      return false;
    }

    return timingSafeEqual(signatureBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Verifies Razorpay webhook signature using HMAC SHA256 of the raw body.
 */
export function verifyWebhookSignature(params: VerifyWebhookParams): boolean {
  const { rawBody, signature, webhookSecret } = params;

  if (!rawBody || !signature || !webhookSecret) {
    return false;
  }

  try {
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const signatureBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (signatureBuf.length !== expectedBuf.length) {
      return false;
    }

    return timingSafeEqual(signatureBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Issues a refund via Razorpay API.
 */
export async function createRazorpayRefund(
  params: CreateRefundParams
): Promise<RazorpayRefundResult> {
  const { paymentId, amount, notes, config } = params;

  if (amount <= 0) {
    throw new Error('Refund amount must be greater than zero.');
  }

  const keyId = config.RAZORPAY_KEY_ID;
  const keySecret = config.RAZORPAY_KEY_SECRET;

  const isMockMode = isMockPaymentMode(config);

  if (isMockMode) {
    const mockRefundId = `rfnd_mock_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    return {
      id: mockRefundId,
      paymentId,
      amount,
      currency: 'INR',
      status: 'processed',
    };
  }

  requireGatewayCredentials(config);

  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      notes: notes || {},
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      `Razorpay refund creation failed (${response.status}): ${JSON.stringify(errorBody)}`
    );
  }

  const data = (await response.json()) as RazorpayRefundResult;
  return data;
}
