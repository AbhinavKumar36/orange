import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { ConfigSchema, type AppConfig } from '../src/config/env.js';
import { resetMockCatalogStore } from '../src/routes/catalog.js';
import { resetMockOrderStore, mockOrdersStore } from '../src/routes/orders.js';

describe('Phase 6: Admin Operations & RBAC Authorization', () => {
  let app: any;
  const config: AppConfig = ConfigSchema.parse({
    PORT: 4003,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    ALLOW_MOCK_SERVICES: true,
    SUPABASE_URL: 'http://localhost:54321',
  });

  const CUSTOMER_AUTH = 'Bearer mock_customer_:c0a80101-0000-0000-0000-000000000001';
  const STAFF_AUTH = 'Bearer mock_staff_:c0a80101-0000-0000-0000-000000000002';
  const MANAGER_AUTH = 'Bearer mock_manager_:c0a80101-0000-0000-0000-000000000003';
  const ADMIN_AUTH = 'Bearer mock_admin_:c0a80101-0000-0000-0000-000000000004';

  const CAKES_CATEGORY_ID = '11111111-1111-1111-1111-111111111111';
  const TARGET_PRODUCT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(async () => {
    resetMockCatalogStore();
    resetMockOrderStore();
    app = await buildApp({ config });
  });

  describe('1. Server-Enforced RBAC & Admin Identity', () => {
    it('rejects unauthenticated requests to /api/v1/admin/me with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/me',
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects ordinary customer tokens from accessing admin routes with 403 FORBIDDEN_NOT_STAFF', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/me',
        headers: { authorization: CUSTOMER_AUTH },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('FORBIDDEN_NOT_STAFF');
    });

    it('allows counter staff to view /api/v1/admin/me and reports verified role', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/me',
        headers: { authorization: STAFF_AUTH },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.staff.role).toBe('counter_staff');
      expect(body.staff.isActive).toBe(true);
    });

    it('allows staff to view /api/v1/admin/dashboard metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/dashboard',
        headers: { authorization: STAFF_AUTH },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(typeof body.totalOrders).toBe('number');
      expect(typeof body.activeProducts).toBe('number');
    });
  });

  describe('2. Product & Category Management RBAC', () => {
    it('forbids counter_staff from creating products with 403 INSUFFICIENT_PERMISSIONS', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { authorization: STAFF_AUTH },
        payload: {
          name: 'Unauthorized Cake',
          slug: 'unauthorized-cake',
          categoryId: CAKES_CATEGORY_ID,
          basePrice: 50000,
        },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('allows manager to create a new product and initializes inventory', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { authorization: MANAGER_AUTH },
        payload: {
          name: 'Manager Special Torte',
          slug: 'manager-special-torte',
          categoryId: CAKES_CATEGORY_ID,
          basePrice: 75000,
          initialStock: 25,
          lowStockThreshold: 5,
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.name).toBe('Manager Special Torte');
      expect(body.physicalStock).toBe(25);
    });

    it('rejects duplicate product slugs with 409 DUPLICATE_SLUG', async () => {
      const payload = {
        name: 'Duplicate Cake',
        slug: 'duplicate-test-cake',
        categoryId: CAKES_CATEGORY_ID,
        basePrice: 50000,
      };

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { authorization: MANAGER_AUTH },
        payload,
      });
      expect(res1.statusCode).toBe(201);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { authorization: MANAGER_AUTH },
        payload,
      });
      expect(res2.statusCode).toBe(409);
      const body2 = JSON.parse(res2.payload);
      expect(body2.error.code).toBe('DUPLICATE_SLUG');
    });

    it('blocks category deletion if products are assigned to it (400 CATEGORY_NOT_EMPTY)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/categories/${CAKES_CATEGORY_ID}`,
        headers: { authorization: ADMIN_AUTH },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('CATEGORY_NOT_EMPTY');
    });
  });

  describe('3. Order Queue, State Transitions & Counter Handover', () => {
    let testOrderId: string;

    beforeEach(async () => {
      // Create a confirmed order for testing handover
      const checkoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: CUSTOMER_AUTH,
          'x-idempotency-key': `idemp_handover_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
        },
        payload: {
          items: [{ productId: TARGET_PRODUCT, quantity: 2 }],
          customerName: 'Aarav Mehta',
          customerPhone: '+919876543210',
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
        },
      });
      expect(checkoutRes.statusCode).toBe(201);
      const checkoutBody = JSON.parse(checkoutRes.payload);
      testOrderId = checkoutBody.orderId;

      // Advance to ready_for_pickup so handover tests can execute against a prepared order
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${testOrderId}/status`,
        headers: { authorization: STAFF_AUTH },
        payload: { status: 'preparing' },
      });
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${testOrderId}/status`,
        headers: { authorization: STAFF_AUTH },
        payload: { status: 'ready_for_pickup' },
      });
    });

    it('advances order status along valid lifecycle: confirmed -> preparing -> ready_for_pickup', async () => {
      // Create a fresh confirmed order specifically for status progression test
      const freshCheckout = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: CUSTOMER_AUTH,
          'x-idempotency-key': `idemp_status_progression_${Date.now()}`,
        },
        payload: {
          items: [{ productId: TARGET_PRODUCT, quantity: 1 }],
          customerName: 'Priya Patel',
          customerPhone: '+919876543210',
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
        },
      });
      expect(freshCheckout.statusCode).toBe(201);
      const freshOrderId = JSON.parse(freshCheckout.payload).orderId;

      // confirmed -> preparing
      const res1 = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${freshOrderId}/status`,
        headers: { authorization: STAFF_AUTH },
        payload: { status: 'preparing' },
      });
      expect(res1.statusCode).toBe(200);
      expect(JSON.parse(res1.payload).order.orderStatus).toBe('preparing');

      // preparing -> ready_for_pickup
      const res2 = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${freshOrderId}/status`,
        headers: { authorization: STAFF_AUTH },
        payload: { status: 'ready_for_pickup' },
      });
      expect(res2.statusCode).toBe(200);
      expect(JSON.parse(res2.payload).order.orderStatus).toBe('ready_for_pickup');
    });

    it('rejects invalid status skips (e.g. invalid status values)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${testOrderId}/status`,
        headers: { authorization: STAFF_AUTH },
        payload: { status: 'completed' }, // Completed must go through /handover, not raw patch
      });
      expect(res.statusCode).toBe(400);
    });

    it('blocks counter handover for cash orders if cashCollected is false (400 CASH_NOT_COLLECTED)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/handover`,
        headers: { authorization: STAFF_AUTH },
        payload: { cashCollected: false },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('CASH_NOT_COLLECTED');
    });

    it('completes counter handover when cashCollected is true, marking order completed', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/handover`,
        headers: { authorization: STAFF_AUTH },
        payload: { cashCollected: true },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.order.orderStatus).toBe('completed');
      expect(body.order.paymentStatus).toBe('captured');
    });

    it('rejects duplicate handover attempts on already completed order with 409 ORDER_ALREADY_COMPLETED', async () => {
      // First handover
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/handover`,
        headers: { authorization: STAFF_AUTH },
        payload: { cashCollected: true },
      });

      // Second handover attempt
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${testOrderId}/handover`,
        headers: { authorization: STAFF_AUTH },
        payload: { cashCollected: true },
      });
      expect(res2.statusCode).toBe(409);
      const body2 = JSON.parse(res2.payload);
      expect(body2.error.code).toBe('ORDER_ALREADY_COMPLETED');
    });
  });

  describe('4. Inventory Tracking & Damage Write-off Defense', () => {
    it('forbids counter_staff from performing damage write-offs with 403 INSUFFICIENT_PERMISSIONS', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/inventory/write-off',
        headers: { authorization: STAFF_AUTH },
        payload: {
          productId: TARGET_PRODUCT,
          damagedQuantity: 1,
          reason: 'Dropped on floor',
        },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('allows manager to perform damage write-off when unreserved stock is sufficient', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/inventory/write-off',
        headers: { authorization: MANAGER_AUTH },
        payload: {
          productId: TARGET_PRODUCT,
          damagedQuantity: 2,
          reason: 'Packaging seal broke during shelf stocking',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.physicalStock).toBeDefined();
    });

    it('blocks damage write-off that would breach active customer reservations (409 INVENTORY_WRITE_OFF_BLOCKED)', async () => {
      // Create a checkout reserving stock on TARGET_PRODUCT
      const checkoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/orders/checkout',
        headers: {
          authorization: CUSTOMER_AUTH,
          'x-idempotency-key': `idemp_writeoff_defense_${Date.now()}`,
        },
        payload: {
          items: [{ productId: TARGET_PRODUCT, quantity: 5 }],
          customerName: 'Rohan Sharma',
          customerPhone: '+919876543210',
          fulfillment: 'immediate',
          paymentMethod: 'cash_at_pickup',
        },
      });
      expect(checkoutRes.statusCode).toBe(201);

      // Attempt write-off exceeding unreserved physical stock
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/inventory/write-off',
        headers: { authorization: MANAGER_AUTH },
        payload: {
          productId: TARGET_PRODUCT,
          damagedQuantity: 999,
          reason: 'Total warehouse flood damage',
        },
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INVENTORY_WRITE_OFF_BLOCKED');
    });
  });
});
