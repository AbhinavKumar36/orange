import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { ConfigSchema, type AppConfig } from '../src/config/env.js';
import { mockStockStore, resetMockOrderStore } from '../src/routes/orders.js';

describe('Inventory & Stock Dynamic Verification (Buy & Sell Lifecycles)', () => {
  let app: FastifyInstance;

  const testConfig: AppConfig = ConfigSchema.parse({
    PORT: 4004,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    ALLOW_MOCK_SERVICES: true,
    SUPABASE_URL: 'http://localhost:54321',
  });

  const testCustomer = {
    id: '33333333-3333-3333-3333-333333333333',
    phone: '+919876543210',
    name: 'Dynamic Stock Tester',
    token: 'mock_customer_:33333333-3333-3333-3333-333333333333:+919876543210:Dynamic Stock Tester',
  };

  const managerAuth = {
    token: 'mock_manager_:manager-verify-uuid:+919876543210:Test Manager',
  };

  const targetProductId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; // Dark Chocolate Truffle Cake

  beforeAll(async () => {
    app = await buildApp({ config: testConfig });
    await app.ready();
    resetMockOrderStore();
  });

  afterAll(async () => {
    await app.close();
  });

  it('verifies initial stock state: available stock = physical - reserved', async () => {
    // Set explicit physical: 10, reserved: 0 -> available: 10
    mockStockStore.set(targetProductId, { physical: 10, reserved: 0 });

    const stock = mockStockStore.get(targetProductId)!;
    expect(stock.physical).toBe(10);
    expect(stock.reserved).toBe(0);
    expect(stock.physical - stock.reserved).toBe(10);

    // Verify catalog reflects in stock
    const catRes = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
    });
    expect(catRes.statusCode).toBe(200);
    const catBody = JSON.parse(catRes.payload);
    const product = catBody.products.find((p: { id: string }) => p.id === targetProductId);
    expect(product).toBeDefined();
    expect(product.isInStock).toBe(true);
  });

  it('buying 4 units immediately reserves stock and reduces available stock from 10 to 6', async () => {
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/checkout',
      headers: {
        authorization: `Bearer ${testCustomer.token}`,
        'idempotency-key': 'idemp_stock_test_1',
      },
      payload: {
        items: [{ productId: targetProductId, quantity: 4 }],
        fulfillment: 'immediate',
        paymentMethod: 'cash_at_pickup',
        customerName: testCustomer.name,
        customerPhone: testCustomer.phone,
      },
    });

    expect(checkoutRes.statusCode).toBe(201);
    const orderData = JSON.parse(checkoutRes.payload);
    expect(orderData.orderStatus).toBe('confirmed');

    // Authoritative stock check: reserved must increase by 4, available must drop to 6
    const stock = mockStockStore.get(targetProductId)!;
    expect(stock.physical).toBe(10);
    expect(stock.reserved).toBe(4);
    expect(stock.physical - stock.reserved).toBe(6);
  });

  it('buying remaining 6 units depletes stock to 0 and dynamically sets isInStock to false', async () => {
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/checkout',
      headers: {
        authorization: `Bearer ${testCustomer.token}`,
        'idempotency-key': 'idemp_stock_test_2',
      },
      payload: {
        items: [{ productId: targetProductId, quantity: 6 }],
        fulfillment: 'immediate',
        paymentMethod: 'cash_at_pickup',
        customerName: testCustomer.name,
        customerPhone: testCustomer.phone,
      },
    });

    expect(checkoutRes.statusCode).toBe(201);

    // Authoritative stock check: reserved must be 10, available must be exactly 0
    const stock = mockStockStore.get(targetProductId)!;
    expect(stock.physical).toBe(10);
    expect(stock.reserved).toBe(10);
    const available = stock.physical - stock.reserved;
    expect(available).toBe(0);

    // Dynamic catalog verification: product MUST now dynamically return isInStock: false
    const catRes = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
    });
    expect(catRes.statusCode).toBe(200);
    const catBody = JSON.parse(catRes.payload);
    const product = catBody.products.find((p: { id: string }) => p.id === targetProductId);
    expect(product.isInStock).toBe(false);
  });

  it('rejects subsequent purchase attempts with 422 INSUFFICIENT_STOCK when stock is 0', async () => {
    const failedCheckout = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/checkout',
      headers: {
        authorization: `Bearer ${testCustomer.token}`,
        'idempotency-key': 'idemp_stock_test_3',
      },
      payload: {
        items: [{ productId: targetProductId, quantity: 1 }],
        fulfillment: 'immediate',
        paymentMethod: 'cash_at_pickup',
        customerName: testCustomer.name,
        customerPhone: testCustomer.phone,
      },
    });

    expect(failedCheckout.statusCode).toBe(422);
    const errBody = JSON.parse(failedCheckout.payload);
    expect(errBody.error.code).toBe('INSUFFICIENT_STOCK');
    expect(errBody.error.message).toContain('Insufficient stock');
  });

  it('completing handover permanently deducts physical stock and releases reservation', async () => {
    // Fetch customer orders to get order ID for first purchase
    const ordersRes = await app.inject({
      method: 'GET',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${testCustomer.token}`,
      },
    });
    expect(ordersRes.statusCode).toBe(200);
    const orders = JSON.parse(ordersRes.payload).orders;
    const orderToHandover = orders.find((o: { totalAmount: number }) => o.totalAmount > 0);

    // Advance to ready_for_pickup
    const prepRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/orders/${orderToHandover.id}/status`,
      headers: { authorization: `Bearer ${managerAuth.token}` },
      payload: { status: 'preparing' },
    });
    const readyRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/orders/${orderToHandover.id}/status`,
      headers: { authorization: `Bearer ${managerAuth.token}` },
      payload: { status: 'ready_for_pickup' },
    });

    // Complete handover
    const handoverRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${orderToHandover.id}/handover`,
      headers: { authorization: `Bearer ${managerAuth.token}` },
      payload: { cashCollected: true },
    });
    expect(handoverRes.statusCode).toBe(200);

    // Physical stock must decrease permanently, reserved stock must decrease
    const stock = mockStockStore.get(targetProductId)!;
    expect(stock.physical).toBeLessThan(10);
    expect(stock.reserved).toBeLessThan(10);
    expect(stock.physical).toBeGreaterThanOrEqual(stock.reserved);
  });
});
