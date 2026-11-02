import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  type Order,
  type StaffRole,
  AdminProductCreateSchema,
  AdminProductUpdateSchema,
  AdminCategoryCreateSchema,
  AdminCategoryUpdateSchema,
  AdminOrderStatusUpdateSchema,
  AdminOrderHandoverSchema,
  AdminOrderCancelSchema,
  AdminInventoryWriteOffSchema,
  AdminInventoryAdjustSchema,
} from '@orange/api-contracts';
import { type AppConfig, loadConfig } from '../config/env.js';
import { createStaffAuthPreHandler } from '../plugins/auth.js';
import {
  mockCategoriesList,
  mockProductsList,
  type MockProductEntry,
} from './catalog.js';
import { mockOrdersStore, mockStockStore } from './orders.js';

export interface AdminRoutesOptions {
  config?: AppConfig;
}

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (app, options) => {
  const config = options.config ?? loadConfig();

  // Helper for executing Supabase REST queries
  async function supabaseRest<T>(path: string, init?: RequestInit): Promise<T | null> {
    const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/rest/v1/${path}`;
    const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY || '';
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      ...((init?.headers as Record<string, string>) || {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(url, { ...init, headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        if (config.NODE_ENV !== 'test') {
          const errText = await res.text().catch(() => '');
          console.warn(`[Admin Supabase Error] ${res.status} at ${url}: ${errText}`);
        }
        return null;
      }
      return (await res.json().catch(() => null)) as T;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  // Helper for executing Supabase RPC calls
  async function supabaseRpc<T>(fnName: string, params: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
    const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/rest/v1/rpc/${fnName}`;
    const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || '';
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { message?: string; details?: string } | null;
        return { data: null, error: errJson?.message || `RPC ${fnName} failed with HTTP ${res.status}` };
      }
      const data = (await res.json().catch(() => null)) as T;
      return { data, error: null };
    } catch (e) {
      clearTimeout(timeoutId);
      return { data: null, error: e instanceof Error ? e.message : 'RPC network error' };
    }
  }

  // ============================================================================
  // 1. Staff Profile & Session Introspection
  // ============================================================================

  app.get(
    '/api/v1/admin/me',
    { preHandler: [createStaffAuthPreHandler(config)] },
    async (request, reply) => {
      const user = request.user!;
      return reply.send({
        staff: {
          id: user.id,
          phone: user.phone || null,
          fullName: user.fullName || null,
          email: user.email || null,
          role: user.staffRole!,
        },
      });
    }
  );

  // ============================================================================
  // 2. Dashboard KPIs & Metrics Overview
  // ============================================================================

  app.get(
    '/api/v1/admin/dashboard',
    { preHandler: [createStaffAuthPreHandler(config)] },
    async (request, reply) => {
      // In mock/test mode:
      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const allOrders = Array.from(mockOrdersStore.values());
        const totalOrders = allOrders.length;
        const ordersAwaitingProcessing = allOrders.filter(
          (o) => o.orderStatus === 'confirmed' || o.orderStatus === 'preparing'
        ).length;
        const ordersReadyForPickup = allOrders.filter((o) => o.orderStatus === 'ready_for_pickup').length;
        const completedOrders = allOrders.filter((o) => o.orderStatus === 'completed').length;

        const grossSalesPaise = allOrders
          .filter((o) => o.orderStatus === 'completed' || o.paymentStatus === 'captured')
          .reduce((sum, o) => sum + o.totalAmount, 0);

        const activeProducts = mockProductsList.filter((p) => p.isActive).length;

        const lowStockAlerts = mockProductsList
          .map((p) => {
            const stock = mockStockStore.get(p.id) || { physical: 0, reserved: 0 };
            const available = stock.physical - stock.reserved;
            return {
              id: p.id,
              name: p.name,
              physicalStock: stock.physical,
              reservedStock: stock.reserved,
              availableStock: available,
              lowStockThreshold: p.lowStockThreshold || 5,
            };
          })
          .filter((item) => item.availableStock <= item.lowStockThreshold);

        const recentOrders = allOrders
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
          .map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            totalAmount: o.totalAmount,
            orderStatus: o.orderStatus,
            paymentStatus: o.paymentStatus,
            createdAt: o.createdAt,
          }));

        return reply.send({
          totalOrders,
          ordersAwaitingProcessing,
          ordersReadyForPickup,
          completedOrders,
          grossSalesPaise,
          activeProducts,
          lowStockProducts: lowStockAlerts.length,
          recentOrders,
          lowStockAlerts,
        });
      }

      // Production / Live Supabase path
      const [ordersData, productsData, inventoryData] = await Promise.all([
        supabaseRest<Array<{ id: string; order_number: string; customer_name: string; total_amount: number; order_status: Order['orderStatus']; payment_status: Order['paymentStatus']; created_at: string }>>(
          'orders?select=id,order_number,customer_name,total_amount,order_status,payment_status,created_at&order=created_at.desc'
        ),
        supabaseRest<Array<{ id: string; name: string; is_active: boolean }>>(
          'products?select=id,name,is_active'
        ),
        supabaseRest<Array<{ product_id: string; physical_stock: number; reserved_stock: number; low_stock_threshold: number }>>(
          'inventory?select=product_id,physical_stock,reserved_stock,low_stock_threshold'
        ),
      ]);

      const orders = ordersData || [];
      const products = productsData || [];
      const inventory = inventoryData || [];

      const invMap = new Map(inventory.map((i) => [i.product_id, i]));
      const lowStockAlerts = products
        .map((p) => {
          const inv = invMap.get(p.id) || { physical_stock: 0, reserved_stock: 0, low_stock_threshold: 5 };
          const avail = inv.physical_stock - inv.reserved_stock;
          return {
            id: p.id,
            name: p.name,
            physicalStock: inv.physical_stock,
            reservedStock: inv.reserved_stock,
            availableStock: avail,
            lowStockThreshold: inv.low_stock_threshold,
          };
        })
        .filter((i) => i.availableStock <= i.lowStockThreshold);

      const totalOrders = orders.length;
      const ordersAwaitingProcessing = orders.filter(
        (o) => o.order_status === 'confirmed' || o.order_status === 'preparing'
      ).length;
      const ordersReadyForPickup = orders.filter((o) => o.order_status === 'ready_for_pickup').length;
      const completedOrders = orders.filter((o) => o.order_status === 'completed').length;
      const grossSalesPaise = orders
        .filter((o) => o.order_status === 'completed' || o.payment_status === 'captured')
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

      const recentOrders = orders.slice(0, 10).map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.customer_name || 'Guest',
        totalAmount: Number(o.total_amount),
        orderStatus: o.order_status,
        paymentStatus: o.payment_status,
        createdAt: o.created_at,
      }));

      return reply.send({
        totalOrders,
        ordersAwaitingProcessing,
        ordersReadyForPickup,
        completedOrders,
        grossSalesPaise,
        activeProducts: products.filter((p) => p.is_active).length,
        lowStockProducts: lowStockAlerts.length,
        recentOrders,
        lowStockAlerts,
      });
    }
  );

  // ============================================================================
  // 3. Product Catalog Management (Manager/Admin)
  // ============================================================================

  app.get(
    '/api/v1/admin/products',
    { preHandler: [createStaffAuthPreHandler(config)] },
    async (request, reply) => {
      const { search, categoryId, isActive } = request.query as {
        search?: string;
        categoryId?: string;
        isActive?: string | boolean;
      };

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        let list = [...mockProductsList];

        if (categoryId) {
          list = list.filter((p) => p.categoryId === categoryId);
        }
        if (typeof isActive !== 'undefined') {
          const boolActive = isActive === 'true' || isActive === true;
          list = list.filter((p) => p.isActive === boolActive);
        }
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          list = list.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
        }

        const enriched = list.map((p) => {
          const stock = mockStockStore.get(p.id) || { physical: 0, reserved: 0 };
          return {
            ...p,
            physicalStock: stock.physical,
            reservedStock: stock.reserved,
            availableStock: stock.physical - stock.reserved,
            lowStockThreshold: p.lowStockThreshold || 5,
          };
        });

        return reply.send({ products: enriched });
      }

      // Live Supabase
      let query = 'products?select=id,category_id,name,slug,description,base_price,tax_rate_pct,is_veg,allergens,prep_time_minutes,image_url,is_active,categories(id,name,slug)&order=created_at.desc';
      if (categoryId) query += `&category_id=eq.${encodeURIComponent(categoryId)}`;
      if (typeof isActive !== 'undefined') {
        const boolActive = isActive === 'true' || isActive === true;
        query += `&is_active=eq.${boolActive}`;
      }

      const [productsData, inventoryData] = await Promise.all([
        supabaseRest<Array<{
          id: string;
          category_id: string;
          name: string;
          slug: string;
          description: string | null;
          base_price: number | string;
          tax_rate_pct: number | string;
          is_veg: boolean;
          allergens: string[];
          prep_time_minutes: number;
          image_url: string | null;
          is_active: boolean;
          categories?: { id: string; name: string; slug: string } | null;
        }>>(query),
        supabaseRest<Array<{ product_id: string; physical_stock: number; reserved_stock: number; low_stock_threshold: number }>>(
          'inventory?select=product_id,physical_stock,reserved_stock,low_stock_threshold'
        ),
      ]);

      const products = productsData || [];
      const invMap = new Map((inventoryData || []).map((i) => [i.product_id, i]));

      let result = products.map((row) => {
        const inv = invMap.get(row.id) || { physical_stock: 0, reserved_stock: 0, low_stock_threshold: 5 };
        return {
          id: row.id,
          categoryId: row.category_id,
          categoryName: row.categories?.name || 'General',
          categorySlug: row.categories?.slug || 'general',
          name: row.name,
          slug: row.slug,
          description: row.description,
          basePrice: typeof row.base_price === 'string' ? parseInt(row.base_price, 10) : row.base_price,
          taxRatePct: typeof row.tax_rate_pct === 'string' ? parseFloat(row.tax_rate_pct) : row.tax_rate_pct,
          isVeg: row.is_veg,
          allergens: Array.isArray(row.allergens) ? row.allergens : [],
          prepTimeMinutes: row.prep_time_minutes,
          imageUrl: row.image_url,
          isInStock: inv.physical_stock > inv.reserved_stock,
          isActive: row.is_active,
          physicalStock: inv.physical_stock,
          reservedStock: inv.reserved_stock,
          availableStock: inv.physical_stock - inv.reserved_stock,
          lowStockThreshold: inv.low_stock_threshold,
        };
      });

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        result = result.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
      }

      return reply.send({ products: result });
    }
  );

  app.post(
    '/api/v1/admin/products',
    { preHandler: [createStaffAuthPreHandler(config, ['manager', 'admin'])] },
    async (request, reply) => {
      const parseResult = AdminProductCreateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues.map((i) => i.message).join('; '),
          },
        });
      }
      const data = parseResult.data;

      // Mock/test mode:
      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const category = mockCategoriesList.find((c) => c.id === data.categoryId);
        if (!category) {
          return reply.status(400).send({
            error: {
              statusCode: 400,
              code: 'CATEGORY_NOT_FOUND',
              message: `Category with ID ${data.categoryId} does not exist.`,
            },
          });
        }

        const existingSlug = mockProductsList.find((p) => p.slug === data.slug);
        if (existingSlug) {
          return reply.status(409).send({
            error: {
              statusCode: 409,
              code: 'DUPLICATE_SLUG',
              message: `A product with slug '${data.slug}' already exists.`,
            },
          });
        }

        const newId = randomUUID();
        const newProduct: MockProductEntry = {
          id: newId,
          categoryId: category.id,
          categoryName: category.name,
          categorySlug: category.slug,
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          basePrice: data.basePrice,
          taxRatePct: data.taxRatePct,
          isVeg: data.isVeg,
          allergens: data.allergens,
          prepTimeMinutes: data.prepTimeMinutes,
          imageUrl: data.imageUrl ?? null,
          isInStock: data.initialStock > 0,
          isActive: data.isActive,
          lowStockThreshold: data.lowStockThreshold,
        };

        mockProductsList.unshift(newProduct);
        mockStockStore.set(newId, { physical: data.initialStock, reserved: 0 });

        return reply.status(201).send({
          ...newProduct,
          physicalStock: data.initialStock,
          reservedStock: 0,
          availableStock: data.initialStock,
        });
      }

      // Live Supabase path
      const existingProduct = await supabaseRest<Array<{ id: string }>>(`products?slug=eq.${encodeURIComponent(data.slug)}&select=id`);
      if (existingProduct && existingProduct.length > 0) {
        return reply.status(409).send({
          error: {
            statusCode: 409,
            code: 'DUPLICATE_SLUG',
            message: `A product with slug '${data.slug}' already exists.`,
          },
        });
      }

      const insertRes = await supabaseRest<Array<{ id: string }>>('products', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          category_id: data.categoryId,
          name: data.name,
          slug: data.slug,
          description: data.description,
          base_price: data.basePrice,
          tax_rate_pct: data.taxRatePct,
          is_veg: data.isVeg,
          allergens: data.allergens,
          prep_time_minutes: data.prepTimeMinutes,
          image_url: data.imageUrl,
          is_active: data.isActive,
        }),
      });

      if (!insertRes || insertRes.length === 0) {
        return reply.status(500).send({
          error: { statusCode: 500, code: 'PRODUCT_CREATION_FAILED', message: 'Failed to insert product record.' },
        });
      }

      const createdId = insertRes[0].id;
      // Initialize inventory row
      await supabaseRest('inventory', {
        method: 'POST',
        body: JSON.stringify({
          product_id: createdId,
          physical_stock: data.initialStock,
          reserved_stock: 0,
          low_stock_threshold: data.lowStockThreshold,
        }),
      });

      return reply.status(201).send({
        id: createdId,
        categoryId: data.categoryId,
        categoryName: 'General',
        categorySlug: 'general',
        name: data.name,
        slug: data.slug,
        description: data.description,
        basePrice: data.basePrice,
        taxRatePct: data.taxRatePct,
        isVeg: data.isVeg,
        allergens: data.allergens,
        prepTimeMinutes: data.prepTimeMinutes,
        imageUrl: data.imageUrl,
        isInStock: data.initialStock > 0,
        isActive: data.isActive,
        physicalStock: data.initialStock,
        reservedStock: 0,
        availableStock: data.initialStock,
        lowStockThreshold: data.lowStockThreshold,
      });
    }
  );

  app.put(
    '/api/v1/admin/products/:id',
    { preHandler: [createStaffAuthPreHandler(config, ['manager', 'admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = AdminProductUpdateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues.map((i) => i.message).join('; '),
          },
        });
      }
      const data = parseResult.data;

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const prod = mockProductsList.find((p) => p.id === id);
        if (!prod) {
          return reply.status(404).send({
            error: { statusCode: 404, code: 'NOT_FOUND', message: 'Product not found.' },
          });
        }

        if (data.slug && data.slug !== prod.slug) {
          const dup = mockProductsList.find((p) => p.slug === data.slug && p.id !== id);
          if (dup) {
            return reply.status(409).send({
              error: { statusCode: 409, code: 'DUPLICATE_SLUG', message: `Slug '${data.slug}' is already in use.` },
            });
          }
          prod.slug = data.slug;
        }

        if (data.categoryId) {
          const cat = mockCategoriesList.find((c) => c.id === data.categoryId);
          if (!cat) {
            return reply.status(400).send({
              error: { statusCode: 400, code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' },
            });
          }
          prod.categoryId = cat.id;
          prod.categoryName = cat.name;
          prod.categorySlug = cat.slug;
        }

        if (typeof data.name !== 'undefined') prod.name = data.name;
        if (typeof data.description !== 'undefined') prod.description = data.description;
        if (typeof data.basePrice !== 'undefined') prod.basePrice = data.basePrice;
        if (typeof data.taxRatePct !== 'undefined') prod.taxRatePct = data.taxRatePct;
        if (typeof data.isVeg !== 'undefined') prod.isVeg = data.isVeg;
        if (typeof data.allergens !== 'undefined') prod.allergens = data.allergens;
        if (typeof data.prepTimeMinutes !== 'undefined') prod.prepTimeMinutes = data.prepTimeMinutes;
        if (typeof data.imageUrl !== 'undefined') prod.imageUrl = data.imageUrl;
        if (typeof data.isActive !== 'undefined') prod.isActive = data.isActive;

        const stock = mockStockStore.get(id) || { physical: 0, reserved: 0 };
        return reply.send({
          ...prod,
          physicalStock: stock.physical,
          reservedStock: stock.reserved,
          availableStock: stock.physical - stock.reserved,
          lowStockThreshold: prod.lowStockThreshold || 5,
        });
      }

      // Live Supabase
      const updatePayload: Record<string, unknown> = {};
      if (typeof data.name !== 'undefined') updatePayload.name = data.name;
      if (typeof data.slug !== 'undefined') updatePayload.slug = data.slug;
      if (typeof data.categoryId !== 'undefined') updatePayload.category_id = data.categoryId;
      if (typeof data.description !== 'undefined') updatePayload.description = data.description;
      if (typeof data.basePrice !== 'undefined') updatePayload.base_price = data.basePrice;
      if (typeof data.taxRatePct !== 'undefined') updatePayload.tax_rate_pct = data.taxRatePct;
      if (typeof data.isVeg !== 'undefined') updatePayload.is_veg = data.isVeg;
      if (typeof data.allergens !== 'undefined') updatePayload.allergens = data.allergens;
      if (typeof data.prepTimeMinutes !== 'undefined') updatePayload.prep_time_minutes = data.prepTimeMinutes;
      if (typeof data.imageUrl !== 'undefined') updatePayload.image_url = data.imageUrl;
      if (typeof data.isActive !== 'undefined') updatePayload.is_active = data.isActive;

      const res = await supabaseRest<Array<{ id: string }>>(`products?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(updatePayload),
      });

      if (!res || res.length === 0) {
        return reply.status(404).send({
          error: { statusCode: 404, code: 'NOT_FOUND', message: 'Product not found.' },
        });
      }

      return reply.send({ success: true, id });
    }
  );

  app.patch(
    '/api/v1/admin/products/:id/status',
    { preHandler: [createStaffAuthPreHandler(config, ['manager', 'admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { isActive } = (request.body || {}) as { isActive?: boolean };
      if (typeof isActive !== 'boolean') {
        return reply.status(400).send({
          error: { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Field isActive (boolean) is required.' },
        });
      }

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const prod = mockProductsList.find((p) => p.id === id);
        if (!prod) {
          return reply.status(404).send({
            error: { statusCode: 404, code: 'NOT_FOUND', message: 'Product not found.' },
          });
        }
        prod.isActive = isActive;
        const stock = mockStockStore.get(id) || { physical: 0, reserved: 0 };
        return reply.send({
          ...prod,
          physicalStock: stock.physical,
          reservedStock: stock.reserved,
          availableStock: stock.physical - stock.reserved,
          lowStockThreshold: prod.lowStockThreshold || 5,
        });
      }

      const res = await supabaseRest(`products?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      });
      return reply.send({ success: true, id, isActive });
    }
  );

  // ============================================================================
  // 4. Category Management (Manager/Admin)
  // ============================================================================

  app.get(
    '/api/v1/admin/categories',
    { preHandler: [createStaffAuthPreHandler(config)] },
    async (request, reply) => {
      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const enriched = mockCategoriesList.map((c) => ({
          ...c,
          isActive: true,
          productCount: mockProductsList.filter((p) => p.categoryId === c.id).length,
        }));
        return reply.send({ categories: enriched });
      }

      const [categoriesData, productsData] = await Promise.all([
        supabaseRest<Array<{ id: string; name: string; slug: string; description: string | null; display_order: number; is_active: boolean }>>(
          'categories?order=display_order.asc'
        ),
        supabaseRest<Array<{ category_id: string }>>('products?select=category_id'),
      ]);

      const counts = new Map<string, number>();
      (productsData || []).forEach((p) => {
        counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1);
      });

      const categories = (categoriesData || []).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        display_order: row.display_order,
        isActive: row.is_active,
        productCount: counts.get(row.id) || 0,
      }));

      return reply.send({ categories });
    }
  );

  app.post(
    '/api/v1/admin/categories',
    { preHandler: [createStaffAuthPreHandler(config, ['manager', 'admin'])] },
    async (request, reply) => {
      const parseResult = AdminCategoryCreateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues.map((i) => i.message).join('; '),
          },
        });
      }
      const data = parseResult.data;

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const existing = mockCategoriesList.find((c) => c.slug === data.slug);
        if (existing) {
          return reply.status(409).send({
            error: { statusCode: 409, code: 'DUPLICATE_SLUG', message: `Category slug '${data.slug}' already exists.` },
          });
        }
        const newCat = {
          id: randomUUID(),
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          display_order: data.display_order ?? mockCategoriesList.length + 1,
          isActive: true,
          productCount: 0,
        };
        mockCategoriesList.push(newCat);
        return reply.status(201).send(newCat);
      }

      const res = await supabaseRest<Array<{ id: string }>>('categories', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          name: data.name,
          slug: data.slug,
          description: data.description,
          display_order: data.display_order,
          is_active: true,
        }),
      });

      if (!res || res.length === 0) {
        return reply.status(500).send({
          error: { statusCode: 500, code: 'CATEGORY_CREATION_FAILED', message: 'Failed to create category.' },
        });
      }

      return reply.status(201).send({ ...data, id: res[0].id, isActive: true, productCount: 0 });
    }
  );

  app.put(
    '/api/v1/admin/categories/:id',
    { preHandler: [createStaffAuthPreHandler(config, ['manager', 'admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = AdminCategoryUpdateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues.map((i) => i.message).join('; '),
          },
        });
      }
      const data = parseResult.data;

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const cat = mockCategoriesList.find((c) => c.id === id);
        if (!cat) {
          return reply.status(404).send({
            error: { statusCode: 404, code: 'NOT_FOUND', message: 'Category not found.' },
          });
        }
        if (data.slug && data.slug !== cat.slug) {
          const dup = mockCategoriesList.find((c) => c.slug === data.slug && c.id !== id);
          if (dup) {
            return reply.status(409).send({
              error: { statusCode: 409, code: 'DUPLICATE_SLUG', message: `Slug '${data.slug}' is already in use.` },
            });
          }
          cat.slug = data.slug;
        }
        if (data.name) cat.name = data.name;
        if (typeof data.description !== 'undefined') cat.description = data.description;
        if (typeof data.display_order !== 'undefined') cat.display_order = data.display_order;

        return reply.send({
          ...cat,
          isActive: true,
          productCount: mockProductsList.filter((p) => p.categoryId === id).length,
        });
      }

      const updateData: Record<string, unknown> = {};
      if (data.name) updateData.name = data.name;
      if (data.slug) updateData.slug = data.slug;
      if (typeof data.description !== 'undefined') updateData.description = data.description;
      if (typeof data.display_order !== 'undefined') updateData.display_order = data.display_order;
      if (typeof data.isActive !== 'undefined') updateData.is_active = data.isActive;

      await supabaseRest(`categories?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      return reply.send({ success: true, id });
    }
  );

  app.delete(
    '/api/v1/admin/categories/:id',
    { preHandler: [createStaffAuthPreHandler(config, ['manager', 'admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const prodCount = mockProductsList.filter((p) => p.categoryId === id).length;
        if (prodCount > 0) {
          return reply.status(400).send({
            error: {
              statusCode: 400,
              code: 'CATEGORY_NOT_EMPTY',
              message: `Cannot delete category: ${prodCount} products are assigned to it. Reassign or delete the products first.`,
            },
          });
        }
        const index = mockCategoriesList.findIndex((c) => c.id === id);
        if (index === -1) {
          return reply.status(404).send({
            error: { statusCode: 404, code: 'NOT_FOUND', message: 'Category not found.' },
          });
        }
        mockCategoriesList.splice(index, 1);
        return reply.send({ success: true });
      }

      // Check products in category
      const assigned = await supabaseRest<Array<{ id: string }>>(`products?category_id=eq.${encodeURIComponent(id)}&select=id`);
      if (assigned && assigned.length > 0) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'CATEGORY_NOT_EMPTY',
            message: `Cannot delete category: ${assigned.length} products are assigned to it.`,
          },
        });
      }

      await supabaseRest(`categories?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return reply.send({ success: true });
    }
  );

  // ============================================================================
  // 5. Order Management, Kanban & Handover Verification
  // ============================================================================

  app.get(
    '/api/v1/admin/orders',
    { preHandler: [createStaffAuthPreHandler(config)] },
    async (request, reply) => {
      const { status, search, limit = 50, offset = 0 } = request.query as {
        status?: Order['orderStatus'];
        search?: string;
        limit?: number;
        offset?: number;
      };

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        let list = Array.from(mockOrdersStore.values());
        if (status) {
          list = list.filter((o) => o.orderStatus === status);
        }
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          list = list.filter(
            (o) =>
              o.orderNumber.toLowerCase().includes(q) ||
              o.customerPhone.includes(q) ||
              o.customerName.toLowerCase().includes(q)
          );
        }

        const sorted = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const paginated = sorted.slice(Number(offset), Number(offset) + Number(limit));

        return reply.send({
          orders: paginated.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            customerId: o.customerId,
            customerPhone: o.customerPhone,
            customerName: o.customerName,
            fulfillmentType: o.fulfillmentType,
            scheduledPickupAt: o.scheduledPickupAt,
            estimatedPickupAt: o.estimatedPickupAt,
            orderStatus: o.orderStatus,
            paymentStatus: o.paymentStatus,
            paymentMethod: o.paymentMethod,
            subtotalAmount: o.subtotalAmount,
            taxAmount: o.taxAmount,
            packagingAmount: o.packagingAmount,
            totalAmount: o.totalAmount,
            specialNotes: o.specialNotes,
            expiresAt: o.expiresAt,
            createdAt: o.createdAt,
            items: o.items,
          })),
        });
      }

      // Live Supabase
      let query = `orders?select=id,order_number,customer_id,customer_phone,customer_name,fulfillment_type,scheduled_pickup_at,estimated_pickup_at,order_status,payment_status,payment_method,subtotal_amount,tax_amount,packaging_amount,total_amount,special_notes,expires_at,created_at,order_items(id,product_id,product_name_snapshot,unit_price_snapshot,tax_rate_snapshot,quantity,line_total)&order=created_at.desc&limit=${limit}&offset=${offset}`;
      if (status) query += `&order_status=eq.${encodeURIComponent(status)}`;

      const ordersData = await supabaseRest<Array<{
        id: string;
        order_number: string;
        customer_id: string;
        customer_phone: string;
        customer_name: string;
        fulfillment_type: Order['fulfillmentType'];
        scheduled_pickup_at: string | null;
        estimated_pickup_at: string;
        order_status: Order['orderStatus'];
        payment_status: Order['paymentStatus'];
        payment_method: Order['paymentMethod'];
        subtotal_amount: number | string;
        tax_amount: number | string;
        packaging_amount: number | string;
        total_amount: number | string;
        special_notes: string | null;
        expires_at: string | null;
        created_at: string;
        order_items?: Array<{
          id: string;
          product_id: string;
          product_name_snapshot: string;
          unit_price_snapshot: number | string;
          tax_rate_snapshot: number | string;
          quantity: number;
          line_total: number | string;
        }>;
      }>>(query);

      const mapped = (ordersData || []).map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerId: o.customer_id,
        customerPhone: o.customer_phone,
        customerName: o.customer_name || 'Guest',
        fulfillmentType: o.fulfillment_type,
        scheduledPickupAt: o.scheduled_pickup_at,
        estimatedPickupAt: o.estimated_pickup_at,
        orderStatus: o.order_status,
        paymentStatus: o.payment_status,
        paymentMethod: o.payment_method,
        subtotalAmount: Number(o.subtotal_amount),
        taxAmount: Number(o.tax_amount),
        packagingAmount: Number(o.packaging_amount),
        totalAmount: Number(o.total_amount),
        specialNotes: o.special_notes,
        expiresAt: o.expires_at,
        createdAt: o.created_at,
        items: (o.order_items || []).map((it) => ({
          id: it.id,
          productId: it.product_id,
          productNameSnapshot: it.product_name_snapshot,
          unitPriceSnapshot: Number(it.unit_price_snapshot),
          taxRateSnapshot: Number(it.tax_rate_snapshot),
          quantity: it.quantity,
          lineTotal: Number(it.line_total),
        })),
      }));

      return reply.send({ orders: mapped });
    }
  );

  app.get(
    '/api/v1/admin/orders/:id',
    { preHandler: [createStaffAuthPreHandler(config)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const order = mockOrdersStore.get(id);
        if (!order) {
          return reply.status(404).send({
            error: { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
          });
        }
        return reply.send({
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            customerPhone: order.customerPhone,
            customerName: order.customerName,
            fulfillmentType: order.fulfillmentType,
            scheduledPickupAt: order.scheduledPickupAt,
            estimatedPickupAt: order.estimatedPickupAt,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            subtotalAmount: order.subtotalAmount,
            taxAmount: order.taxAmount,
            packagingAmount: order.packagingAmount,
            totalAmount: order.totalAmount,
            specialNotes: order.specialNotes,
            expiresAt: order.expiresAt,
            createdAt: order.createdAt,
            items: order.items,
          },
        });
      }

      const rows = await supabaseRest<Array<{
        id: string;
        order_number: string;
        customer_id: string;
        customer_phone: string;
        customer_name: string;
        fulfillment_type: Order['fulfillmentType'];
        scheduled_pickup_at: string | null;
        estimated_pickup_at: string;
        order_status: Order['orderStatus'];
        payment_status: Order['paymentStatus'];
        payment_method: Order['paymentMethod'];
        subtotal_amount: number | string;
        tax_amount: number | string;
        packaging_amount: number | string;
        total_amount: number | string;
        special_notes: string | null;
        expires_at: string | null;
        created_at: string;
        order_items?: Array<{
          id: string;
          product_id: string;
          product_name_snapshot: string;
          unit_price_snapshot: number | string;
          tax_rate_snapshot: number | string;
          quantity: number;
          line_total: number | string;
        }>;
      }>>(`orders?id=eq.${encodeURIComponent(id)}&select=id,order_number,customer_id,customer_phone,customer_name,fulfillment_type,scheduled_pickup_at,estimated_pickup_at,order_status,payment_status,payment_method,subtotal_amount,tax_amount,packaging_amount,total_amount,special_notes,expires_at,created_at,order_items(id,product_id,product_name_snapshot,unit_price_snapshot,tax_rate_snapshot,quantity,line_total)`);

      if (!rows || rows.length === 0) {
        return reply.status(404).send({
          error: { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
        });
      }

      const o = rows[0];
      return reply.send({
        order: {
          id: o.id,
          orderNumber: o.order_number,
          customerId: o.customer_id,
          customerPhone: o.customer_phone,
          customerName: o.customer_name || 'Guest',
          fulfillmentType: o.fulfillment_type,
          scheduledPickupAt: o.scheduled_pickup_at,
          estimatedPickupAt: o.estimated_pickup_at,
          orderStatus: o.order_status,
          paymentStatus: o.payment_status,
          paymentMethod: o.payment_method,
          subtotalAmount: Number(o.subtotal_amount),
          taxAmount: Number(o.tax_amount),
          packagingAmount: Number(o.packaging_amount),
          totalAmount: Number(o.total_amount),
          specialNotes: o.special_notes,
          expiresAt: o.expires_at,
          createdAt: o.created_at,
          items: (o.order_items || []).map((it) => ({
            id: it.id,
            productId: it.product_id,
            productNameSnapshot: it.product_name_snapshot,
            unitPriceSnapshot: Number(it.unit_price_snapshot),
            taxRateSnapshot: Number(it.tax_rate_snapshot),
            quantity: it.quantity,
            lineTotal: Number(it.line_total),
          })),
        },
      });
    }
  );

  app.patch(
    '/api/v1/admin/orders/:id/status',
    { preHandler: [createStaffAuthPreHandler(config)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = AdminOrderStatusUpdateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues.map((i) => i.message).join('; '),
          },
        });
      }
      const { status: targetStatus } = parseResult.data;

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const order = mockOrdersStore.get(id);
        if (!order) {
          return reply.status(404).send({
            error: { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
          });
        }

        // Validate strictly allowed linear transitions
        const current = order.orderStatus;
        const isValid =
          (current === 'confirmed' && targetStatus === 'preparing') ||
          (current === 'preparing' && targetStatus === 'ready_for_pickup');

        if (!isValid) {
          return reply.status(400).send({
            error: {
              statusCode: 400,
              code: 'INVALID_ORDER_TRANSITION',
              message: `Cannot transition order from status '${current}' to '${targetStatus}'.`,
            },
          });
        }

        order.orderStatus = targetStatus;
        return reply.send({ order });
      }

      // Live Supabase
      const orderRows = await supabaseRest<Array<{ order_status: Order['orderStatus'] }>>(`orders?id=eq.${encodeURIComponent(id)}&select=order_status`);
      if (!orderRows || orderRows.length === 0) {
        return reply.status(404).send({
          error: { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
        });
      }
      const current = orderRows[0].order_status;
      const isValid =
        (current === 'confirmed' && targetStatus === 'preparing') ||
        (current === 'preparing' && targetStatus === 'ready_for_pickup');

      if (!isValid) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'INVALID_ORDER_TRANSITION',
            message: `Cannot transition order from status '${current}' to '${targetStatus}'.`,
          },
        });
      }

      await supabaseRest(`orders?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ order_status: targetStatus, updated_at: new Date().toISOString() }),
      });

      return reply.send({ success: true, orderStatus: targetStatus });
    }
  );

  app.post(
    '/api/v1/admin/orders/:id/handover',
    { preHandler: [createStaffAuthPreHandler(config)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const staffUser = request.user!;
      const parseResult = AdminOrderHandoverSchema.safeParse(request.body || {});
      const cashCollected = parseResult.success ? parseResult.data.cashCollected : false;

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const order = mockOrdersStore.get(id);
        if (!order) {
          return reply.status(404).send({
            error: { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
          });
        }

        if (order.orderStatus === 'completed') {
          return reply.status(409).send({
            error: {
              statusCode: 409,
              code: 'ORDER_ALREADY_COMPLETED',
              message: `Order ${order.orderNumber} is already completed.`,
            },
          });
        }

        if (order.orderStatus !== 'ready_for_pickup') {
          return reply.status(400).send({
            error: {
              statusCode: 400,
              code: 'ORDER_NOT_READY',
              message: `Order must be in 'ready_for_pickup' status before handover. Current: ${order.orderStatus}`,
            },
          });
        }

        // Cash verification assertion
        if (order.paymentMethod === 'cash_at_pickup') {
          if (!cashCollected) {
            return reply.status(400).send({
              error: {
                statusCode: 400,
                code: 'CASH_NOT_COLLECTED',
                message: 'Staff must confirm physical receipt of cash before completing handover.',
              },
            });
          }
          order.paymentStatus = 'captured';
        } else {
          if (order.paymentStatus !== 'captured') {
            return reply.status(400).send({
              error: {
                statusCode: 400,
                code: 'PAYMENT_NOT_CAPTURED',
                message: `Cannot complete handover: online payment status is '${order.paymentStatus}', expected 'captured'.`,
              },
            });
          }
        }

        // Atomically decrement physical stock and release reserved stock
        for (const item of order.items) {
          const stock = mockStockStore.get(item.productId) || { physical: 50, reserved: 0 };
          stock.physical = Math.max(0, stock.physical - item.quantity);
          stock.reserved = Math.max(0, stock.reserved - item.quantity);
          mockStockStore.set(item.productId, stock);
        }

        order.orderStatus = 'completed';
        return reply.send({ order });
      }

      // In Live Supabase: call security-definer RPC `rpc_complete_order_handover`
      const { data, error } = await supabaseRpc<boolean>('rpc_complete_order_handover', {
        p_order_id: id,
        p_staff_id: staffUser.id,
        p_cash_collected: cashCollected,
      });

      if (error) {
        const isConflict = error.includes('already completed');
        return reply.status(isConflict ? 409 : 400).send({
          error: {
            statusCode: isConflict ? 409 : 400,
            code: isConflict ? 'ORDER_ALREADY_COMPLETED' : 'HANDOVER_FAILED',
            message: error,
          },
        });
      }

      return reply.send({ success: true, orderId: id, orderStatus: 'completed' });
    }
  );

  app.post(
    '/api/v1/admin/orders/:id/cancel',
    { preHandler: [createStaffAuthPreHandler(config, ['manager', 'admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const staffUser = request.user!;
      const parseResult = AdminOrderCancelSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues.map((i) => i.message).join('; '),
          },
        });
      }
      const { reason } = parseResult.data;

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const order = mockOrdersStore.get(id);
        if (!order) {
          return reply.status(404).send({
            error: { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
          });
        }

        if (order.orderStatus === 'completed') {
          return reply.status(400).send({
            error: {
              statusCode: 400,
              code: 'CANNOT_CANCEL_COMPLETED_ORDER',
              message: 'Order is already completed and cannot be cancelled.',
            },
          });
        }

        // Release reserved stock
        if (['draft', 'confirmed', 'preparing', 'ready_for_pickup'].includes(order.orderStatus)) {
          for (const item of order.items) {
            const stock = mockStockStore.get(item.productId) || { physical: 50, reserved: 0 };
            stock.reserved = Math.max(0, stock.reserved - item.quantity);
            mockStockStore.set(item.productId, stock);
          }
        }

        order.orderStatus = reason.includes('damaged') ? 'cancelled_damaged_stock' : 'cancelled_by_staff';
        return reply.send({ order });
      }

      // Call database procedure rpc_cancel_order_by_staff
      const { error } = await supabaseRpc<boolean>('rpc_cancel_order_by_staff', {
        p_order_id: id,
        p_staff_id: staffUser.id,
        p_reason: reason,
      });

      if (error) {
        return reply.status(400).send({
          error: { statusCode: 400, code: 'CANCELLATION_FAILED', message: error },
        });
      }

      return reply.send({ success: true, orderId: id, orderStatus: 'cancelled_by_staff' });
    }
  );

  // ============================================================================
  // 6. Inventory Operations & Protected Write-Off
  // ============================================================================

  app.get(
    '/api/v1/admin/inventory',
    { preHandler: [createStaffAuthPreHandler(config)] },
    async (request, reply) => {
      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const inventory = mockProductsList.map((p) => {
          const stock = mockStockStore.get(p.id) || { physical: 0, reserved: 0 };
          const avail = stock.physical - stock.reserved;
          const thresh = p.lowStockThreshold || 5;
          return {
            productId: p.id,
            productName: p.name,
            productSlug: p.slug,
            categoryName: p.categoryName,
            physicalStock: stock.physical,
            reservedStock: stock.reserved,
            availableStock: avail,
            lowStockThreshold: thresh,
            isLowStock: avail <= thresh,
            lastRestockedAt: new Date().toISOString(),
          };
        });
        return reply.send({ inventory });
      }

      const [productsData, inventoryData] = await Promise.all([
        supabaseRest<Array<{ id: string; name: string; slug: string; categories?: { name: string } | null }>>(
          'products?select=id,name,slug,categories(name)&order=created_at.desc'
        ),
        supabaseRest<Array<{ product_id: string; physical_stock: number; reserved_stock: number; low_stock_threshold: number; last_restocked_at: string | null }>>(
          'inventory?select=product_id,physical_stock,reserved_stock,low_stock_threshold,last_restocked_at'
        ),
      ]);

      const products = productsData || [];
      const invMap = new Map((inventoryData || []).map((i) => [i.product_id, i]));

      const inventory = products.map((p) => {
        const inv = invMap.get(p.id) || {
          physical_stock: 0,
          reserved_stock: 0,
          low_stock_threshold: 5,
          last_restocked_at: null,
        };
        const avail = inv.physical_stock - inv.reserved_stock;
        return {
          productId: p.id,
          productName: p.name,
          productSlug: p.slug,
          categoryName: p.categories?.name || 'General',
          physicalStock: inv.physical_stock,
          reservedStock: inv.reserved_stock,
          availableStock: avail,
          lowStockThreshold: inv.low_stock_threshold,
          isLowStock: avail <= inv.low_stock_threshold,
          lastRestockedAt: inv.last_restocked_at,
        };
      });

      return reply.send({ inventory });
    }
  );

  app.post(
    '/api/v1/admin/inventory/write-off',
    { preHandler: [createStaffAuthPreHandler(config, ['manager', 'admin'])] },
    async (request, reply) => {
      const staffUser = request.user!;
      const parseResult = AdminInventoryWriteOffSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues.map((i) => i.message).join('; '),
          },
        });
      }
      const { productId, damagedQuantity, reason } = parseResult.data;

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const stock = mockStockStore.get(productId);
        if (!stock) {
          return reply.status(404).send({
            error: { statusCode: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product inventory not found.' },
          });
        }

        const unreserved = stock.physical - stock.reserved;
        // Strictly defend physical_stock >= reserved_stock
        if (damagedQuantity > unreserved) {
          return reply.status(409).send({
            error: {
              statusCode: 409,
              code: 'INVENTORY_WRITE_OFF_BLOCKED',
              message: `INVENTORY_WRITE_OFF_BLOCKED: Damaged quantity (${damagedQuantity}) exceeds unreserved stock (${unreserved}). Active customer reservations are impacted. A manager must explicitly cancel and refund affected orders before this stock can be written off.`,
            },
          });
        }

        stock.physical -= damagedQuantity;
        mockStockStore.set(productId, stock);

        return reply.send({
          physicalStock: stock.physical,
          reservedStock: stock.reserved,
          availableStock: stock.physical - stock.reserved,
        });
      }

      // Call database procedure rpc_write_off_inventory
      const { data, error } = await supabaseRpc<Array<{
        out_physical_stock: number;
        out_reserved_stock: number;
        out_available_stock: number;
      }>>('rpc_write_off_inventory', {
        p_product_id: productId,
        p_damaged_quantity: damagedQuantity,
        p_staff_id: staffUser.id,
        p_reason: reason,
      });

      if (error) {
        const isBlocked = error.includes('INVENTORY_WRITE_OFF_BLOCKED');
        return reply.status(isBlocked ? 409 : 400).send({
          error: {
            statusCode: isBlocked ? 409 : 400,
            code: isBlocked ? 'INVENTORY_WRITE_OFF_BLOCKED' : 'WRITE_OFF_FAILED',
            message: error,
          },
        });
      }

      const resRow = data && data.length > 0 ? data[0] : null;
      return reply.send({
        physicalStock: resRow?.out_physical_stock ?? 0,
        reservedStock: resRow?.out_reserved_stock ?? 0,
        availableStock: resRow?.out_available_stock ?? 0,
      });
    }
  );

  app.post(
    '/api/v1/admin/inventory/adjust',
    { preHandler: [createStaffAuthPreHandler(config, ['manager', 'admin'])] },
    async (request, reply) => {
      const parseResult = AdminInventoryAdjustSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues.map((i) => i.message).join('; '),
          },
        });
      }
      const { productId, physicalStockDelta, reason } = parseResult.data;

      if (config.NODE_ENV !== 'production' && (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test')) {
        const stock = mockStockStore.get(productId);
        if (!stock) {
          return reply.status(404).send({
            error: { statusCode: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product inventory not found.' },
          });
        }

        const newPhysical = stock.physical + physicalStockDelta;
        if (newPhysical < stock.reserved || newPhysical < 0) {
          return reply.status(400).send({
            error: {
              statusCode: 400,
              code: 'INVALID_STOCK_ADJUSTMENT',
              message: `Stock adjustment would violate physical stock (${newPhysical}) >= reserved stock (${stock.reserved}) constraint.`,
            },
          });
        }

        stock.physical = newPhysical;
        mockStockStore.set(productId, stock);

        const prod = mockProductsList.find((p) => p.id === productId);
        return reply.send({
          productId,
          productName: prod?.name || 'Product',
          productSlug: prod?.slug || 'product',
          categoryName: prod?.categoryName || 'General',
          physicalStock: stock.physical,
          reservedStock: stock.reserved,
          availableStock: stock.physical - stock.reserved,
          lowStockThreshold: prod?.lowStockThreshold || 5,
          isLowStock: stock.physical - stock.reserved <= (prod?.lowStockThreshold || 5),
          lastRestockedAt: new Date().toISOString(),
        });
      }

      // Live Supabase
      const invRows = await supabaseRest<Array<{ physical_stock: number; reserved_stock: number; low_stock_threshold: number }>>(
        `inventory?product_id=eq.${encodeURIComponent(productId)}`
      );
      if (!invRows || invRows.length === 0) {
        return reply.status(404).send({
          error: { statusCode: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' },
        });
      }
      const inv = invRows[0];
      const newPhysical = inv.physical_stock + physicalStockDelta;
      if (newPhysical < inv.reserved_stock || newPhysical < 0) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'INVALID_STOCK_ADJUSTMENT',
            message: `Stock adjustment would violate physical stock (${newPhysical}) >= reserved stock (${inv.reserved_stock}) constraint.`,
          },
        });
      }

      await supabaseRest(`inventory?product_id=eq.${encodeURIComponent(productId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ physical_stock: newPhysical, updated_at: new Date().toISOString() }),
      });

      return reply.send({ success: true, productId, newPhysicalStock: newPhysical });
    }
  );
};

