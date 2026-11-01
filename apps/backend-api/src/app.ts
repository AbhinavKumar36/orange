import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { type AppConfig, loadConfig } from './config/env.js';
import { setupErrorHandler } from './plugins/errorHandler.js';
import { healthRoutes } from './routes/health.js';
import { catalogRoutes } from './routes/catalog.js';

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

  // Configure central error handling on root instance
  setupErrorHandler(app);

  // Register routes
  await app.register(healthRoutes);
  await app.register(catalogRoutes, { config });

  return app;
}
