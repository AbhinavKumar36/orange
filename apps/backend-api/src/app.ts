import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { type AppConfig, loadConfig } from './config/env.js';
import { setupErrorHandler } from './plugins/errorHandler.js';
import { healthRoutes } from './routes/health.js';
import { catalogRoutes } from './routes/catalog.js';
import { profileRoutes } from './routes/profile.js';
import { ordersRoutes } from './routes/orders.js';
import { adminRoutes } from './routes/admin.js';
import { paymentsRoutes } from './routes/payments.js';
import { webhooksRoutes } from './routes/webhooks.js';

export interface BuildAppOptions {
  config?: AppConfig;
  fastifyOptions?: FastifyServerOptions;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();

  const app = fastify({
    logger: options.fastifyOptions?.logger ?? {
      level: config.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-idempotency-key"]',
        'req.headers["x-refund-idempotency-key"]',
        'req.headers["x-supabase-key"]',
      ],
    },
    ...options.fastifyOptions,
  });

  // Register CORS
  const origins = config.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  await app.register(cors, {
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Preserve rawBody for webhook HMAC verification while still parsing JSON
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      const rawStr = body.toString('utf8');
      (req as unknown as { rawBody?: string }).rawBody = rawStr;
      const json = rawStr.length > 0 ? JSON.parse(rawStr) : {};
      done(null, json);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Invalid JSON');
      (error as { statusCode?: number }).statusCode = 400;
      done(error, undefined);
    }
  });

  // Configure central error handling on root instance
  setupErrorHandler(app);

  // Register routes
  await app.register(healthRoutes);
  await app.register(catalogRoutes, { config });
  await app.register(profileRoutes, { config });
  await app.register(ordersRoutes, { config });
  await app.register(paymentsRoutes, { config });
  await app.register(webhooksRoutes, { config });
  await app.register(adminRoutes, { config });

  return app;
}
