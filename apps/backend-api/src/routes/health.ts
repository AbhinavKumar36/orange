import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  const healthHandler = async () => {
    return { status: 'ok' };
  };

  // Root health endpoint
  app.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
          required: ['status'],
        },
      },
    },
  }, healthHandler);

  // Versioned API health endpoint for /api/v1 contract parity
  app.get('/api/v1/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
          required: ['status'],
        },
      },
    },
  }, healthHandler);
};

