import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { ConfigSchema, type AppConfig } from '../src/config/env.js';
import { resetMockCatalogStore } from '../src/routes/catalog.js';
import { resetMockOrderStore, mockOrdersStore, mockStockStore } from '../src/routes/orders.js';
import type { Order } from '@orange/api-contracts';

const MANAGER_AUTH = 'Bearer mock_manager_:c0a80101-0000-0000-0000-000000000003:+919876543212:Store Manager';
const STAFF_AUTH = 'Bearer mock_staff_:c0a80101-0000-0000-0000-000000000002:+919876543211:Counter Staff';

describe('Phase 6 Concurrency & Invariants: Inventory & Order Operations', () => {
  let app: any;
  const config: AppConfig = ConfigSchema.parse({
    PORT: 4004,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    ALLOW_MOCK_SERVICES: true,
    SUPABASE_URL: 'http://localhost:54321',
  });

  beforeEach(async () => {
    resetMockCatalogStore();
    resetMockOrderStore();
    app = await buildApp({ config });
  });

  describe('1. Order Handover Concurrency & Invariant Enforcement', () => {
    it('concurrent duplicate handovers cannot complete an order twice', async () => {
      const orderId = '00000000-0000-0000-0000-order-handover-race';
      const productId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      mockStockStore.set(productId, { physical: 50, reserved: 2 });
      mockOrdersStore.set(orderId, {
        id: orderId,
        orderNumber: 'MO-HANDOVER-CONCURRENT',
        customerId: '00000000-0000-0000-0000-000000000001',
        customerPhone: '+919876543210',
        customerName: 'Concurrency Customer',
        fulfillmentType: 'counter_pickup',
        estimatedPickupAt: new Date().toISOString(),
        orderStatus: 'ready_for_pickup',
        paymentStatus: 'captured',
        paymentMethod: 'online_upi',
        subtotalAmount: 130000,
        taxAmount: 6500,
        packagingAmount: 0,
        totalAmount: 136500,
        createdAt: new Date().toISOString(),
        items: [
          {
            id: 'item-race-1',
            productId,
            productNameSnapshot: 'Dark Chocolate Truffle Cake (500g)',
            unitPriceSnapshot: 65000,
            taxRateSnapshot: 5.0,
            quantity: 2,
            lineTotal: 130000,
          },
        ],
      } as Order);

      // Fire 10 concurrent handover requests simultaneously
      const concurrencyCount = 10;
      const promises = Array.from({ length: concurrencyCount }, () =>
        app.inject({
          method: 'POST',
          url: `/api/v1/admin/orders/${orderId}/handover`,
          headers: { authorization: STAFF_AUTH },
          payload: { cashCollected: false },
        })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.statusCode === 200).length;
      const conflictCount = results.filter((r) => r.statusCode === 409).length;

      // Exactly ONE request must succeed; all other concurrent duplicate attempts must receive 409
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(concurrencyCount - 1);

      // Physical stock and reserved stock must be decremented exactly ONCE (50 - 2 = 48)
      const finalStock = mockStockStore.get(productId)!;
      expect(finalStock.physical).toBe(48);
      expect(finalStock.reserved).toBe(0);
      expect(mockOrdersStore.get(orderId)?.orderStatus).toBe('completed');
    });

    it('cash-at-pickup handover requires explicit cash confirmation', async () => {
      const orderId = '00000000-0000-0000-0000-order-cash-check';
      const productId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      mockStockStore.set(productId, { physical: 10, reserved: 1 });
      mockOrdersStore.set(orderId, {
        id: orderId,
        orderNumber: 'MO-CASH-CONFIRMATION',
        customerId: '00000000-0000-0000-0000-000000000001',
        customerPhone: '+919876543210',
        customerName: 'Cash Customer',
        fulfillmentType: 'counter_pickup',
        estimatedPickupAt: new Date().toISOString(),
        orderStatus: 'ready_for_pickup',
        paymentStatus: 'unpaid',
        paymentMethod: 'cash_at_pickup',
        subtotalAmount: 65000,
        taxAmount: 3250,
        packagingAmount: 0,
        totalAmount: 68250,
        createdAt: new Date().toISOString(),
        items: [
          {
            id: 'item-cash-1',
            productId,
            productNameSnapshot: 'Dark Chocolate Truffle Cake (500g)',
            unitPriceSnapshot: 65000,
            taxRateSnapshot: 5.0,
            quantity: 1,
            lineTotal: 65000,
          },
        ],
      } as Order);

      // Attempt 1: cashCollected is false -> rejected with 400 CASH_NOT_COLLECTED
      const resRejected = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${orderId}/handover`,
        headers: { authorization: STAFF_AUTH },
        payload: { cashCollected: false },
      });
      expect(resRejected.statusCode).toBe(400);
      const rejectedBody = JSON.parse(resRejected.payload);
      expect(rejectedBody.error.code).toBe('CASH_NOT_COLLECTED');

      // Order status and stock remain untouched after rejection
      expect(mockOrdersStore.get(orderId)?.orderStatus).toBe('ready_for_pickup');
      expect(mockStockStore.get(productId)?.physical).toBe(10);
      expect(mockStockStore.get(productId)?.reserved).toBe(1);

      // Attempt 2: cashCollected is true -> successful handover
      const resSuccess = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${orderId}/handover`,
        headers: { authorization: STAFF_AUTH },
        payload: { cashCollected: true },
      });
      expect(resSuccess.statusCode).toBe(200);
      expect(mockOrdersStore.get(orderId)?.orderStatus).toBe('completed');
      expect(mockOrdersStore.get(orderId)?.paymentStatus).toBe('captured');
      expect(mockStockStore.get(productId)?.physical).toBe(9);
      expect(mockStockStore.get(productId)?.reserved).toBe(0);
    });

    it('rejects invalid order-status transitions', async () => {
      const orderId = '00000000-0000-0000-0000-order-transition-test';
      mockOrdersStore.set(orderId, {
        id: orderId,
        orderNumber: 'MO-TRANSITION-TEST',
        customerId: '00000000-0000-0000-0000-000000000001',
        customerPhone: '+919876543210',
        customerName: 'Transition Customer',
        fulfillmentType: 'counter_pickup',
        estimatedPickupAt: new Date().toISOString(),
        orderStatus: 'confirmed',
        paymentStatus: 'captured',
        paymentMethod: 'online_upi',
        subtotalAmount: 65000,
        taxAmount: 3250,
        packagingAmount: 0,
        totalAmount: 68250,
        createdAt: new Date().toISOString(),
        items: [],
      } as Order);

      // Skipping state: confirmed -> ready_for_pickup directly is invalid
      const resSkip = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${orderId}/status`,
        headers: { authorization: STAFF_AUTH },
        payload: { status: 'ready_for_pickup' },
      });
      expect(resSkip.statusCode).toBe(400);
      const skipBody = JSON.parse(resSkip.payload);
      expect(skipBody.error.code).toBe('INVALID_ORDER_TRANSITION');

      // Invalid backwards transition
      const resBack = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${orderId}/status`,
        headers: { authorization: STAFF_AUTH },
        payload: { status: 'draft' },
      });
      expect(resBack.statusCode).toBe(400);

      // Valid forward transition: confirmed -> preparing
      const resValid = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${orderId}/status`,
        headers: { authorization: STAFF_AUTH },
        payload: { status: 'preparing' },
      });
      expect(resValid.statusCode).toBe(200);
      expect(mockOrdersStore.get(orderId)?.orderStatus).toBe('preparing');
    });
  });

  describe('2. Inventory Concurrency & Write-off Invariant Defense', () => {
    it('write-offs cannot reduce physical stock below reserved stock', async () => {
      const productId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      // Physical: 10, Reserved: 8 -> Unreserved available: 2
      mockStockStore.set(productId, { physical: 10, reserved: 8 });

      // Attempting to write off 3 units (which would leave 7 physical < 8 reserved)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/inventory/write-off',
        headers: { authorization: MANAGER_AUTH },
        payload: {
          productId,
          damagedQuantity: 3,
          reason: 'Dropped tray during transit',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INVENTORY_WRITE_OFF_BLOCKED');

      // Stock remains preserved
      const stock = mockStockStore.get(productId)!;
      expect(stock.physical).toBe(10);
      expect(stock.reserved).toBe(8);
    });

    it('concurrent write-offs cannot oversell or violate stock invariants', async () => {
      const productId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      // Physical: 10, Reserved: 2 -> Unreserved available: 8
      mockStockStore.set(productId, { physical: 10, reserved: 2 });

      // Fire 4 concurrent write-off requests of 3 units each (total requested = 12, available = 8)
      // Exactly 2 requests (2 * 3 = 6 units) can succeed (leaving 4 physical, 2 reserved, 2 available).
      // The remaining 2 requests must be rejected with 409 INVENTORY_WRITE_OFF_BLOCKED.
      const promises = Array.from({ length: 4 }, (_, idx) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/admin/inventory/write-off',
          headers: { authorization: MANAGER_AUTH },
          payload: {
            productId,
            damagedQuantity: 3,
            reason: `Batch damaged inspection #${idx + 1}`,
          },
        })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.statusCode === 200).length;
      const blockedCount = results.filter((r) => r.statusCode === 409).length;

      expect(successCount).toBe(2);
      expect(blockedCount).toBe(2);

      // Invariant physical_stock >= reserved_stock must strictly hold
      const finalStock = mockStockStore.get(productId)!;
      expect(finalStock.physical).toBe(4);
      expect(finalStock.reserved).toBe(2);
      expect(finalStock.physical).toBeGreaterThanOrEqual(finalStock.reserved);
    });

    it('inventory write-offs and stock adjustments maintain non-negative and balance constraints', async () => {
      const productId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
      mockStockStore.set(productId, { physical: 15, reserved: 5 });

      // Attempt adjustment that would cause physical < reserved (e.g. delta = -12 -> physical = 3 < reserved 5)
      const resBadAdjust = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/inventory/adjust',
        headers: { authorization: MANAGER_AUTH },
        payload: {
          productId,
          physicalStockDelta: -12,
          reason: 'Excessive audit deduction',
        },
      });

      expect(resBadAdjust.statusCode).toBe(400);
      const body = JSON.parse(resBadAdjust.payload);
      expect(body.error.code).toBe('INVALID_STOCK_ADJUSTMENT');

      // Valid adjustment (delta = +5)
      const resGoodAdjust = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/inventory/adjust',
        headers: { authorization: MANAGER_AUTH },
        payload: {
          productId,
          physicalStockDelta: 5,
          reason: 'Supplier restock received',
        },
      });
      expect(resGoodAdjust.statusCode).toBe(200);
      expect(mockStockStore.get(productId)?.physical).toBe(20);
      expect(mockStockStore.get(productId)?.reserved).toBe(5);
    });
  });
});
