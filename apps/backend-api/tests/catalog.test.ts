import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { ConfigSchema, type AppConfig } from '../src/config/env.js';

describe('Catalog Routes (GET /api/v1/categories & /api/v1/products)', () => {
  let app: FastifyInstance;

  const testConfig: AppConfig = ConfigSchema.parse({
    PORT: 4001,
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    ALLOW_MOCK_SERVICES: true,
    SUPABASE_URL: 'http://localhost:54321',
  });

  beforeAll(async () => {
    app = await buildApp({ config: testConfig });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/categories should return all active categories', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/categories',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('categories');
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.categories.length).toBeGreaterThanOrEqual(3);

    // Verify category attributes
    const firstCat = body.categories[0];
    expect(firstCat).toHaveProperty('id');
    expect(firstCat).toHaveProperty('name');
    expect(firstCat).toHaveProperty('slug');
    expect(firstCat).toHaveProperty('display_order');
  });

  it('GET /api/v1/products should return active products with integer paise and availability', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('products');
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products.length).toBeGreaterThanOrEqual(3);

    body.products.forEach((product: Record<string, unknown>) => {
      // Ensure prices are integers in paise
      expect(Number.isInteger(product.basePrice)).toBe(true);
      expect((product.basePrice as number) >= 0).toBe(true);

      // Ensure availability boolean is provided
      expect(typeof product.isInStock).toBe('boolean');

      // CRITICAL SECURITY & PRIVACY INVARIANT:
      // Never expose physical_stock or reserved_stock internal counts in customer API
      expect(product).not.toHaveProperty('physical_stock');
      expect(product).not.toHaveProperty('physicalStock');
      expect(product).not.toHaveProperty('reserved_stock');
      expect(product).not.toHaveProperty('reservedStock');
    });
  });

  it('GET /api/v1/products?category_slug=cold-pressed-juices should filter by category', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products?category_slug=cold-pressed-juices',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.products.length).toBeGreaterThanOrEqual(1);
    body.products.forEach((p: { categorySlug: string }) => {
      expect(p.categorySlug).toBe('cold-pressed-juices');
    });
  });

  it('GET /api/v1/products?search=Truffle should filter products case-insensitively', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products?search=truffle',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.products.length).toBeGreaterThanOrEqual(1);
    expect(body.products[0].name).toContain('Truffle');
  });

  it('GET /api/v1/products?search=NonExistentQuery12345 should return empty products list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products?search=NonExistentQuery12345',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.products).toEqual([]);
  });

  it('GET /api/v1/products/:idOrSlug should return product details by slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products/dark-chocolate-truffle-cake-500g',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('product');
    expect(body.product.slug).toBe('dark-chocolate-truffle-cake-500g');
    expect(body.product.basePrice).toBe(65000); // 65000 paise = 650 INR
    expect(body.product.categoryName).toBe('Artisanal Cakes');
  });

  it('GET /api/v1/products/:idOrSlug should return product details by UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.product.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('GET /api/v1/products/:idOrSlug should return 404 for unknown product', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products/non-existent-cake-slug',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
    expect(body.error.statusCode).toBe(404);
  });

  it('Production mode: rejects sample fallback and returns 503 DATABASE_UNAVAILABLE when database is down', async () => {
    const prodConfig: AppConfig = ConfigSchema.parse({
      PORT: 4002,
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      ALLOW_MOCK_SERVICES: false,
      SUPABASE_URL: 'https://prod-unreachable-db.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.realProdKeyString1234567890',
    });

    const prodApp = await buildApp({ config: prodConfig });
    await prodApp.ready();

    try {
      const catRes = await prodApp.inject({
        method: 'GET',
        url: '/api/v1/categories',
      });
      expect(catRes.statusCode).toBe(503);
      const catBody = JSON.parse(catRes.payload);
      expect(catBody.error.code).toBe('DATABASE_UNAVAILABLE');

      const prodRes = await prodApp.inject({
        method: 'GET',
        url: '/api/v1/products',
      });
      expect(prodRes.statusCode).toBe(503);
      const prodBody = JSON.parse(prodRes.payload);
      expect(prodBody.error.code).toBe('DATABASE_UNAVAILABLE');
    } finally {
      await prodApp.close();
    }
  });
});

