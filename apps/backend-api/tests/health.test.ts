import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { validateConfig } from '../src/config/env.js';

describe('Health Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = validateConfig({
      NODE_ENV: 'test',
      PORT: '4000',
      SUPABASE_URL: 'https://test-project.supabase.co',
    });
    app = await buildApp({ config });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health should return 200 with { status: "ok" }', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const body = response.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET /api/v1/health should return 200 with { status: "ok" } for contract parity', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const body = response.json();
    expect(body).toEqual({ status: 'ok' });
  });
});

