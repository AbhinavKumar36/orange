import type { FastifyRequest, FastifyReply } from 'fastify';
import { type StaffRole } from '@orange/api-contracts';
import { type AppConfig } from '../config/env.js';

export interface AuthenticatedUser {
  id: string;
  phone: string;
  email?: string | null;
  fullName?: string | null;
  staffRole?: StaffRole | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export interface AuthPluginOptions {
  config: AppConfig;
}

export async function fetchStaffRoleFromSupabase(
  userId: string,
  config: AppConfig
): Promise<StaffRole | null> {
  const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
  const url = `${baseUrl}/rest/v1/staff_roles?user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&select=role`;
  const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY || '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ role: StaffRole }>;
    if (rows && Array.isArray(rows) && rows.length > 0 && rows[0]?.role) {
      return rows[0].role;
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function verifySupabaseToken(
  token: string,
  config: AppConfig
): Promise<AuthenticatedUser | null> {
  // Development OTP token support (when SMS provider is unconfigured in development)
  if (config.NODE_ENV !== 'production' && token.startsWith('dev_customer_token:')) {
    const parts = token.split(':');
    let id = parts[1] || '00000000-0000-0000-0000-000000000001';
    let phone = parts[2] || '+919876543210';
    if (id.startsWith('+')) {
      phone = id;
      id = '00000000-0000-0000-0000-000000000001';
    }
    return {
      id,
      phone,
      fullName: 'Demo Customer',
      email: 'customer@moodyorange.local',
      staffRole: null,
    };
  }

  // Mock tokens are strictly isolated to automated tests and rejected in all real environments
  if (config.NODE_ENV === 'test' && config.ALLOW_MOCK_SERVICES) {
    if (
      token.startsWith('mock_customer_') ||
      token.startsWith('mock_staff_') ||
      token.startsWith('mock_manager_') ||
      token.startsWith('mock_admin_') ||
      token.startsWith('test_token_')
    ) {
      const parts = token.split(':');
      const id = parts[1] || '00000000-0000-0000-0000-000000000001';
      const phone = parts[2] || '+919876543210';
      const name = parts[3] || 'Test User';
      let staffRole: StaffRole | null = null;
      if (token.startsWith('mock_staff_')) staffRole = 'counter_staff';
      else if (token.startsWith('mock_manager_')) staffRole = 'manager';
      else if (token.startsWith('mock_admin_')) staffRole = 'admin';

      return { id, phone, fullName: name, email: `${id}@test.com`, staffRole };
    }
  }

  const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
  const url = `${baseUrl}/auth/v1/user`;
  const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY || '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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

    // If phone is missing from Supabase Auth identity, query public.profiles
    let phone = data.phone || '';
    if (!phone) {
      try {
        const profileRes = await fetch(
          `${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(data.id)}&select=phone,full_name`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            },
          }
        );
        if (profileRes.ok) {
          const profileRows = (await profileRes.json()) as Array<{ phone?: string; full_name?: string }>;
          if (profileRows && profileRows.length > 0 && profileRows[0]?.phone) {
            phone = profileRows[0].phone;
          }
        }
      } catch {
        // Fallback
      }
    }

    // Query server-assigned staff role from PostgreSQL
    const staffRole = await fetchStaffRoleFromSupabase(data.id, config);

    return {
      id: data.id,
      phone,
      email: data.email || null,
      fullName: data.user_metadata?.full_name || data.user_metadata?.name || null,
      staffRole,
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (request.headers.cookie) {
    const cookieStr = request.headers.cookie;
    const match = cookieStr.match(/(?:^|;\s*)(?:moody_session|moody_admin_session|sb-access-token)=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1].trim());
    }
  }
  return null;
}

export function createAuthPreHandler(config: AppConfig) {
  return async function requireCustomerAuth(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const token = extractToken(request);

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
      // Allow checkout requests that carry customerPhone in the request body
      const bodyPhone = (request.body as { customerPhone?: string } | undefined)?.customerPhone;
      if (bodyPhone && typeof bodyPhone === 'string' && bodyPhone.trim()) {
        user.phone = bodyPhone.trim();
      } else {
        reply.status(401).send({
          error: {
            statusCode: 401,
            code: 'UNVERIFIED_PHONE_ACCOUNT',
            message: 'Authenticated account does not have a verified phone number.',
          },
        });
        return;
      }
    }

    request.user = user;
  };
}

export function createStaffAuthPreHandler(config: AppConfig, allowedRoles?: StaffRole[]) {
  return async function requireStaffAuth(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const token = extractToken(request);

    if (!token) {
      reply.status(401).send({
        error: {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Staff authentication required. Please provide a valid Bearer token or session cookie.',
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
          message: 'Staff session token is expired, revoked, or cryptographically invalid.',
        },
      });
      return;
    }

    // Role MUST be verified from the server-managed database
    if (!user.staffRole) {
      reply.status(403).send({
        error: {
          statusCode: 403,
          code: 'FORBIDDEN_NOT_STAFF',
          message: 'Access denied. The authenticated account does not possess active staff authorization.',
        },
      });
      return;
    }

    // Check specific role hierarchy if specified
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.staffRole)) {
      reply.status(403).send({
        error: {
          statusCode: 403,
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Insufficient permissions. This operation requires role: ${allowedRoles.join(' or ')}. Current role: ${user.staffRole}.`,
        },
      });
      return;
    }

    request.user = user;
  };
}
