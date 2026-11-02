import type { FastifyPluginAsync } from 'fastify';
import {
  API_VERSION_PREFIX,
  UpdateProfileRequestSchema,
  type CustomerProfile,
} from '@orange/api-contracts';
import { type AppConfig } from '../config/env.js';
import { createAuthPreHandler } from '../plugins/auth.js';

interface ProfilePluginOptions {
  config: AppConfig;
}

export const profileRoutes: FastifyPluginAsync<ProfilePluginOptions> = async (app, options) => {
  const config = options.config;
  const requireAuth = createAuthPreHandler(config);

  // In-memory profile storage for local test/dev mode when ALLOW_MOCK_SERVICES is enabled
  const mockProfiles = new Map<string, CustomerProfile>();

  // GET /api/v1/profile
  app.get(
    `${API_VERSION_PREFIX}/profile`,
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;

      // Check mock profiles in test mode
      if (config.ALLOW_MOCK_SERVICES && mockProfiles.has(user.id)) {
        return reply.status(200).send({ profile: mockProfiles.get(user.id) });
      }

      // Query Supabase public.profiles table
      const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
      const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY || '';
      const url = `${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,phone,full_name,email`;

      try {
        const res = await fetch(url, {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const rows = (await res.json()) as Array<{
            id: string;
            phone: string;
            full_name: string | null;
            email: string | null;
          }>;

          if (rows && rows.length > 0) {
            const row = rows[0];
            const profile: CustomerProfile = {
              id: row.id,
              phone: row.phone,
              fullName: row.full_name,
              email: row.email,
            };
            return reply.status(200).send({ profile });
          }
        }
      } catch {
        // Fallback to auth identity if database is down or in mock
      }

      const profile: CustomerProfile = {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName || null,
        email: user.email || null,
      };

      return reply.status(200).send({ profile });
    }
  );

  // PUT /api/v1/profile
  app.put(
    `${API_VERSION_PREFIX}/profile`,
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const parseResult = UpdateProfileRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Invalid profile update request.',
            details: parseResult.error.issues,
          },
        });
      }

      const { fullName } = parseResult.data;

      // Update in-memory mock if enabled
      if (config.ALLOW_MOCK_SERVICES) {
        const updated: CustomerProfile = {
          id: user.id,
          phone: user.phone,
          fullName,
          email: user.email || null,
        };
        mockProfiles.set(user.id, updated);
      }

      // Upsert into Supabase public.profiles table
      const baseUrl = config.SUPABASE_URL.replace(/\/+$/, '');
      const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY || '';
      const url = `${baseUrl}/rest/v1/profiles`;

      try {
        await fetch(url, {
          method: 'POST',
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            id: user.id,
            phone: user.phone,
            full_name: fullName,
            email: user.email || null,
            updated_at: new Date().toISOString(),
          }),
        });
      } catch {
        // Log in production
      }

      const profile: CustomerProfile = {
        id: user.id,
        phone: user.phone,
        fullName,
        email: user.email || null,
      };

      return reply.status(200).send({ profile });
    }
  );
};
