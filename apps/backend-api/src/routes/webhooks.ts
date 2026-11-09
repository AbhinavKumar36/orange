import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { API_VERSION_PREFIX } from '@orange/api-contracts';
import { type AppConfig } from '../config/env.js';
import { mockOrdersStore } from './orders.js';
import {
  mockPaymentsStore,
  mockRefundsStore,
  mockWebhookEvents,
} from '../services/paymentStore.js';
import { verifyYoupiWebhookSignature } from '../services/youpi.js';
import { verifyWebhookSignature } from '../services/razorpay.js';

interface WebhooksPluginOptions {
  config: AppConfig;
}

export const webhooksRoutes: FastifyPluginAsync<WebhooksPluginOptions> = async (app, options) => {
  const config = options.config;

  const handleWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const rawSignature =
      (request.headers['x-gateway-signature'] as string) ||
      (request.headers['x-signature'] as string) ||
      (request.headers['x-razorpay-signature'] as string);

    if (!rawSignature) {
      return reply.status(400).send({
        error: {
          statusCode: 400,
          code: 'MISSING_SIGNATURE',
          message: 'Missing required webhook signature header (X-Gateway-Signature).',
        },
      });
    }

    // Retrieve raw body
    const rawBody =
      (request as unknown as { rawBody?: string }).rawBody ||
      (typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body || {}));

    const youpiSecret = config.YOUPI_WEBHOOK_SECRET || '';
    const rzpSecret = config.RAZORPAY_WEBHOOK_SECRET || '';

    let isSignatureValid = false;
    if (
      (config.ALLOW_MOCK_SERVICES || config.NODE_ENV === 'test') &&
      rawSignature.startsWith('mock_sig_')
    ) {
      isSignatureValid = true;
    } else {
      isSignatureValid =
        verifyYoupiWebhookSignature({
          rawBody,
          signature: rawSignature,
          webhookSecret: youpiSecret,
        }) ||
        (rzpSecret
          ? verifyWebhookSignature({
              rawBody,
              signature: rawSignature,
              webhookSecret: rzpSecret,
            })
          : false);
    }

    if (!isSignatureValid) {
      return reply.status(400).send({
        error: {
          statusCode: 400,
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'Webhook signature verification failed.',
        },
      });
    }

    const payload = (typeof request.body === 'object' && request.body !== null
      ? request.body
      : JSON.parse(rawBody || '{}')) as {
      id?: string;
      event_id?: string;
      event?: string;
      paymentId?: string;
      orderId?: string;
      amount?: string | number;
      amountPaise?: number;
      currency?: string;
      utr?: string;
      method?: string;
      metadata?: Record<string, string>;
      payload?: {
        payment?: {
          entity?: {
            id: string;
            order_id?: string;
            amount: number;
            currency: string;
            notes?: Record<string, string>;
          };
        };
        order?: { entity?: { id: string; notes?: Record<string, string> } };
        refund?: {
          entity?: {
            id: string;
            payment_id: string;
            amount: number;
            status: string;
            notes?: Record<string, string>;
          };
        };
      };
    };

    const eventId =
      payload.event_id ||
      payload.id ||
      payload.paymentId ||
      createHash('sha256').update(rawBody).digest('hex');
    const eventType = payload.event || (request.headers['x-gateway-event'] as string) || 'unknown';

    // 1. Deduplication Check
    const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
    const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || '';

    if (apiKey && !config.ALLOW_MOCK_SERVICES) {
      try {
        const checkRes = await fetch(
          `${baseUrl}/rest/v1/payment_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&select=id`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            },
          }
        );

        if (checkRes.ok) {
          const rows = (await checkRes.json()) as Array<{ id: string }>;
          if (rows && rows.length > 0) {
            return reply.status(200).send({ received: true, deduplicated: true });
          }
        }

        await fetch(`${baseUrl}/rest/v1/payment_webhook_events`, {
          method: 'POST',
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=ignore-duplicates',
          },
          body: JSON.stringify({
            event_id: eventId,
            event_type: eventType,
            provider: 'youpi',
            payload,
            status: 'processing',
          }),
        });
      } catch (err) {
        app.log.error(err, 'Failed to interact with payment_webhook_events');
      }
    }

    if (config.ALLOW_MOCK_SERVICES) {
      if (mockWebhookEvents.has(eventId)) {
        return reply.status(200).send({ received: true, deduplicated: true });
      }
      mockWebhookEvents.add(eventId);
    }

    // 2. Event Dispatching
    try {
      const isSuccessEvent = [
        'OBSERVED_SUCCESS',
        'SUCCESS',
        'RECONCILED',
        'payment.captured',
        'order.paid',
      ].includes(eventType);

      const isFailedEvent = [
        'FAILED',
        'EXPIRED',
        'CANCELLED',
        'payment.failed',
      ].includes(eventType);

      if (isSuccessEvent) {
        // Handle YouPI-PG or legacy entities
        const paymentEntity = payload.payload?.payment?.entity;
        const orderEntity = payload.payload?.order?.entity;

        const providerOrderId =
          payload.paymentId ||
          paymentEntity?.order_id ||
          orderEntity?.id;
        const providerPaymentId =
          payload.utr ||
          payload.paymentId ||
          paymentEntity?.id ||
          `pay_${Date.now()}`;
        const amount =
          payload.amountPaise ||
          (payload.amount ? Math.round(Number(payload.amount) * 100) : undefined) ||
          paymentEntity?.amount;
        const currency = payload.currency || paymentEntity?.currency || 'INR';

        const orderIdNote =
          payload.metadata?.internalOrderId ||
          paymentEntity?.notes?.orderId ||
          orderEntity?.notes?.orderId;

        // Resolve orderId
        let orderId = orderIdNote;
        if (!orderId && payload.orderId) {
          // If orderId is order_number or uuid
          if (config.ALLOW_MOCK_SERVICES) {
            for (const o of mockOrdersStore.values()) {
              if (o.orderNumber === payload.orderId || o.id === payload.orderId || o.providerOrderId === payload.paymentId) {
                orderId = o.id;
                break;
              }
            }
          }
        }

        if (providerPaymentId && providerOrderId) {
          if (!orderId && apiKey && !config.ALLOW_MOCK_SERVICES) {
            const ordRes = await fetch(
              `${baseUrl}/rest/v1/orders?provider_order_id=eq.${encodeURIComponent(providerOrderId)}&select=id`,
              {
                headers: {
                  apikey: apiKey,
                  Authorization: `Bearer ${apiKey}`,
                  Accept: 'application/json',
                },
              }
            );
            if (ordRes.ok) {
              const rows = (await ordRes.json()) as Array<{ id: string }>;
              if (rows.length > 0) orderId = rows[0].id;
            }
          }

          if (!orderId && config.ALLOW_MOCK_SERVICES) {
            for (const o of mockOrdersStore.values()) {
              if (o.providerOrderId === providerOrderId) {
                orderId = o.id;
                break;
              }
            }
          }

          if (orderId) {
            if (apiKey && !config.ALLOW_MOCK_SERVICES) {
              await fetch(`${baseUrl}/rest/v1/rpc/rpc_reconcile_late_payment`, {
                method: 'POST',
                headers: {
                  apikey: apiKey,
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
                body: JSON.stringify({
                  p_order_id: orderId,
                  p_provider_payment_id: providerPaymentId,
                  p_provider_order_id: providerOrderId,
                  p_amount: amount || 0,
                  p_currency: currency,
                  p_raw_payload: payload,
                }),
              });
            }

            if (config.ALLOW_MOCK_SERVICES) {
              const mockOrder = mockOrdersStore.get(orderId);
              if (mockOrder) {
                mockOrder.orderStatus = 'confirmed';
                mockOrder.paymentStatus = 'captured';
                mockOrder.expiresAt = null;
              }

              mockPaymentsStore.set(providerPaymentId, {
                id: randomUUID(),
                orderId,
                provider: 'youpi',
                providerOrderId,
                providerPaymentId,
                amount: amount || mockOrder?.totalAmount || 0,
                currency,
                status: 'captured',
                rawPayload: payload,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      } else if (isFailedEvent) {
        const paymentEntity = payload.payload?.payment?.entity;
        const providerOrderId = payload.paymentId || paymentEntity?.order_id;
        const providerPaymentId = payload.utr || payload.paymentId || paymentEntity?.id;

        let orderId = payload.metadata?.internalOrderId || paymentEntity?.notes?.orderId;
        if (!orderId && providerOrderId && config.ALLOW_MOCK_SERVICES) {
          for (const o of mockOrdersStore.values()) {
            if (o.providerOrderId === providerOrderId) {
              orderId = o.id;
              break;
            }
          }
        }

        if (orderId && config.ALLOW_MOCK_SERVICES) {
          const mockOrder = mockOrdersStore.get(orderId);
          if (mockOrder && mockOrder.paymentStatus !== 'captured') {
            mockOrder.paymentStatus = 'failed';
          }
          if (providerPaymentId) {
            mockPaymentsStore.set(providerPaymentId, {
              id: randomUUID(),
              orderId,
              provider: 'youpi',
              providerOrderId: providerOrderId ?? null,
              providerPaymentId,
              amount: mockOrder?.totalAmount || 0,
              currency: 'INR',
              status: 'failed',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } else if (eventType === 'refund.processed') {
        const refundEntity = payload.payload?.refund?.entity;
        if (refundEntity && config.ALLOW_MOCK_SERVICES) {
          const refundId = refundEntity.id;
          const rec = mockRefundsStore.get(refundId);
          if (rec) {
            rec.status = 'refunded';
            rec.updatedAt = new Date().toISOString();
          }
        }
      }

      return reply.status(200).send({ received: true });
    } catch (dispatchErr) {
      app.log.error(dispatchErr, 'Error dispatching webhook event');
      return reply.status(200).send({ received: true, error: 'Internal processing error' });
    }
  };

  // Primary YouPI-PG Webhook endpoint
  app.post(`${API_VERSION_PREFIX}/webhooks/youpi`, handleWebhook);
  // Alias for backward compatibility
  app.post(`${API_VERSION_PREFIX}/webhooks/razorpay`, handleWebhook);
};
