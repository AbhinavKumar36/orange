import type { FastifyRequest, FastifyReply } from 'fastify';
import { type AppConfig } from '../config/env.js';

export interface AuthenticatedUser {
  id: string;
  phone: string;
  email?: string | null;
  fullName?: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export interface AuthPluginOptions {
  config: AppConfig;
}

export async function verifySupabaseToken(
  token: string,
  config: AppConfig
): Promise<AuthenticatedUser | null> {
  // Support mock tokens in test/dev when ALLOW_MOCK_SERVICES is enabled
  if (config.ALLOW_MOCK_SERVICES) {
    if (token.startsWith('mock_customer_') || token.startsWith('test_token_')) {
      const parts = token.split(':');
      const id = parts[1] || '00000000-0000-0000-0000-000000000001';
      const phone = parts[2] || '+919876543210';
      const name = parts[3] || 'Test Customer';
      return { id, phone, fullName: name, email: `${id}@test.com` };
    }
  }

  const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
  const url = `${baseUrl}/auth/v1/user`;
  const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY || '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      id: string;
      phone?: string;
      email?: string;
      user_metadata?: { full_name?: string; name?: string };
    };

    if (!data || !data.id) {
      return null;
    }

    return {
      id: data.id,
      phone: data.phone || '',
      email: data.email || null,
      fullName: data.user_metadata?.full_name || data.user_metadata?.name || null,
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export function createAuthPreHandler(config: AppConfig) {
  return async function requireCustomerAuth(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    let token: string | null = null;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (request.headers.cookie) {
      // Support secure session cookie for web clients
      const cookieStr = request.headers.cookie;
      const match = cookieStr.match(/(?:^|;\s*)(?:moody_session|sb-access-token)=([^;]+)/);
      if (match && match[1]) {
        token = decodeURIComponent(match[1].trim());
      }
    }

    if (!token) {
      reply.status(401).send({
        error: {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header. A valid Bearer token or session cookie is required.',
        },
      });
      return;
    }

    const user = await verifySupabaseToken(token, config);
    if (!user) {
      reply.status(401).send({
        error: {
          statusCode: 401,
          code: 'INVALID_TOKEN',
          message: 'Session token is expired, revoked, or cryptographically invalid.',
        },
      });
      return;
    }

    if (!user.phone) {
      reply.status(401).send({
        error: {
          statusCode: 401,
          code: 'UNVERIFIED_PHONE_ACCOUNT',
          message: 'Authenticated account does not have a verified phone number.',
        },
      });
      return;
    }

    request.user = user;
  };
}
