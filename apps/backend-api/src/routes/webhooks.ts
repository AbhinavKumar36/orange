import type { FastifyPluginAsync } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { API_VERSION_PREFIX } from '@orange/api-contracts';
import { type AppConfig } from '../config/env.js';
import { mockOrdersStore } from './orders.js';
import {
  mockPaymentsStore,
  mockRefundsStore,
  mockWebhookEvents,
} from '../services/paymentStore.js';
import { verifyWebhookSignature, isMockPaymentMode } from '../services/razorpay.js';

interface WebhooksPluginOptions {
  config: AppConfig;
}

export const webhooksRoutes: FastifyPluginAsync<WebhooksPluginOptions> = async (app, options) => {
  const config = options.config;

  // POST /api/v1/webhooks/razorpay (Dedicated raw-body webhook handler)
  app.post(`${API_VERSION_PREFIX}/webhooks/razorpay`, async (request, reply) => {
    const rawSignature =
      (request.headers['x-razorpay-signature'] as string) ||
      (request.headers['x-signature'] as string);

    if (!rawSignature) {
      return reply.status(400).send({
        error: {
          statusCode: 400,
          code: 'MISSING_SIGNATURE',
          message: 'Missing required X-Razorpay-Signature header.',
        },
      });
    }

    // Retrieve raw body
    const rawBody =
      (request as unknown as { rawBody?: string }).rawBody ||
      (typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body || {}));

    const webhookSecret = config.RAZORPAY_WEBHOOK_SECRET || '';

    let isSignatureValid = false;
    if (
      isMockPaymentMode(config) &&
      rawSignature.startsWith('mock_sig_')
    ) {
      isSignatureValid = true;
    } else {
      isSignatureValid = verifyWebhookSignature({
        rawBody,
        signature: rawSignature,
        webhookSecret,
      });
    }

    if (!isSignatureValid) {
      return reply.status(400).send({
        error: {
          statusCode: 400,
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'Razorpay webhook signature verification failed.',
        },
      });
    }

    const payload = (typeof request.body === 'object' && request.body !== null
      ? request.body
      : JSON.parse(rawBody || '{}')) as {
      id?: string;
      event_id?: string;
      event?: string;
      payload?: {
        payment?: { entity?: { id: string; order_id?: string; amount: number; currency: string; notes?: Record<string, string> } };
        order?: { entity?: { id: string; notes?: Record<string, string> } };
        refund?: { entity?: { id: string; payment_id: string; amount: number; status: string; notes?: Record<string, string> } };
      };
    };

    const eventId =
      payload.event_id ||
      payload.id ||
      createHash('sha256').update(rawBody).digest('hex');
    const eventType = payload.event || 'unknown';

    // 1. Deduplication Check
    const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
    const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || '';

    if (apiKey && !config.ALLOW_MOCK_SERVICES) {
      try {
        // Check if event already exists in payment_webhook_events
        const checkRes = await fetch(
          `${baseUrl}/rest/v1/payment_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&select=id,status`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            },
          }
        );

        if (!checkRes.ok) {
          throw new Error(`Failed to query payment_webhook_events (${checkRes.status})`);
        }

        const rows = (await checkRes.json()) as Array<{ id: string; status?: string }>;
        if (rows && rows.length > 0) {
          if (rows[0].status === 'processed') {
            // Already processed: return 200 idempotently
            return reply.status(200).send({ received: true, deduplicated: true });
          }
          // Previously failed or interrupted: re-claim as processing for retry
          await fetch(
            `${baseUrl}/rest/v1/payment_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`,
            {
              method: 'PATCH',
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'processing' }),
            }
          );
        } else {
          // Record incoming event
          const insertRes = await fetch(`${baseUrl}/rest/v1/payment_webhook_events`, {
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
              provider: 'razorpay',
              payload,
              status: 'processing',
            }),
          });
          if (!insertRes.ok) {
            throw new Error(`Failed to record webhook event (${insertRes.status})`);
          }
        }
      } catch (err) {
        app.log.error(err, 'Failed to interact with payment_webhook_events');
        return reply.status(503).send({
          error: {
            statusCode: 503,
            code: 'WEBHOOK_STATE_UNAVAILABLE',
            message: 'Unable to claim webhook processing state; retry later.',
          },
        });
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
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const paymentEntity = payload.payload?.payment?.entity;
        const orderEntity = payload.payload?.order?.entity;
        const providerOrderId = paymentEntity?.order_id || orderEntity?.id;
        const providerPaymentId = paymentEntity?.id;
        const amount = paymentEntity?.amount;
        const currency = paymentEntity?.currency || 'INR';
        const orderIdNote = paymentEntity?.notes?.orderId || orderEntity?.notes?.orderId;

        if (providerPaymentId && providerOrderId) {
          // Look up order ID if not directly present in notes
          let orderId = orderIdNote;
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
              const rpcRes = await fetch(`${baseUrl}/rest/v1/rpc/rpc_reconcile_late_payment`, {
                method: 'POST',
                headers: {
                  apikey: apiKey,
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  p_order_id: orderId,
                  p_provider_payment_id: providerPaymentId,
                  p_provider_order_id: providerOrderId,
                  p_amount: amount,
                  p_currency: currency,
                  p_raw_payload: payload,
                }),
              });
              if (!rpcRes.ok) {
                throw new Error(`rpc_reconcile_late_payment failed (${rpcRes.status})`);
              }
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
                provider: 'razorpay',
                providerOrderId,
                providerPaymentId,
                providerSignature: rawSignature,
                amount: amount || (mockOrder?.totalAmount ?? 0),
                currency: 'INR',
                status: 'captured',
                rawPayload: payload,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      } else if (eventType === 'payment.failed') {
        const paymentEntity = payload.payload?.payment?.entity;
        const providerOrderId = paymentEntity?.order_id;
        const providerPaymentId = paymentEntity?.id;

        if (providerPaymentId && providerOrderId) {
          if (config.ALLOW_MOCK_SERVICES) {
            let orderId: string | undefined;
            for (const o of mockOrdersStore.values()) {
              if (o.providerOrderId === providerOrderId) {
                orderId = o.id;
                break;
              }
            }
            if (orderId) {
              const mockOrder = mockOrdersStore.get(orderId);
              if (mockOrder && mockOrder.paymentStatus !== 'captured') {
                mockOrder.paymentStatus = 'failed';
              }
              mockPaymentsStore.set(providerPaymentId, {
                id: randomUUID(),
                orderId,
                provider: 'razorpay',
                providerOrderId,
                providerPaymentId,
                amount: paymentEntity?.amount ?? 0,
                currency: 'INR',
                status: 'failed',
                rawPayload: payload,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      } else if (eventType === 'refund.processed') {
        const refundEntity = payload.payload?.refund?.entity;
        const providerRefundId = refundEntity?.id;
        const paymentId = refundEntity?.payment_id;
        const amount = refundEntity?.amount ?? 0;

        if (providerRefundId && paymentId) {
          if (apiKey && !config.ALLOW_MOCK_SERVICES) {
            // Reconcile production refund record in Supabase
            const refRes = await fetch(
              `${baseUrl}/rest/v1/refunds?provider_refund_id=eq.${encodeURIComponent(providerRefundId)}&select=id,order_id,amount,status`,
              {
                headers: {
                  apikey: apiKey,
                  Authorization: `Bearer ${apiKey}`,
                  Accept: 'application/json',
                },
              }
            );
            if (!refRes.ok) {
              throw new Error(`Failed to query refunds (${refRes.status})`);
            }
            const refRows = (await refRes.json()) as Array<{
              id: string;
              order_id: string;
              amount: number | string;
              status: string;
            }>;
            if (refRows.length > 0) {
              const target = refRows[0];
              await fetch(`${baseUrl}/rest/v1/refunds?id=eq.${encodeURIComponent(target.id)}`, {
                method: 'PATCH',
                headers: {
                  apikey: apiKey,
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  status: 'refunded',
                  updated_at: new Date().toISOString(),
                }),
              });

              // Recalculate order payment_status based on all confirmed refunds
              const [ordRes, allRefRes] = await Promise.all([
                fetch(`${baseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(target.order_id)}&select=total_amount`, {
                  headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
                }),
                fetch(
                  `${baseUrl}/rest/v1/refunds?order_id=eq.${encodeURIComponent(target.order_id)}&status=eq.refunded&select=amount`,
                  { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } }
                ),
              ]);
              if (ordRes.ok && allRefRes.ok) {
                const ordRows = (await ordRes.json()) as Array<{ total_amount: number | string }>;
                const allRefs = (await allRefRes.json()) as Array<{ amount: number | string }>;
                const orderTotal = Number(ordRows[0]?.total_amount ?? 0);
                const totalRefunded = allRefs.reduce((s, r) => s + Number(r.amount), 0);
                if (orderTotal > 0) {
                  await fetch(`${baseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(target.order_id)}`, {
                    method: 'PATCH',
                    headers: {
                      apikey: apiKey,
                      Authorization: `Bearer ${apiKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      payment_status: totalRefunded >= orderTotal ? 'refunded' : 'partially_refunded',
                      updated_at: new Date().toISOString(),
                    }),
                  });
                }
              }
            }
          }
          if (config.ALLOW_MOCK_SERVICES) {
            for (const refund of mockRefundsStore.values()) {
              if (
                refund.providerRefundId === providerRefundId ||
                (!refund.providerRefundId && refund.amount === amount)
              ) {
                refund.status = 'refunded';
                refund.providerRefundId = providerRefundId;
                const order = mockOrdersStore.get(refund.orderId);
                if (order) {
                  let totalRefunded = 0;
                  for (const r of mockRefundsStore.values()) {
                    if (r.orderId === refund.orderId && r.status === 'refunded') {
                      totalRefunded += r.amount;
                    }
                  }
                  order.paymentStatus =
                    totalRefunded >= order.totalAmount ? 'refunded' : 'partially_refunded';
                }
                break;
              }
            }
          }
        }
      } else if (eventType === 'refund.failed') {
        const refundEntity = payload.payload?.refund?.entity;
        const providerRefundId = refundEntity?.id;
        if (providerRefundId && apiKey && !config.ALLOW_MOCK_SERVICES) {
          await fetch(
            `${baseUrl}/rest/v1/refunds?provider_refund_id=eq.${encodeURIComponent(providerRefundId)}`,
            {
              method: 'PATCH',
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status: 'refund_failed',
                updated_at: new Date().toISOString(),
              }),
            }
          );
        }
        if (providerRefundId && config.ALLOW_MOCK_SERVICES) {
          for (const refund of mockRefundsStore.values()) {
            if (refund.providerRefundId === providerRefundId) {
              refund.status = 'refund_failed';
              break;
            }
          }
        }
      }

      // Update event status to processed in DB
      if (apiKey && !config.ALLOW_MOCK_SERVICES) {
        const patchRes = await fetch(
          `${baseUrl}/rest/v1/payment_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`,
          {
            method: 'PATCH',
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'processed',
              processed_at: new Date().toISOString(),
            }),
          }
        );
        if (!patchRes.ok) {
          throw new Error(`Failed to mark webhook event processed (${patchRes.status})`);
        }
      }
    } catch (err) {
      app.log.error(err, 'Error while processing webhook event');
      if (apiKey && !config.ALLOW_MOCK_SERVICES) {
        await fetch(
          `${baseUrl}/rest/v1/payment_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`,
          {
            method: 'PATCH',
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'failed',
            }),
          }
        ).catch(() => {});
      }
      return reply.status(503).send({
        error: {
          statusCode: 503,
          code: 'WEBHOOK_PROCESSING_FAILED',
          message: 'Webhook reconciliation failed; please retry.',
        },
      });
    }

    return reply.status(200).send({ received: true });
  });
};
