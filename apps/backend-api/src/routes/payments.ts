import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  API_VERSION_PREFIX,
  InitiatePaymentRequestSchema,
  VerifyPaymentRequestSchema,
  type InitiatePaymentResponse,
  type VerifyPaymentResponse,
} from '@orange/api-contracts';
import { type AppConfig } from '../config/env.js';
import { createAuthPreHandler } from '../plugins/auth.js';
import { mockOrdersStore } from './orders.js';
import { mockPaymentsStore } from '../services/paymentStore.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
} from '../services/razorpay.js';

interface PaymentsPluginOptions {
  config: AppConfig;
}

interface SupabaseOrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  customer_phone: string;
  customer_name: string;
  order_status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number | string;
  provider_order_id?: string | null;
  expires_at?: string | null;
}

export const paymentsRoutes: FastifyPluginAsync<PaymentsPluginOptions> = async (app, options) => {
  const config = options.config;
  const requireAuth = createAuthPreHandler(config);

  // Helper to get order from DB or Mock
  async function getOrder(orderId: string) {
    const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
    const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY || '';

    if (apiKey && !config.ALLOW_MOCK_SERVICES) {
      try {
        const res = await fetch(
          `${baseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,customer_id,customer_phone,customer_name,order_status,payment_status,payment_method,total_amount,provider_order_id,expires_at`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            },
          }
        );
        if (res.ok) {
          const rows = (await res.json()) as SupabaseOrderRow[];
          if (rows && rows.length > 0) {
            const row = rows[0];
            return {
              id: row.id,
              orderNumber: row.order_number,
              customerId: row.customer_id,
              customerPhone: row.customer_phone,
              customerName: row.customer_name,
              orderStatus: row.order_status,
              paymentStatus: row.payment_status,
              paymentMethod: row.payment_method,
              totalAmount: Number(row.total_amount),
              providerOrderId: row.provider_order_id,
              expiresAt: row.expires_at,
            };
          }
        }
      } catch (err) {
        app.log.error(err, 'Failed to fetch order from Supabase');
      }
    }

    if (config.ALLOW_MOCK_SERVICES) {
      const mock = mockOrdersStore.get(orderId);
      if (mock) {
        return {
          id: mock.id,
          orderNumber: mock.orderNumber,
          customerId: mock.customerId,
          customerPhone: mock.customerPhone,
          customerName: mock.customerName,
          orderStatus: mock.orderStatus,
          paymentStatus: mock.paymentStatus,
          paymentMethod: mock.paymentMethod,
          totalAmount: mock.totalAmount,
          providerOrderId: mock.providerOrderId,
          expiresAt: mock.expiresAt,
        };
      }
    }

    return null;
  }

  // POST /api/v1/payments/initiate (Customer-initiated online payment)
  app.post(
    `${API_VERSION_PREFIX}/payments/initiate`,
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const parseResult = InitiatePaymentRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Invalid payment initiation request.',
            details: parseResult.error.issues,
          },
        });
      }

      const { orderId } = parseResult.data;
      const order = await getOrder(orderId);

      if (!order) {
        return reply.status(404).send({
          error: {
            statusCode: 404,
            code: 'ORDER_NOT_FOUND',
            message: `Order ${orderId} was not found.`,
          },
        });
      }

      // Order ownership verification
      if (order.customerId !== user.id) {
        return reply.status(403).send({
          error: {
            statusCode: 403,
            code: 'FORBIDDEN_ORDER_ACCESS',
            message: 'You are not authorized to initiate payment for this order.',
          },
        });
      }

      // Payment method validation
      if (order.paymentMethod === 'cash_at_pickup') {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'INVALID_PAYMENT_METHOD',
            message:
              'Online payment cannot be initiated for cash-at-pickup orders. Payment must be collected at the counter.',
          },
        });
      }

      // Order state verification
      if (order.paymentStatus === 'captured') {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'ORDER_ALREADY_PAID',
            message: 'Order has already been paid.',
          },
        });
      }

      if (order.orderStatus === 'cancelled_expired') {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'ORDER_EXPIRED',
            message: 'Order reservation has expired and cannot be paid.',
          },
        });
      }

      if (order.expiresAt && new Date(order.expiresAt).getTime() < Date.now()) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'ORDER_EXPIRED',
            message: 'Order reservation TTL has expired.',
          },
        });
      }

      if (order.orderStatus !== 'draft' && order.paymentStatus !== 'failed') {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'ORDER_NOT_PAYABLE',
            message: `Order cannot be paid in current status: ${order.orderStatus}.`,
          },
        });
      }

      // Reuse existing active provider order if not retrying after failure
      let razorpayOrderId = order.providerOrderId;
      if (!razorpayOrderId || order.paymentStatus === 'failed') {
        try {
          const rzpOrder = await createRazorpayOrder({
            amount: order.totalAmount,
            currency: 'INR',
            receipt: order.orderNumber,
            notes: {
              orderId: order.id,
              customerId: user.id,
            },
            config,
          });
          razorpayOrderId = rzpOrder.id;

          // Update order in DB or mock store with provider_order_id
          const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
          const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || '';
          if (apiKey && !config.ALLOW_MOCK_SERVICES) {
            await fetch(`${baseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
              method: 'PATCH',
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                provider_order_id: razorpayOrderId,
                updated_at: new Date().toISOString(),
              }),
            });
          }

          if (config.ALLOW_MOCK_SERVICES) {
            const mock = mockOrdersStore.get(order.id);
            if (mock) {
              mock.providerOrderId = razorpayOrderId;
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Razorpay order creation failed.';
          return reply.status(502).send({
            error: {
              statusCode: 502,
              code: 'PAYMENT_GATEWAY_ERROR',
              message: msg,
            },
          });
        }
      }

      const response: InitiatePaymentResponse = {
        orderId: order.id,
        razorpayOrderId,
        amount: order.totalAmount,
        currency: 'INR',
        keyId: config.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        customerName: order.customerName,
        customerPhone: order.customerPhone,
      };

      return reply.status(200).send(response);
    }
  );

  // POST /api/v1/payments/verify (Client payment confirmation & signature verification)
  app.post(
    `${API_VERSION_PREFIX}/payments/verify`,
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const parseResult = VerifyPaymentRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Invalid payment verification request.',
            details: parseResult.error.issues,
          },
        });
      }

      const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parseResult.data;
      const order = await getOrder(orderId);

      if (!order) {
        return reply.status(404).send({
          error: {
            statusCode: 404,
            code: 'ORDER_NOT_FOUND',
            message: `Order ${orderId} was not found.`,
          },
        });
      }

      // Order ownership check
      if (order.customerId !== user.id) {
        return reply.status(403).send({
          error: {
            statusCode: 403,
            code: 'FORBIDDEN_ORDER_ACCESS',
            message: 'You are not authorized to verify payment for this order.',
          },
        });
      }

      // Cross-order check: provider order ID must match if set
      if (order.providerOrderId && order.providerOrderId !== razorpayOrderId) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'PROVIDER_ORDER_MISMATCH',
            message: 'Razorpay order ID does not match the payment attempt registered for this order.',
          },
        });
      }

      // Server-side cryptographic signature verification
      const secret = config.RAZORPAY_KEY_SECRET || '';
      let isSignatureValid = false;

      if (
        (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test') &&
        razorpaySignature.startsWith('mock_sig_')
      ) {
        // Deterministic mock test signature
        isSignatureValid = true;
      } else {
        isSignatureValid = verifyPaymentSignature({
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          secret,
        });
      }

      if (!isSignatureValid) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'INVALID_PAYMENT_SIGNATURE',
            message: 'Razorpay payment signature verification failed. Order will not be marked as paid.',
          },
        });
      }

      // Reconcile payment via Supabase RPC or Mock Store
      const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
      const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || '';

      if (apiKey && !config.ALLOW_MOCK_SERVICES) {
        try {
          const rpcRes = await fetch(`${baseUrl}/rest/v1/rpc/rpc_reconcile_late_payment`, {
            method: 'POST',
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              p_order_id: order.id,
              p_provider_payment_id: razorpayPaymentId,
              p_provider_order_id: razorpayOrderId,
              p_amount: order.totalAmount,
              p_currency: 'INR',
              p_raw_payload: {
                verifiedAt: new Date().toISOString(),
                signature: razorpaySignature,
              },
            }),
          });

          if (!rpcRes.ok) {
            const errJson = (await rpcRes.json().catch(() => ({}))) as { message?: string };
            return reply.status(400).send({
              error: {
                statusCode: 400,
                code: 'RECONCILIATION_FAILED',
                message: errJson.message || 'Payment reconciliation failed.',
              },
            });
          }
        } catch (err) {
          app.log.error(err, 'Failed to call rpc_reconcile_late_payment');
          return reply.status(500).send({
            error: {
              statusCode: 500,
              code: 'DATABASE_ERROR',
              message: 'Failed to record verified payment.',
            },
          });
        }
      }

      if (config.ALLOW_MOCK_SERVICES) {
        // Mock reconciliation
        const existing = mockPaymentsStore.get(razorpayPaymentId);
        if (existing && existing.orderId !== order.id) {
          return reply.status(409).send({
            error: {
              statusCode: 409,
              code: 'PAYMENT_ALREADY_EXISTS',
              message: `Payment ID ${razorpayPaymentId} was already used on another order.`,
            },
          });
        }

        const mockOrder = mockOrdersStore.get(order.id);
        if (mockOrder) {
          mockOrder.orderStatus = 'confirmed';
          mockOrder.paymentStatus = 'captured';
          mockOrder.expiresAt = null;
        }

        mockPaymentsStore.set(razorpayPaymentId, {
          id: randomUUID(),
          orderId: order.id,
          provider: 'razorpay',
          providerOrderId: razorpayOrderId,
          providerPaymentId: razorpayPaymentId,
          providerSignature: razorpaySignature,
          amount: order.totalAmount,
          currency: 'INR',
          status: 'captured',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      const response: VerifyPaymentResponse = {
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: 'confirmed',
        paymentStatus: 'captured',
        paymentId: razorpayPaymentId,
      };

      return reply.status(200).send(response);
    }
  );
};
