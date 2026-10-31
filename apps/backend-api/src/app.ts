import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { type AppConfig, loadConfig } from './config/env.js';
import { errorHandlerPlugin } from './plugins/errorHandler.js';
import { healthRoutes } from './routes/health.js';

export interface BuildAppOptions {
  config?: AppConfig;
  fastifyOptions?: FastifyServerOptions;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();

  const app = fastify({
    logger: options.fastifyOptions?.logger ?? {
      level: config.NODE_ENV === 'test' ? 'silent' : 'info',
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

  // Register central error handling
  await app.register(errorHandlerPlugin);

  // Register routes
  await app.register(healthRoutes);

  return app;
}

