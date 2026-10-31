import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { validateConfig } from '../src/config/env.js';

describe('Consistent Error Handling', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = validateConfig({
      NODE_ENV: 'test',
    });
    app = await buildApp({ config });

    // Route that triggers a custom error
    app.get('/test-error', async () => {
      const error = new Error('Custom failure');
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return consistent 404 response for unknown routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-route',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error).toBeDefined();
    expect(body.error.statusCode).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('/non-existent-route');
  });

  it('should return consistent formatted error response for handled application errors', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-error',
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBeDefined();
    expect(body.error.statusCode).toBe(400);
    expect(body.error.message).toBe('Custom failure');
  });
});

