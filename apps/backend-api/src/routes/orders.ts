import type { FastifyPluginAsync } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import {
  API_VERSION_PREFIX,
  ValidateCartRequestSchema,
  CheckoutRequestSchema,
  type Order,
  type OrderItem,
  type CheckoutResponse,
  type ValidateCartResponse,
  type CartValidationItem,
} from '@orange/api-contracts';
import { type AppConfig } from '../config/env.js';
import { createAuthPreHandler } from '../plugins/auth.js';
import { CANONICAL_PRODUCTS } from './catalog.js';

interface OrdersPluginOptions {
  config: AppConfig;
}

interface SupabaseOrderItemRow {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  unit_price_snapshot: number | string;
  tax_rate_snapshot: number | string;
  quantity: number | string;
  line_total: number | string;
}

interface SupabaseOrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  customer_phone: string;
  customer_name?: string | null;
  fulfillment_type: Order['fulfillmentType'];
  scheduled_pickup_at?: string | null;
  estimated_pickup_at?: string | null;
  order_status: Order['orderStatus'];
  payment_status: Order['paymentStatus'];
  payment_method: Order['paymentMethod'];
  subtotal_amount: number | string;
  tax_amount: number | string;
  packaging_amount: number | string;
  total_amount: number | string;
  special_notes?: string | null;
  expires_at?: string | null;
  created_at: string;
  order_items?: SupabaseOrderItemRow[];
}

interface SupabaseRpcError {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

interface StoredMockOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerPhone: string;
  customerName: string;
  fulfillmentType: 'immediate' | 'scheduled';
  scheduledPickupAt: string | null;
  estimatedPickupAt: string;
  orderStatus: Order['orderStatus'];
  paymentStatus: Order['paymentStatus'];
  paymentMethod: Order['paymentMethod'];
  subtotalAmount: number;
  taxAmount: number;
  packagingAmount: number;
  totalAmount: number;
  providerOrderId?: string | null;
  specialNotes?: string | null;
  expiresAt: string | null;
  createdAt: string;
  idempotencyKey?: string;
  payloadHash?: string;
  items: OrderItem[];
}

import { mockStockStore, type MockStockRecord } from '../services/inventoryStore.js';
export { mockStockStore, type MockStockRecord } from '../services/inventoryStore.js';

// In-memory order & idempotency storage for test/mock service mode
export const mockOrdersStore = new Map<string, StoredMockOrder>();

// Initialize mock inventory from CANONICAL_PRODUCTS
CANONICAL_PRODUCTS.forEach((p) => {
  mockStockStore.set(p.id, { physical: 50, reserved: 0 });
});

export function resetMockOrderStore(): void {
  mockOrdersStore.clear();
  CANONICAL_PRODUCTS.forEach((p) => {
    mockStockStore.set(p.id, { physical: 50, reserved: 0 });
  });
}

function computePayloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export const ordersRoutes: FastifyPluginAsync<OrdersPluginOptions> = async (app, options) => {
  const config = options.config;
  const requireAuth = createAuthPreHandler(config);

  // POST /api/v1/orders/validate-cart (Public, revalidates prices and availability)
  app.post(`${API_VERSION_PREFIX}/orders/validate-cart`, async (request, reply) => {
    const parseResult = ValidateCartRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Invalid cart validation request.',
          details: parseResult.error.issues,
        },
      });
    }

    const { items: requestedItems } = parseResult.data;

    let subtotalAmount = 0;
    let taxAmount = 0;
    const packagingAmount = 0;
    let hasOutOfStockItems = false;
    const validatedItems: CartValidationItem[] = [];

    // Aggregate duplicate line items
    const aggregated = new Map<string, number>();
    for (const item of requestedItems) {
      aggregated.set(item.productId, (aggregated.get(item.productId) || 0) + item.quantity);
    }

    // Try fetching products from database
    const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
    const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY || '';

    const productsMap = new Map<string, { name: string; basePrice: number; taxRatePct: number; inStock: boolean; availableStock: number }>();

    try {
      const productIds = Array.from(aggregated.keys()).map((id) => `"${id}"`).join(',');
      const res = await fetch(
        `${baseUrl}/rest/v1/products?id=in.(${productIds})&is_active=eq.true&select=id,name,base_price,tax_rate_pct`,
        {
          headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        }
      );

      if (res.ok) {
        const dbProducts = (await res.json()) as Array<{
          id: string;
          name: string;
          base_price: number | string;
          tax_rate_pct: number | string;
        }>;

        // Fetch inventory
        const invRes = await fetch(
          `${baseUrl}/rest/v1/inventory?product_id=in.(${productIds})&select=product_id,physical_stock,reserved_stock`,
          {
            headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
          }
        );

        const invMap = new Map<string, number>();
        if (invRes.ok) {
          const invRows = (await invRes.json()) as Array<{
            product_id: string;
            physical_stock: number;
            reserved_stock: number;
          }>;
          for (const inv of invRows) {
            invMap.set(inv.product_id, Math.max(0, inv.physical_stock - inv.reserved_stock));
          }
        }

        for (const p of dbProducts) {
          const available = invMap.get(p.id) ?? 10;
          productsMap.set(p.id, {
            name: p.name,
            basePrice: Number(p.base_price),
            taxRatePct: Number(p.tax_rate_pct),
            inStock: available > 0,
            availableStock: available,
          });
        }
      }
    } catch {
      // In dev or test mock fallback
    }

    // Fill missing from canonical fallback if ALLOW_MOCK_SERVICES
    if (config.ALLOW_MOCK_SERVICES) {
      for (const p of CANONICAL_PRODUCTS) {
        if (!productsMap.has(p.id)) {
          const stock = mockStockStore.get(p.id) || { physical: 50, reserved: 0 };
          const available = Math.max(0, stock.physical - stock.reserved);
          productsMap.set(p.id, {
            name: p.name,
            basePrice: p.basePrice,
            taxRatePct: p.taxRatePct,
            inStock: available > 0,
            availableStock: available,
          });
        }
      }
    }

    for (const [productId, quantity] of aggregated.entries()) {
      const product = productsMap.get(productId);
      if (!product) {
        hasOutOfStockItems = true;
        validatedItems.push({
          productId,
          productName: 'Unknown Product',
          basePrice: 0,
          taxRatePct: 0,
          quantity,
          lineTotal: 0,
          isInStock: false,
          availableStock: 0,
        });
        continue;
      }

      const available = product.availableStock;
      const isAvailable = available >= quantity;
      if (!isAvailable) {
        hasOutOfStockItems = true;
      }

      const lineTotal = product.basePrice * quantity;
      const itemTax = Math.round((lineTotal * product.taxRatePct) / 100);

      subtotalAmount += lineTotal;
      taxAmount += itemTax;

      validatedItems.push({
        productId,
        productName: product.name,
        basePrice: product.basePrice,
        taxRatePct: product.taxRatePct,
        quantity,
        lineTotal,
        isInStock: isAvailable,
        availableStock: available,
      });
    }

    const totalAmount = subtotalAmount + taxAmount + packagingAmount;

    const response: ValidateCartResponse = {
      isValid: !hasOutOfStockItems && validatedItems.length > 0,
      items: validatedItems,
      subtotalAmount,
      taxAmount,
      packagingAmount,
      totalAmount,
      hasOutOfStockItems,
    };

    return reply.status(200).send(response);
  });

  // POST /api/v1/orders/checkout (Protected, atomic inventory reservation)
  app.post(
    `${API_VERSION_PREFIX}/orders/checkout`,
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const parseResult = CheckoutRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Invalid checkout request body.',
            details: parseResult.error.issues,
          },
        });
      }

      const checkoutData = parseResult.data;

      // Mandate client idempotency key (X-Idempotency-Key or Idempotency-Key header)
      const rawIdempKey =
        (request.headers['x-idempotency-key'] as string) ||
        (request.headers['idempotency-key'] as string);

      if (!rawIdempKey || typeof rawIdempKey !== 'string' || !rawIdempKey.trim()) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'MISSING_IDEMPOTENCY_KEY',
            message: 'An X-Idempotency-Key header is required for checkout requests to prevent duplicate submissions.',
          },
        });
      }

      const idempotencyKey = rawIdempKey.trim();
      if (idempotencyKey.length > 128 || !/^[\w-]+$/.test(idempotencyKey)) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'INVALID_IDEMPOTENCY_KEY',
            message: 'Idempotency key must be between 1 and 128 alphanumeric characters, hyphens, or underscores.',
          },
        });
      }

      // Canonical payload hash over deterministically sorted items and contact details
      const sortedItems = [...checkoutData.items].sort((a, b) =>
        a.productId.localeCompare(b.productId)
      );

      const payloadHash = computePayloadHash({
        items: sortedItems,
        fulfillment: checkoutData.fulfillment,
        scheduledPickupAt: checkoutData.scheduledPickupAt || null,
        paymentMethod: checkoutData.paymentMethod,
        customerName: checkoutData.customerName || null,
        specialNotes: checkoutData.specialNotes || null,
      });

      // Validate scheduled pickup time if scheduled
      if (checkoutData.fulfillment === 'scheduled') {
        if (!checkoutData.scheduledPickupAt) {
          return reply.status(400).send({
            error: {
              statusCode: 400,
              code: 'INVALID_SCHEDULE',
              message: 'Scheduled pickup time is required for scheduled orders.',
            },
          });
        }
        const pickupDate = new Date(checkoutData.scheduledPickupAt);
        if (isNaN(pickupDate.getTime()) || pickupDate.getTime() <= Date.now()) {
          return reply.status(400).send({
            error: {
              statusCode: 400,
              code: 'INVALID_SCHEDULE',
              message: 'Scheduled pickup time must be in the future.',
            },
          });
        }
      }

      // Try PostgreSQL RPC rpc_reserve_order_stock via Supabase
      const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
      const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || '';

      if (apiKey && !config.ALLOW_MOCK_SERVICES) {
        try {
          const rpcRes = await fetch(`${baseUrl}/rest/v1/rpc/rpc_reserve_order_stock`, {
            method: 'POST',
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              p_customer_id: user.id,
              p_customer_phone: user.phone || checkoutData.customerPhone,
              p_customer_name: checkoutData.customerName || user.fullName || 'Valued Customer',
              p_items: checkoutData.items.map((i) => ({
                product_id: i.productId,
                quantity: i.quantity,
              })),
              p_fulfillment: checkoutData.fulfillment,
              p_scheduled_pickup:
                checkoutData.fulfillment === 'scheduled' ? checkoutData.scheduledPickupAt || null : null,
              p_payment_method: checkoutData.paymentMethod,
              p_idempotency_key: idempotencyKey,
              p_payload_hash: payloadHash,
              p_special_notes: checkoutData.specialNotes || null,
            }),
          });

          const rpcJson = (await rpcRes.json().catch(() => null)) as SupabaseRpcError | null;

          if (!rpcRes.ok) {
            const errorMsg = rpcJson?.message || '';

            if (errorMsg.includes('Insufficient stock')) {
              return reply.status(422).send({
                error: {
                  statusCode: 422,
                  code: 'INSUFFICIENT_STOCK',
                  message: errorMsg,
                },
              });
            }

            if (errorMsg.includes('mismatched order payload')) {
              return reply.status(409).send({
                error: {
                  statusCode: 409,
                  code: 'IDEMPOTENCY_CONFLICT',
                  message: 'Idempotency key reused with mismatched order payload.',
                },
              });
            }

            if (errorMsg.includes('belongs to a different customer')) {
              return reply.status(403).send({
                error: {
                  statusCode: 403,
                  code: 'IDEMPOTENCY_OWNERSHIP_MISMATCH',
                  message: 'Idempotency key belongs to a different customer.',
                },
              });
            }

            return reply.status(400).send({
              error: {
                statusCode: 400,
                code: 'CHECKOUT_FAILED',
                message: errorMsg || 'Stock reservation failed.',
              },
            });
          }

          // Successful RPC returns TABLE (out_order_id, out_order_number, out_total_amount, out_expires_at, out_order_status, out_payment_status)
          const resultRow = Array.isArray(rpcJson) ? rpcJson[0] : rpcJson;
          if (!resultRow || !resultRow.out_order_id) {
            request.log.error({ rpcJson }, 'Supabase RPC returned invalid row structure');
            return reply.status(500).send({
              error: {
                statusCode: 500,
                code: 'CHECKOUT_FAILED',
                message: 'Database did not return a valid order confirmation.',
              },
            });
          }

          const checkoutResponse: CheckoutResponse = {
            orderId: resultRow.out_order_id,
            orderNumber: resultRow.out_order_number,
            orderStatus: resultRow.out_order_status,
            paymentStatus: resultRow.out_payment_status,
            totalAmount: Number(resultRow.out_total_amount),
            currency: 'INR',
            expiresAt: resultRow.out_expires_at,
            estimatedPickupAt: checkoutData.scheduledPickupAt || null,
          };

          return reply.status(201).send(checkoutResponse);
        } catch (err) {
          request.log.error(err, 'Supabase RPC call failed');
          return reply.status(503).send({
            error: {
              statusCode: 503,
              code: 'DATABASE_UNAVAILABLE',
              message: 'Order reservation service is temporarily unreachable.',
            },
          });
        }
      }

      // Mock / Dev service mode implementation (authoritative business logic simulation)
      if (config.ALLOW_MOCK_SERVICES) {
        // Check idempotency in mock
        if (idempotencyKey) {
          for (const existing of mockOrdersStore.values()) {
            if (existing.idempotencyKey === idempotencyKey) {
              if (existing.customerId !== user.id) {
                return reply.status(403).send({
                  error: {
                    statusCode: 403,
                    code: 'IDEMPOTENCY_OWNERSHIP_MISMATCH',
                    message: `Idempotency key ${idempotencyKey} belongs to a different customer.`,
                  },
                });
              }
              if (existing.payloadHash !== payloadHash) {
                return reply.status(409).send({
                  error: {
                    statusCode: 409,
                    code: 'IDEMPOTENCY_CONFLICT',
                    message: 'Idempotency key reused with mismatched order payload.',
                  },
                });
              }

              // Return existing order representation
              const checkoutResponse: CheckoutResponse = {
                orderId: existing.id,
                orderNumber: existing.orderNumber,
                orderStatus: existing.orderStatus,
                paymentStatus: existing.paymentStatus,
                totalAmount: existing.totalAmount,
                currency: 'INR',
                expiresAt: existing.expiresAt,
                estimatedPickupAt: existing.estimatedPickupAt,
              };
              return reply.status(200).send(checkoutResponse);
            }
          }
        }

        // Aggregate items
        const aggregated = new Map<string, number>();
        for (const item of checkoutData.items) {
          aggregated.set(item.productId, (aggregated.get(item.productId) || 0) + item.quantity);
        }

        // Verify stock for all items first
        for (const [productId, qty] of aggregated.entries()) {
          const product = CANONICAL_PRODUCTS.find((p) => p.id === productId);
          if (!product) {
            return reply.status(400).send({
              error: {
                statusCode: 400,
                code: 'INVALID_PRODUCT',
                message: `Product ${productId} is invalid or inactive.`,
              },
            });
          }

          const stock = mockStockStore.get(productId) || { physical: 0, reserved: 0 };
          const available = stock.physical - stock.reserved;
          if (available < qty) {
            return reply.status(422).send({
              error: {
                statusCode: 422,
                code: 'INSUFFICIENT_STOCK',
                message: `Insufficient stock for product "${product.name}". Requested: ${qty}, Available: ${available}`,
              },
            });
          }
        }

        // Allocate stock atomically
        let subtotal = 0;
        let tax = 0;
        const snapshotItems: OrderItem[] = [];

        for (const [productId, qty] of aggregated.entries()) {
          const product = CANONICAL_PRODUCTS.find((p) => p.id === productId)!;
          const stock = mockStockStore.get(productId)!;
          stock.reserved += qty;

          const lineTotal = product.basePrice * qty;
          const itemTax = Math.round((lineTotal * product.taxRatePct) / 100);
          subtotal += lineTotal;
          tax += itemTax;

          snapshotItems.push({
            id: randomUUID(),
            productId,
            productNameSnapshot: product.name,
            unitPriceSnapshot: product.basePrice,
            taxRateSnapshot: product.taxRatePct,
            quantity: qty,
            lineTotal,
          });
        }

        const grandTotal = subtotal + tax;
        const orderId = randomUUID();
        const orderNumber = `MO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

        const isCash = checkoutData.paymentMethod === 'cash_at_pickup';
        const orderStatus: Order['orderStatus'] = isCash ? 'confirmed' : 'draft';
        const paymentStatus: Order['paymentStatus'] = isCash ? 'unpaid' : 'pending';
        const expiresAt = isCash ? null : new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const estimatedPickupAt =
          checkoutData.scheduledPickupAt ||
          new Date(Date.now() + 20 * 60 * 1000).toISOString();

        const storedOrder: StoredMockOrder = {
          id: orderId,
          orderNumber,
          customerId: user.id,
          customerPhone: user.phone,
          customerName: checkoutData.customerName,
          fulfillmentType: checkoutData.fulfillment,
          scheduledPickupAt: checkoutData.scheduledPickupAt || null,
          estimatedPickupAt,
          orderStatus,
          paymentStatus,
          paymentMethod: checkoutData.paymentMethod,
          subtotalAmount: subtotal,
          taxAmount: tax,
          packagingAmount: 0,
          totalAmount: grandTotal,
          specialNotes: checkoutData.specialNotes || null,
          expiresAt,
          createdAt: new Date().toISOString(),
          idempotencyKey: idempotencyKey || undefined,
          payloadHash,
          items: snapshotItems,
        };

        mockOrdersStore.set(orderId, storedOrder);

        const checkoutResponse: CheckoutResponse = {
          orderId,
          orderNumber,
          orderStatus,
          paymentStatus,
          totalAmount: grandTotal,
          currency: 'INR',
          expiresAt,
          estimatedPickupAt,
        };

        return reply.status(201).send(checkoutResponse);
      }

      return reply.status(503).send({
        error: {
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          message: 'Unable to connect to order reservation service.',
        },
      });
    }
  );

  // GET /api/v1/orders (Protected, list customer's orders)
  app.get(
    `${API_VERSION_PREFIX}/orders`,
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;

      if (config.ALLOW_MOCK_SERVICES) {
        const customerOrders = Array.from(mockOrdersStore.values())
          .filter((o) => o.customerId === user.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((o): Order => ({
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
          }));

        return reply.status(200).send({ orders: customerOrders });
      }

      const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
      const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY || '';
      const url = `${baseUrl}/rest/v1/orders?customer_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&select=*,order_items(*)`;

      try {
        const res = await fetch(url, {
          headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        });

        if (res.ok) {
          const rows = (await res.json()) as SupabaseOrderRow[];
          const orders: Order[] = rows.map((r) => ({
            id: r.id,
            orderNumber: r.order_number,
            customerId: r.customer_id,
            customerPhone: r.customer_phone,
            customerName: r.customer_name || 'Boutique Guest',
            fulfillmentType: r.fulfillment_type,
            scheduledPickupAt: r.scheduled_pickup_at,
            estimatedPickupAt: r.estimated_pickup_at || r.created_at,
            orderStatus: r.order_status,
            paymentStatus: r.payment_status,
            paymentMethod: r.payment_method,
            subtotalAmount: Number(r.subtotal_amount),
            taxAmount: Number(r.tax_amount),
            packagingAmount: Number(r.packaging_amount),
            totalAmount: Number(r.total_amount),
            specialNotes: r.special_notes,
            expiresAt: r.expires_at,
            createdAt: r.created_at,
            items: (r.order_items || []).map((item) => ({
              id: item.id,
              productId: item.product_id,
              productNameSnapshot: item.product_name_snapshot,
              unitPriceSnapshot: Number(item.unit_price_snapshot),
              taxRateSnapshot: Number(item.tax_rate_snapshot),
              quantity: Number(item.quantity),
              lineTotal: Number(item.line_total),
            })),
          }));

          return reply.status(200).send({ orders });
        }
      } catch {
        // Fall through
      }

      return reply.status(200).send({ orders: [] });
    }
  );

  // GET /api/v1/orders/:id (Protected, single order with ownership enforcement)
  app.get(
    `${API_VERSION_PREFIX}/orders/:id`,
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      if (config.ALLOW_MOCK_SERVICES) {
        const stored = mockOrdersStore.get(id);
        if (!stored) {
          return reply.status(404).send({
            error: {
              statusCode: 404,
              code: 'ORDER_NOT_FOUND',
              message: `Order ${id} not found.`,
            },
          });
        }

        // CRITICAL OWNERSHIP CHECK: Cross-customer access prevention
        if (stored.customerId !== user.id) {
          return reply.status(403).send({
            error: {
              statusCode: 403,
              code: 'FORBIDDEN_ORDER_ACCESS',
              message: 'You do not have permission to view this order.',
            },
          });
        }

        const order: Order = {
          id: stored.id,
          orderNumber: stored.orderNumber,
          customerId: stored.customerId,
          customerPhone: stored.customerPhone,
          customerName: stored.customerName,
          fulfillmentType: stored.fulfillmentType,
          scheduledPickupAt: stored.scheduledPickupAt,
          estimatedPickupAt: stored.estimatedPickupAt,
          orderStatus: stored.orderStatus,
          paymentStatus: stored.paymentStatus,
          paymentMethod: stored.paymentMethod,
          subtotalAmount: stored.subtotalAmount,
          taxAmount: stored.taxAmount,
          packagingAmount: stored.packagingAmount,
          totalAmount: stored.totalAmount,
          specialNotes: stored.specialNotes,
          expiresAt: stored.expiresAt,
          createdAt: stored.createdAt,
          items: stored.items,
        };

        return reply.status(200).send({ order });
      }

      const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
      const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY || '';
      const url = `${baseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*,order_items(*)`;

      try {
        const res = await fetch(url, {
          headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        });

        if (res.ok) {
          const rows = (await res.json()) as SupabaseOrderRow[];
          if (!rows || rows.length === 0) {
            return reply.status(404).send({
              error: {
                statusCode: 404,
                code: 'ORDER_NOT_FOUND',
                message: `Order ${id} not found.`,
              },
            });
          }

          const r = rows[0];

          // CRITICAL OWNERSHIP CHECK: Cross-customer access prevention
          if (r.customer_id !== user.id) {
            return reply.status(403).send({
              error: {
                statusCode: 403,
                code: 'FORBIDDEN_ORDER_ACCESS',
                message: 'You do not have permission to view this order.',
              },
            });
          }

          const order: Order = {
            id: r.id,
            orderNumber: r.order_number,
            customerId: r.customer_id,
            customerPhone: r.customer_phone,
            customerName: r.customer_name || 'Boutique Guest',
            fulfillmentType: r.fulfillment_type,
            scheduledPickupAt: r.scheduled_pickup_at,
            estimatedPickupAt: r.estimated_pickup_at || r.created_at,
            orderStatus: r.order_status,
            paymentStatus: r.payment_status,
            paymentMethod: r.payment_method,
            subtotalAmount: Number(r.subtotal_amount),
            taxAmount: Number(r.tax_amount),
            packagingAmount: Number(r.packaging_amount),
            totalAmount: Number(r.total_amount),
            specialNotes: r.special_notes,
            expiresAt: r.expires_at,
            createdAt: r.created_at,
            items: (r.order_items || []).map((item) => ({
              id: item.id,
              productId: item.product_id,
              productNameSnapshot: item.product_name_snapshot,
              unitPriceSnapshot: Number(item.unit_price_snapshot),
              taxRateSnapshot: Number(item.tax_rate_snapshot),
              quantity: Number(item.quantity),
              lineTotal: Number(item.line_total),
            })),
          };

          return reply.status(200).send({ order });
        }
      } catch {
        // Fall through
      }

      return reply.status(404).send({
        error: {
          statusCode: 404,
          code: 'ORDER_NOT_FOUND',
          message: `Order ${id} not found.`,
        },
      });
    }
  );
};
