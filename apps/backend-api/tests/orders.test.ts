import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { ConfigSchema, type AppConfig } from '../src/config/env.js';
import { resetMockOrderStore } from '../src/routes/orders.js';

describe('Phase 5: Auth, Profile, Cart Validation & Orders Engine', () => {
  let app: FastifyInstance;

  const testConfig: AppConfig = ConfigSchema.parse({
    PORT: 4002,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    ALLOW_MOCK_SERVICES: true,
    SUPABASE_URL: 'http://localhost:54321',
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

  beforeAll(async () => {
    app = await buildApp({ config: testConfig });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetMockOrderStore();
  });

  describe('1. Authentication & Session Validation', () => {
    it('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/profile',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid or expired tokens with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/profile',
        headers: {
          authorization: 'Bearer invalid_or_expired_token_xyz',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('accepts valid session cookie for authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/profile',
        headers: {
          cookie: `moody_session=${encodeURIComponent(customerA.token)}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.profile.id).toBe(customerA.id);
      expect(body.profile.phone).toBe(customerA.phone);
    });

    it('allows updating customer full name via PUT /api/v1/profile', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/profile',
        headers: {
          authorization: `Bearer ${customerA.token}`,
        },
        payload: {
          fullName: 'Abhinav Kumar',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.profile.fullName).toBe('Abhinav Kumar');
    });
  });

  describe('2. Cart Validation & Recomputation (POST /orders/validate-cart)', () => {
    it('calculates authoritative subtotal, 5% tax, and line totals in integer paise', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/validate-cart',
        payload: {
          items: [
            { productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', quantity: 2 }, // ₹650 * 2 = 130000 paise
            { productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', quantity: 1 }, // ₹180 * 1 = 18000 paise
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.isValid).toBe(true);
      expect(body.hasOutOfStockItems).toBe(false);
      expect(body.subtotalAmount).toBe(148000); // 130000 + 18000
      expect(body.taxAmount).toBe(7400); // 5% of 148000 = 7400
      expect(body.totalAmount).toBe(155400); // 148000 + 7400
    });

    it('aggregates duplicate product line items in cart validation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/validate-cart',
        payload: {
          items: [
            { productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', quantity: 2 },
            { productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', quantity: 3 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.items.length).toBe(1);
      expect(body.items[0].quantity).toBe(5);
      expect(body.items[0].lineTotal).toBe(18000 * 5);
    });

    it('rejects invalid or empty cart validation request with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/validate-cart',
        payload: {
          items: [],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('3. Order Creation & Stock Reservation (POST /orders/checkout)', () => {
    it('rejects checkout without X-Idempotency-Key with 400 MISSING_IDEMPOTENCY_KEY', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
        },
        payload: {
          items: [{ productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', quantity: 1 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer A',
          customerPhone: '+919876543210',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('MISSING_IDEMPOTENCY_KEY');
    });

    it('rejects checkout with invalid X-Idempotency-Key characters with 400 INVALID_IDEMPOTENCY_KEY', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': 'invalid key with spaces and @#$!',
        },
        payload: {
          items: [{ productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', quantity: 1 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer A',
          customerPhone: '+919876543210',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INVALID_IDEMPOTENCY_KEY');
    });

    it('creates a Cash at Pickup order in confirmed, unpaid state with no online expiration', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': 'cash_order_key_001',
        },
        payload: {
          items: [{ productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', quantity: 1 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer A',
          customerPhone: '+919876543210',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.orderStatus).toBe('confirmed');
      expect(body.paymentStatus).toBe('unpaid');
      expect(body.expiresAt).toBeNull();
      expect(body.totalAmount).toBe(68250); // 65000 + 5% tax (3250)
      expect(body.currency).toBe('INR');
      expect(body.orderNumber).toMatch(/^MO-\d{8}-\d{4}$/);
    });

    it('creates an Online order in draft, pending state with 10-minute expiration', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': 'online_order_key_002',
        },
        payload: {
          items: [{ productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', quantity: 1 }],
          fulfillment: 'immediate',
          paymentMethod: 'online_razorpay',
          customerName: 'Customer A',
          customerPhone: '+919876543210',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.orderStatus).toBe('draft');
      expect(body.paymentStatus).toBe('pending');
      expect(body.expiresAt).not.toBeNull();

      // Verify expiration is ~10 minutes in the future
      const expiry = new Date(body.expiresAt).getTime();
      const now = Date.now();
      expect(expiry).toBeGreaterThan(now + 9 * 60 * 1000);
      expect(expiry).toBeLessThanOrEqual(now + 11 * 60 * 1000);
    });

    it('uses verified phone from authenticated session and ignores client-supplied spoofed phone', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': 'phone_spoof_test_key_001',
        },
        payload: {
          items: [{ productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', quantity: 1 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer A',
          customerPhone: '+919999999999', // Spoofed phone
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/orders/${body.orderId}`,
        headers: {
          authorization: `Bearer ${customerA.token}`,
        },
      });

      expect(getRes.statusCode).toBe(200);
      const orderBody = JSON.parse(getRes.payload);
      expect(orderBody.order.customerPhone).toBe(customerA.phone);
      expect(orderBody.order.customerPhone).not.toBe('+919999999999');
    });

    it('rejects scheduled pickup orders with past or missing schedule date with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': 'sched_order_key_003',
        },
        payload: {
          items: [{ productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', quantity: 1 }],
          fulfillment: 'scheduled',
          scheduledPickupAt: '2020-01-01T10:00:00.000Z',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer A',
          customerPhone: '+919876543210',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INVALID_SCHEDULE');
    });

    it('enforces customer-scoped idempotency: duplicate retry returns existing order', async () => {
      const idempotencyKey = 'idemp_unique_key_001';

      const payload = {
        items: [{ productId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', quantity: 1 }],
        fulfillment: 'immediate',
        paymentMethod: 'cash_at_pickup',
        customerName: 'Customer A',
        customerPhone: '+919876543210',
      };

      // First attempt
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': idempotencyKey,
        },
        payload,
      });

      expect(res1.statusCode).toBe(201);
      const body1 = JSON.parse(res1.payload);

      // Second attempt (identical key & payload)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': idempotencyKey,
        },
        payload,
      });

      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.payload);
      expect(body2.orderId).toBe(body1.orderId);
      expect(body2.orderNumber).toBe(body1.orderNumber);
    });

    it('rejects idempotency key reuse with mismatched payload with 409 Conflict', async () => {
      const idempotencyKey = 'idemp_conflict_key_002';

      // First attempt
      await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': idempotencyKey,
        },
        payload: {
          items: [{ productId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', quantity: 1 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer A',
          customerPhone: '+919876543210',
        },
      });

      // Second attempt with different items
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': idempotencyKey,
        },
        payload: {
          items: [{ productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', quantity: 3 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer A',
          customerPhone: '+919876543210',
        },
      });

      expect(res2.statusCode).toBe(409);
      const body2 = JSON.parse(res2.payload);
      expect(body2.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('rejects idempotency key reuse across different customers with 403 Forbidden', async () => {
      const sharedKey = 'cross_customer_idemp_key_003';

      // Customer A places order
      await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': sharedKey,
        },
        payload: {
          items: [{ productId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', quantity: 1 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer A',
          customerPhone: '+919876543210',
        },
      });

      // Customer B tries to reuse Customer A's key
      const resB = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerB.token}`,
          'x-idempotency-key': sharedKey,
        },
        payload: {
          items: [{ productId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', quantity: 1 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer B',
          customerPhone: '+919999999999',
        },
      });

      expect(resB.statusCode).toBe(403);
      const bodyB = JSON.parse(resB.payload);
      expect(bodyB.error.code).toBe('IDEMPOTENCY_OWNERSHIP_MISMATCH');
    });
  });

  describe('4. Cross-Customer Order Isolation & Ownership Enforcement', () => {
    it('prevents Customer B from accessing Customer A order via GET /orders/:id (returns 403)', async () => {
      // Customer A creates an order
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': 'cross_cust_order_a_001',
        },
        payload: {
          items: [{ productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', quantity: 1 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer A',
          customerPhone: '+919876543210',
        },
      });

      const orderA = JSON.parse(createRes.payload);

      // Customer A can view own order
      const viewResA = await app.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderA.orderId}`,
        headers: {
          authorization: `Bearer ${customerA.token}`,
        },
      });
      expect(viewResA.statusCode).toBe(200);

      // Customer B attempts to view Customer A order -> MUST return 403 Forbidden
      const viewResB = await app.inject({
        method: 'GET',
        url: `/api/v1/orders/${orderA.orderId}`,
        headers: {
          authorization: `Bearer ${customerB.token}`,
        },
      });

      expect(viewResB.statusCode).toBe(403);
      const errorBody = JSON.parse(viewResB.payload);
      expect(errorBody.error.code).toBe('FORBIDDEN_ORDER_ACCESS');
    });

    it('customer only sees their own orders in GET /orders list', async () => {
      // Customer A places an order
      await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerA.token}`,
          'x-idempotency-key': 'cust_a_list_order_001',
        },
        payload: {
          items: [{ productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', quantity: 1 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer A',
          customerPhone: '+919876543210',
        },
      });

      // Customer B places an order
      await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: `Bearer ${customerB.token}`,
          'x-idempotency-key': 'cust_b_list_order_002',
        },
        payload: {
          items: [{ productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', quantity: 2 }],
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
          customerName: 'Customer B',
          customerPhone: '+919999999999',
        },
      });

      // Customer A queries /orders
      const resA = await app.inject({
        method: 'GET',
        url: '/api/v1/orders',
        headers: {
          authorization: `Bearer ${customerA.token}`,
        },
      });
      const bodyA = JSON.parse(resA.payload);
      expect(bodyA.orders.length).toBe(1);
      expect(bodyA.orders[0].customerId).toBe(customerA.id);

      // Customer B queries /orders
      const resB = await app.inject({
        method: 'GET',
        url: '/api/v1/orders',
        headers: {
          authorization: `Bearer ${customerB.token}`,
        },
      });
      const bodyB = JSON.parse(resB.payload);
      expect(bodyB.orders.length).toBe(1);
      expect(bodyB.orders[0].customerId).toBe(customerB.id);
    });
  });
});

