import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createHmac } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { ConfigSchema, type AppConfig } from '../src/config/env.js';
import { resetMockOrderStore, mockOrdersStore } from '../src/routes/orders.js';
import { resetMockPaymentStores, mockPaymentsStore } from '../src/services/paymentStore.js';
import { verifyPaymentSignature, verifyWebhookSignature } from '../src/services/razorpay.js';
import { verifyYoupiWebhookSignature } from '../src/services/youpi.js';

describe('Phase 7: Payments, YouPI-PG Gateway, Verification, Webhooks & Refunds', () => {
  let app: FastifyInstance;

  const testKeySecret = 'test_secret_key_1234567890abcdef';
  const testWebhookSecret = 'test_webhook_secret_9876543210fedcba';

  const testConfig: AppConfig = ConfigSchema.parse({
    PORT: 4004,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    ALLOW_MOCK_SERVICES: true,
    SUPABASE_URL: 'https://test-project.supabase.co',
    YOUPI_BASE_URL: 'http://localhost:8080',
    YOUPI_MERCHANT_ID: '00000000-0000-0000-0000-000000000001',
    YOUPI_PUBLIC_KEY: 'youpi_pub_test123',
    YOUPI_WEBHOOK_SECRET: testWebhookSecret,
    YOUPI_VPA: 'moodyorange@upi',
    RAZORPAY_KEY_ID: 'rzp_test_exampleKey123',
    RAZORPAY_KEY_SECRET: testKeySecret,
    RAZORPAY_WEBHOOK_SECRET: testWebhookSecret,
  });

  const customerA = {
    id: '11111111-aaaa-aaaa-aaaa-111111111111',
    phone: '+919876543210',
    name: 'Customer A',
    token: 'mock_customer_:11111111-aaaa-aaaa-aaaa-111111111111:+919876543210:Customer A',
  };

  const customerB = {
    id: '22222222-bbbb-bbbb-bbbb-222222222222',
    phone: '+919999999999',
    name: 'Customer B',
    token: 'mock_customer_:22222222-bbbb-bbbb-bbbb-222222222222:+919999999999:Customer B',
  };

  const staffToken = 'mock_staff_:33333333-cccc-cccc-cccc-333333333333:staff@orange.com:Staff User';
  const managerToken = 'mock_manager_:44444444-dddd-dddd-dddd-444444444444:manager@orange.com:Store Manager';
  const adminToken = 'mock_admin_:55555555-eeee-eeee-eeee-555555555555:admin@orange.com:System Admin';

  const VALID_PRODUCT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeAll(async () => {
    app = await buildApp({ config: testConfig });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetMockOrderStore();
    resetMockPaymentStores();
  });

  async function createDraftOnlineOrder(customerId = customerA.id, token = customerA.token) {
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/checkout',
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      },
      payload: {
        items: [{ productId: VALID_PRODUCT_ID, quantity: 1 }],
        fulfillment: 'immediate',
        paymentMethod: 'online_razorpay',
        customerName: customerA.name,
        customerPhone: customerA.phone,
      },
    });
    expect(checkoutRes.statusCode).toBe(201);
    return JSON.parse(checkoutRes.payload);
  }

  // Scenario 1: Online order payment initiation creates a valid YouPI-PG session on backend
  it('1. Online order payment initiation creates a valid Razorpay order on backend', async () => {
    const order = await createDraftOnlineOrder();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.orderId).toBe(order.orderId);
    expect(body.youpiPaymentId).toMatch(/^youpi_/);
    expect(body.checkoutUrl).toBeDefined();
    expect(body.vpa).toBeDefined();
    expect(body.qrPayload).toBeDefined();
    expect(body.currency).toBe('INR');
    expect(body.amount).toBe(order.totalAmount);
    expect(body.merchantId).toBeDefined();
  });

  // Scenario 2: Order payable amount is strictly server-calculated from database pricing, ignoring frontend totals
  it('2. Order payable amount is strictly server-calculated, ignoring frontend totals', async () => {
    const order = await createDraftOnlineOrder();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: {
        orderId: order.orderId,
        // Attempting to send manipulated client-side amount (must be ignored)
        amount: 100,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // Dark Chocolate Cake is 45000 + 5% GST = 47250 paise
    expect(body.amount).toBe(order.totalAmount);
    expect(body.amount).not.toBe(100);
  });

  // Scenario 3: Order ownership is enforced during payment initiation
  it('3. Order ownership is enforced during payment initiation', async () => {
    const order = await createDraftOnlineOrder(customerA.id, customerA.token);

    // Customer B attempts to initiate payment on Customer A's order
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerB.token}` },
      payload: { orderId: order.orderId },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('FORBIDDEN_ORDER_ACCESS');
  });

  // Scenario 4: Duplicate payment initiation on active draft order returns existing payment attempt without duplicating
  it('4. Duplicate payment initiation returns existing payment attempt without duplicating', async () => {
    const order = await createDraftOnlineOrder();

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const body1 = JSON.parse(res1.payload);

    // Duplicate tap/call
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const body2 = JSON.parse(res2.payload);

    expect(res2.statusCode).toBe(200);
    expect(body2.razorpayOrderId).toBe(body1.razorpayOrderId);
  });

  // Scenario 5: Failed payment allows retry without creating a duplicate ecommerce order
  it('5. Failed payment allows retry on existing order without duplicating order', async () => {
    const order = await createDraftOnlineOrder();

    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const initBody = JSON.parse(initRes.payload);

    // Simulate payment failure event from webhook
    const rawFailBody = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_failed_123',
            order_id: initBody.razorpayOrderId,
            amount: order.totalAmount,
            currency: 'INR',
          },
        },
      },
    });
    const failSig = createHmac('sha256', testWebhookSecret).update(rawFailBody).digest('hex');

    await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/razorpay',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': failSig,
      },
      payload: rawFailBody,
    });

    // Customer retries payment on the exact same ecommerce orderId
    const retryRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });

    expect(retryRes.statusCode).toBe(200);
    const retryBody = JSON.parse(retryRes.payload);
    expect(retryBody.orderId).toBe(order.orderId);
    expect(retryBody.razorpayOrderId).toBeDefined();
  });

  // Scenario 6: Valid payment signature verification marks order confirmed and payment captured
  it('6. Valid payment signature verification marks order confirmed and payment captured', async () => {
    const order = await createDraftOnlineOrder();

    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const { razorpayOrderId } = JSON.parse(initRes.payload);

    const paymentId = 'pay_test_succ_12345';
    const signature = createHmac('sha256', testKeySecret)
      .update(`${razorpayOrderId}|${paymentId}`)
      .digest('hex');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: {
        orderId: order.orderId,
        razorpayOrderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.payload);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.orderStatus).toBe('confirmed');
    expect(verifyBody.paymentStatus).toBe('captured');
  });

  // Scenario 7: Invalid payment signature is rejected and order remains uncaptured
  it('7. Invalid payment signature is rejected and order remains uncaptured', async () => {
    const order = await createDraftOnlineOrder();

    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const { razorpayOrderId } = JSON.parse(initRes.payload);

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: {
        orderId: order.orderId,
        razorpayOrderId,
        razorpayPaymentId: 'pay_test_bad_123',
        razorpaySignature: 'deadbeef_invalid_signature_hex_value_1234567890abcdef',
      },
    });

    expect(verifyRes.statusCode).toBe(400);
    const verifyBody = JSON.parse(verifyRes.payload);
    expect(verifyBody.error.code).toBe('INVALID_PAYMENT_SIGNATURE');

    // Stored order must remain draft and NOT captured
    const stored = mockOrdersStore.get(order.orderId);
    expect(stored?.paymentStatus).not.toBe('captured');
  });

  // Scenario 8: Replayed or mismatched payment confirmations are rejected
  it('8. Replayed or mismatched payment confirmations are rejected', async () => {
    const order1 = await createDraftOnlineOrder();
    const order2 = await createDraftOnlineOrder();

    const init1 = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order1.orderId },
    });
    const { razorpayOrderId: rzpOrder1 } = JSON.parse(init1.payload);

    // Mismatched Razorpay Order ID passed to order2
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: {
        orderId: order2.orderId,
        razorpayOrderId: rzpOrder1,
        razorpayPaymentId: 'pay_hijack_attempt_1',
        razorpaySignature: 'any_sig',
      },
    });

    expect(verifyRes.statusCode).toBe(400);
    const body = JSON.parse(verifyRes.payload);
    expect(body.error.code).toMatch(/(PROVIDER_ORDER_MISMATCH|INVALID_PAYMENT_SIGNATURE)/);
  });

  // Scenario 9: Signature verification uses timing-safe comparison to prevent timing attacks
  it('9. Signature verification uses timing-safe comparison', () => {
    const orderId = 'order_test_123';
    const paymentId = 'pay_test_123';
    const secret = 'secret_test_xyz';

    const validSig = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

    // Valid check
    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSig,
        secret,
      })
    ).toBe(true);

    // Tampered check with differing length or wrong chars
    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: 'short_sig',
        secret,
      })
    ).toBe(false);

    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSig.slice(0, -2) + '00',
        secret,
      })
    ).toBe(false);
  });

  // Scenario 10: Valid webhook event (payment.captured) marks order confirmed and records payment event
  it('10. Valid webhook event (payment.captured) marks order confirmed', async () => {
    const order = await createDraftOnlineOrder();

    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const { razorpayOrderId } = JSON.parse(initRes.payload);

    const paymentId = 'pay_wh_captured_123';
    const rawBody = JSON.stringify({
      id: 'evt_captured_001',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: razorpayOrderId,
            amount: order.totalAmount,
            currency: 'INR',
            notes: { orderId: order.orderId },
          },
        },
      },
    });
    const signature = createHmac('sha256', testWebhookSecret).update(rawBody).digest('hex');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/razorpay',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': signature,
      },
      payload: rawBody,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.received).toBe(true);

    const stored = mockOrdersStore.get(order.orderId);
    expect(stored?.orderStatus).toBe('confirmed');
    expect(stored?.paymentStatus).toBe('captured');
  });

  // Scenario 10b: YouPI-PG webhook delivery (OBSERVED_SUCCESS) to /api/v1/webhooks/youpi marks order confirmed
  it('10b. YouPI-PG webhook delivery (OBSERVED_SUCCESS) marks order confirmed', async () => {
    const order = await createDraftOnlineOrder();

    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const { youpiPaymentId } = JSON.parse(initRes.payload);

    const utr = '431200987654';
    const rawBody = JSON.stringify({
      event: 'OBSERVED_SUCCESS',
      paymentId: youpiPaymentId,
      orderId: order.orderNumber,
      amount: (order.totalAmount / 100).toFixed(2),
      amountPaise: order.totalAmount,
      currency: 'INR',
      method: 'UPI',
      settlementState: 'NOT_RECONCILED',
      utr,
      metadata: { internalOrderId: order.orderId },
    });
    const hash = createHmac('sha256', testWebhookSecret).update(rawBody).digest('hex');
    const signature = `sha256=${hash}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/youpi',
      headers: {
        'content-type': 'application/json',
        'x-gateway-signature': signature,
      },
      payload: rawBody,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.received).toBe(true);

    const stored = mockOrdersStore.get(order.orderId);
    expect(stored?.orderStatus).toBe('confirmed');
    expect(stored?.paymentStatus).toBe('captured');
  });

  // Scenario 11: Duplicate webhook deliveries are processed idempotently
  it('11. Duplicate webhook deliveries are processed idempotently', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_duplicate_test_123',
      event: 'payment.captured',
      payload: {},
    });
    const signature = createHmac('sha256', testWebhookSecret).update(rawBody).digest('hex');

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/razorpay',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
      payload: rawBody,
    });
    expect(res1.statusCode).toBe(200);

    // Duplicate delivery with same event ID
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/razorpay',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
      payload: rawBody,
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.payload);
    expect(body2.deduplicated).toBe(true);
  });

  // Scenario 12: Webhook with invalid signature is rejected with 400
  it('12. Webhook with invalid signature is rejected with 400', async () => {
    const rawBody = JSON.stringify({ event: 'payment.captured' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/razorpay',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': 'invalid_signature_hex_string_1234567890abcdef',
      },
      payload: rawBody,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  // Scenario 13: Cash at pickup orders are created as confirmed and unpaid; online gateway payment initiation is rejected
  it('13. Cash at pickup orders reject online gateway payment initiation', async () => {
    const cashRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/checkout',
      headers: {
        authorization: `Bearer ${customerA.token}`,
        'x-idempotency-key': `cash_${Date.now()}`,
      },
      payload: {
        items: [{ productId: VALID_PRODUCT_ID, quantity: 1 }],
        fulfillment: 'immediate',
        paymentMethod: 'cash_at_pickup',
        customerName: customerA.name,
        customerPhone: customerA.phone,
      },
    });
    expect(cashRes.statusCode).toBe(201);
    const cashOrder = JSON.parse(cashRes.payload);
    expect(cashOrder.orderStatus).toBe('confirmed');
    expect(cashOrder.paymentStatus).toBe('unpaid');

    // Attempting online payment initiation on cash order
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: cashOrder.orderId },
    });

    expect(initRes.statusCode).toBe(400);
    const body = JSON.parse(initRes.payload);
    expect(body.error.code).toBe('INVALID_PAYMENT_METHOD');
  });

  // Scenario 14: Cash handover marks order completed and payment captured at pickup
  it('14. Cash handover marks order completed and payment captured at pickup', async () => {
    const cashRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/checkout',
      headers: {
        authorization: `Bearer ${customerA.token}`,
        'x-idempotency-key': `handover_${Date.now()}`,
      },
      payload: {
        items: [{ productId: VALID_PRODUCT_ID, quantity: 1 }],
        fulfillment: 'immediate',
        paymentMethod: 'cash_at_pickup',
        customerName: customerA.name,
        customerPhone: customerA.phone,
      },
    });
    const { orderId } = JSON.parse(cashRes.payload);

    // Advance confirmed -> preparing -> ready_for_pickup
    const prepRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/orders/${orderId}/status`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { status: 'preparing' },
    });
    expect(prepRes.statusCode).toBe(200);

    const readyRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/orders/${orderId}/status`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { status: 'ready_for_pickup' },
    });
    expect(readyRes.statusCode).toBe(200);

    // Complete physical handover with cash collection
    const handoverRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${orderId}/handover`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { cashCollected: true },
    });

    expect(handoverRes.statusCode).toBe(200);
    const body = JSON.parse(handoverRes.payload);
    const orderObj = body.order || body;
    expect(orderObj.orderStatus).toBe('completed');
    expect(orderObj.paymentStatus).toBe('captured');
  });

  // Scenario 15: Counter staff cannot issue online gateway refunds
  it('15. Counter staff cannot issue online gateway refunds (requires manager/admin)', async () => {
    const order = await createDraftOnlineOrder();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${order.orderId}/refund`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { reason: 'Customer requested refund' },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  // Scenario 16: Manager/admin can issue full refund via gateway and database updates status
  it('16. Manager can issue full refund via gateway and database updates status', async () => {
    const order = await createDraftOnlineOrder();

    // Confirm and capture order payment first
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const { razorpayOrderId } = JSON.parse(initRes.payload);

    await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: {
        orderId: order.orderId,
        razorpayOrderId,
        razorpayPaymentId: 'pay_full_ref_001',
        razorpaySignature: createHmac('sha256', testKeySecret)
          .update(`${razorpayOrderId}|pay_full_ref_001`)
          .digest('hex'),
      },
    });

    // Manager issues full refund
    const refundRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${order.orderId}/refund`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { reason: 'Defective packaging' },
    });

    expect(refundRes.statusCode).toBe(200);
    const body = JSON.parse(refundRes.payload);
    expect(body.status).toBe('refunded');
    expect(body.amount).toBe(order.totalAmount);
    expect(body.remainingRefundable).toBe(0);
    expect(body.paymentStatus).toBe('refunded');
  });

  // Scenario 17: Manager/admin can issue partial refund within remaining refundable balance
  it('17. Manager can issue partial refund within remaining refundable balance', async () => {
    const order = await createDraftOnlineOrder();

    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const { razorpayOrderId } = JSON.parse(initRes.payload);

    await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: {
        orderId: order.orderId,
        razorpayOrderId,
        razorpayPaymentId: 'pay_partial_001',
        razorpaySignature: createHmac('sha256', testKeySecret)
          .update(`${razorpayOrderId}|pay_partial_001`)
          .digest('hex'),
      },
    });

    // Refund partial amount (e.g. ₹100 = 10000 paise)
    const refundRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${order.orderId}/refund`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { amount: 10000, reason: 'Goodwill partial concession' },
    });

    expect(refundRes.statusCode).toBe(200);
    const body = JSON.parse(refundRes.payload);
    expect(body.amount).toBe(10000);
    expect(body.remainingRefundable).toBe(order.totalAmount - 10000);
    expect(body.paymentStatus).toBe('partially_refunded');
  });

  // Scenario 18: Refund exceeding remaining refundable amount is rejected
  it('18. Refund exceeding remaining refundable amount is rejected', async () => {
    const order = await createDraftOnlineOrder();

    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const { razorpayOrderId } = JSON.parse(initRes.payload);

    await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: {
        orderId: order.orderId,
        razorpayOrderId,
        razorpayPaymentId: 'pay_exceed_001',
        razorpaySignature: createHmac('sha256', testKeySecret)
          .update(`${razorpayOrderId}|pay_exceed_001`)
          .digest('hex'),
      },
    });

    // Request refund greater than order total
    const refundRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${order.orderId}/refund`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { amount: order.totalAmount + 50000, reason: 'Excessive refund' },
    });

    expect(refundRes.statusCode).toBe(400);
    const body = JSON.parse(refundRes.payload);
    expect(body.error.code).toBe('REFUND_EXCEEDS_REMAINING_AMOUNT');
  });

  // Scenario 19: Online gateway refund is rejected for cash-at-pickup orders
  it('19. Online gateway refund is rejected for cash-at-pickup orders', async () => {
    const cashRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/checkout',
      headers: {
        authorization: `Bearer ${customerA.token}`,
        'x-idempotency-key': `cash_ref_${Date.now()}`,
      },
      payload: {
        items: [{ productId: VALID_PRODUCT_ID, quantity: 1 }],
        fulfillment: 'immediate',
        paymentMethod: 'cash_at_pickup',
        customerName: customerA.name,
        customerPhone: customerA.phone,
      },
    });
    const { orderId } = JSON.parse(cashRes.payload);

    const refundRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${orderId}/refund`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Customer returned cash item' },
    });

    expect(refundRes.statusCode).toBe(400);
    const body = JSON.parse(refundRes.payload);
    expect(body.error.code).toBe('CASH_ORDER_REFUND_NOT_ALLOWED');
  });

  // Scenario 20: Refund idempotency prevents duplicate refunds with same idempotency key
  it('20. Refund idempotency prevents duplicate refunds with same key', async () => {
    const order = await createDraftOnlineOrder();

    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const { razorpayOrderId } = JSON.parse(initRes.payload);

    await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: {
        orderId: order.orderId,
        razorpayOrderId,
        razorpayPaymentId: 'pay_idemp_001',
        razorpaySignature: createHmac('sha256', testKeySecret)
          .update(`${razorpayOrderId}|pay_idemp_001`)
          .digest('hex'),
      },
    });

    const key = `ref_idemp_unique_${Date.now()}`;
    const refundRes1 = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${order.orderId}/refund`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { amount: 10000, reason: 'Duplicate test', idempotencyKey: key },
    });
    expect(refundRes1.statusCode).toBe(200);
    const body1 = JSON.parse(refundRes1.payload);

    // Replay with identical key
    const refundRes2 = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${order.orderId}/refund`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { amount: 10000, reason: 'Duplicate test', idempotencyKey: key },
    });
    expect(refundRes2.statusCode).toBe(200);
    const body2 = JSON.parse(refundRes2.payload);
    expect(body2.refundId).toBe(body1.refundId);
  });

  // Scenario 21: Admin order payments inspection returns complete audit trail of attempts and refunds
  it('21. Admin order payments inspection returns complete audit trail', async () => {
    const order = await createDraftOnlineOrder();

    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: { orderId: order.orderId },
    });
    const { razorpayOrderId } = JSON.parse(initRes.payload);

    await app.inject({
      method: 'POST',
      url: '/api/v1/payments/verify',
      headers: { authorization: `Bearer ${customerA.token}` },
      payload: {
        orderId: order.orderId,
        razorpayOrderId,
        razorpayPaymentId: 'pay_audit_001',
        razorpaySignature: createHmac('sha256', testKeySecret)
          .update(`${razorpayOrderId}|pay_audit_001`)
          .digest('hex'),
      },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${order.orderId}/refund`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { amount: 15000, reason: 'Audit trail test' },
    });

    // Inspect payments
    const paymentsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${order.orderId}/payments`,
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(paymentsRes.statusCode).toBe(200);
    const data = JSON.parse(paymentsRes.payload);
    expect(data.orderId).toBe(order.orderId);
    expect(data.payments.length).toBeGreaterThanOrEqual(1);
    expect(data.refunds.length).toBe(1);
    expect(data.totalCaptured).toBe(order.totalAmount);
    expect(data.totalRefunded).toBe(15000);
    expect(data.remainingRefundable).toBe(order.totalAmount - 15000);
  });
});
