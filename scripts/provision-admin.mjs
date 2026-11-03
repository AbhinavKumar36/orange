#!/usr/bin/env node

/**
 * Moody Orange - Staff Role Provisioning Script (Hardened)
 *
 * Authorized Provisioning Procedures:
 * 1. Hosted Development Environment:
 *    node scripts/provision-admin.mjs --env development --email staff@company.com --role counter_staff
 *    node scripts/provision-admin.mjs --env development --email manager@company.com --role manager
 *    node scripts/provision-admin.mjs --env development --email admin@company.com --role admin
 *
 * 2. Hosted Staging Environment:
 *    node scripts/provision-admin.mjs --env staging --email manager@staging.moodyorange.com --role manager
 *
 * 3. Production Environment (Requires explicit --confirm-production flag and PROD_SUPABASE_SERVICE_ROLE_KEY):
 *    node scripts/provision-admin.mjs --env production --email authorized-admin@company.com --role admin --confirm-production
 */

import { parseArgs } from 'node:util';
import dotenv from 'dotenv';

dotenv.config();

const options = {
  env: { type: 'string', short: 'e' },
  url: { type: 'string', short: 'u' },
  email: { type: 'string' },
  'user-id': { type: 'string' },
  role: { type: 'string', default: 'counter_staff' },
  'confirm-production': { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h' },
};

const { values } = parseArgs({ options, allowPositionals: true });

function printUsage() {
  console.log(`
🍊 Moody Orange - Staff Role Provisioning Utility

Usage:
  node scripts/provision-admin.mjs --env <development|staging|production> [options]

Required Options:
  -e, --env <env>             Target environment: 'development', 'staging', or 'production' (REQUIRED)
  --email <email>             Email address of the auth.users record to provision
       OR
  --user-id <uuid>            Valid UUID of the auth.users record to provision

Optional Options:
  --role <role>               Role to assign: 'counter_staff', 'manager', 'admin' (default: 'counter_staff')
  --confirm-production        Required safeguard flag when targeting 'production'
  -h, --help                  Show this help and provisioning procedures

Examples:
  # Hosted Development:
  node scripts/provision-admin.mjs --env development --email staff@company.com --role counter_staff
  node scripts/provision-admin.mjs --env development --email manager@company.com --role manager
  node scripts/provision-admin.mjs --env development --email admin@company.com --role admin

  # Hosted Staging:
  node scripts/provision-admin.mjs --env staging --email manager@staging.moodyorange.com --role manager

  # Production Environment:
  node scripts/provision-admin.mjs --env production --email lead-admin@company.com --role admin --confirm-production
`);
}

if (values.help) {
  printUsage();
  process.exit(0);
}

// 1. Validate Target Environment
const targetEnv = (values.env || '').toLowerCase();
const VALID_ENVS = ['development', 'staging', 'production'];

if (targetEnv === 'local') {
  console.error(`❌ Error: '--env local' is no longer supported.`);
  console.error(`   The Moody Orange development workflow operates strictly against hosted Supabase projects.`);
  console.error(`   Please use '--env development' with DEV_SUPABASE_URL (or pass --url <https://...>) to provision a development account.`);
  process.exit(1);
}

if (!targetEnv || !VALID_ENVS.includes(targetEnv)) {
  console.error(`❌ Error: Explicit --env <development|staging|production> is required.`);
  printUsage();
  process.exit(1);
}

// 2. Prevent accidental production provisioning from local development
if (targetEnv === 'production') {
  if (!values['confirm-production']) {
    console.error(`❌ Safeguard Error: Production provisioning requires explicit '--confirm-production' flag.`);
    console.error(`   Run: node scripts/provision-admin.mjs --env production --email <email> --role <role> --confirm-production`);
    process.exit(1);
  }
}

// 3. Validate Role
const VALID_ROLES = ['counter_staff', 'manager', 'admin'];
const targetRole = (values.role || '').toLowerCase();

if (!VALID_ROLES.includes(targetRole)) {
  console.error(`❌ Error: Invalid role '${values.role}'. Must be one of: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

// 4. Validate Identifier
const email = values.email ? values.email.trim() : null;
const userId = values['user-id'] ? values['user-id'].trim() : null;

if (!email && !userId) {
  console.error(`❌ Error: Either --email or --user-id must be provided.`);
  printUsage();
  process.exit(1);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (email && !EMAIL_REGEX.test(email)) {
  console.error(`❌ Error: Invalid email format: '${email}'`);
  process.exit(1);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (userId && !UUID_REGEX.test(userId)) {
  console.error(`❌ Error: Invalid UUID format for --user-id: '${userId}'`);
  process.exit(1);
}

// 5. Resolve and validate target Supabase URL and Service Role Key based on environment
let supabaseUrl = '';
let serviceRoleKey = '';

if (targetEnv === 'production') {
  // STRICT: Production must never silently fall back to generic dev configuration
  supabaseUrl = values.url || process.env.PROD_SUPABASE_URL || '';
  serviceRoleKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl) {
    console.error(`❌ Safeguard Error: Production provisioning requires explicit production Supabase endpoint.`);
    console.error(`   Provide PROD_SUPABASE_URL environment variable or pass --url <https://...>.`);
    console.error(`   Generic SUPABASE_URL fallback is strictly prohibited to prevent cross-environment pollution.`);
    process.exit(1);
  }

  if (!supabaseUrl.startsWith('https://')) {
    console.error(`❌ Safeguard Error: Production Supabase endpoint must use HTTPS. Received: ${supabaseUrl}`);
    process.exit(1);
  }

  const lowerUrl = supabaseUrl.toLowerCase();
  const invalidPatterns = ['localhost', '127.0.0.1', '10.0.2.2', '0.0.0.0', '.local', ':54321', 'example', 'placeholder', 'dummy', 'mock'];
  if (invalidPatterns.some((pattern) => lowerUrl.includes(pattern)) || /(?:192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/.test(lowerUrl)) {
    console.error(`❌ Safeguard Error: Cannot target local host, private network, or placeholder with --env production. Configured: ${supabaseUrl}`);
    process.exit(1);
  }
} else if (targetEnv === 'development') {
  supabaseUrl = values.url || process.env.DEV_SUPABASE_URL || process.env.SUPABASE_URL || '';
  serviceRoleKey = process.env.DEV_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl) {
    console.error(`❌ Error: Development provisioning requires DEV_SUPABASE_URL or SUPABASE_URL environment variable (or --url).`);
    process.exit(1);
  }

  if (!supabaseUrl.startsWith('https://')) {
    console.error(`❌ Error: Hosted development Supabase endpoint must use HTTPS. Received: ${supabaseUrl}`);
    process.exit(1);
  }

  const lowerUrl = supabaseUrl.toLowerCase();
  const invalidPatterns = ['localhost', '127.0.0.1', '10.0.2.2', '0.0.0.0', '.local', ':54321'];
  if (invalidPatterns.some((pattern) => lowerUrl.includes(pattern)) || /(?:192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/.test(lowerUrl)) {
    console.error(`❌ Error: Local Supabase endpoints (localhost, 10.0.2.2, port 54321) are prohibited. Development uses a hosted Supabase project. Configured: ${supabaseUrl}`);
    process.exit(1);
  }
} else {
  // Staging
  supabaseUrl = values.url || process.env.STAGING_SUPABASE_URL || '';
  serviceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl) {
    console.error(`❌ Error: Staging provisioning requires STAGING_SUPABASE_URL or --url.`);
    process.exit(1);
  }
  if (!supabaseUrl.startsWith('https://')) {
    console.error(`❌ Error: Staging Supabase endpoint must use HTTPS. Received: ${supabaseUrl}`);
    process.exit(1);
  }
  const lowerUrl = supabaseUrl.toLowerCase();
  const invalidPatterns = ['localhost', '127.0.0.1', '10.0.2.2', '0.0.0.0', '.local', ':54321'];
  if (invalidPatterns.some((pattern) => lowerUrl.includes(pattern))) {
    console.error(`❌ Error: Local endpoints are prohibited for staging. Configured: ${supabaseUrl}`);
    process.exit(1);
  }
}

console.log(`\n🍊 Moody Orange Staff Role Provisioning`);
console.log(`   Target Environment: ${targetEnv.toUpperCase()}`);
console.log(`   Target Identifier:  ${email || userId}`);
console.log(`   Assigned Role:      ${targetRole}`);
console.log(`   Supabase Endpoint:  ${supabaseUrl}\n`);

async function provision() {
  if (!serviceRoleKey) {
    const safeEmail = email ? email.replace(/'/g, "''") : null;
    const safeUserId = userId ? userId.replace(/'/g, "''") : null;
    const identifierCondition = safeUserId ? `id = '${safeUserId}'::UUID` : `lower(email) = lower('${safeEmail}')`;
    const auditWhere = safeUserId ? `sr.user_id = '${safeUserId}'::UUID` : `lower(u.email) = lower('${safeEmail}')`;

    console.log(`⚠️  ${targetEnv.toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : targetEnv.toUpperCase()} SERVICE-ROLE KEY NOT DETECTED IN ENVIRONMENT.`);
    console.log(`   Direct REST API provisioning was skipped. To provision manually with transactional safety`);
    console.log(`   via Supabase SQL Editor or authorized psql session, execute the following script:`);
    console.log(`
--------------------------------------------------------------------------------
-- MOODY ORANGE AUTHORIZED STAFF ROLE PROVISIONING SCRIPT
-- Target Environment: ${targetEnv.toUpperCase()}
-- Target Endpoint:    ${supabaseUrl}
-- Target Account:     ${email || userId}
-- Target Role:        ${targetRole}
-- Generated:          ${new Date().toISOString()}
--
-- CAUTION: Elevated role assignment. Run only if authorized by access request.
--------------------------------------------------------------------------------
BEGIN;

DO $$
DECLARE
  v_user_id UUID;
  v_target_email TEXT := ${safeEmail ? `'${safeEmail}'` : 'NULL'};
  v_target_user_id UUID := ${safeUserId ? `'${safeUserId}'::UUID` : 'NULL'};
BEGIN
  -- 1. Verify that user exists in auth.users
  IF v_target_user_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM auth.users WHERE id = v_target_user_id;
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_target_email);
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user (%) not found in auth.users. The user must first create an account or be invited in Supabase Auth.',
      COALESCE(v_target_email, v_target_user_id::TEXT);
  END IF;

  -- 2. Upsert staff role with explicit timestamp
  INSERT INTO public.staff_roles (user_id, role, is_active, updated_at)
  VALUES (v_user_id, '${targetRole}', true, TIMEZONE('utc', NOW()))
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = true,
    updated_at = TIMEZONE('utc', NOW());

  -- 3. Record audit trail
  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_values)
  VALUES (
    v_user_id,
    '${targetRole}',
    'MANUAL_STAFF_PROVISIONING',
    'staff_roles',
    v_user_id::TEXT,
    jsonb_build_object('role', '${targetRole}', 'environment', '${targetEnv}', 'timestamp', NOW())
  );
END $$;

-- 4. Verify resulting assignment
SELECT sr.user_id, u.email, sr.role, sr.is_active, sr.updated_at
FROM public.staff_roles sr
JOIN auth.users u ON u.id = sr.user_id
WHERE ${auditWhere};

COMMIT;
--------------------------------------------------------------------------------
`);
    return;
  }

  try {
    let resolvedUserId = userId;

    if (!resolvedUserId && email) {
      // Find user by email using Supabase Auth Admin API (paginated search)
      let page = 1;
      let foundUser = null;
      const perPage = 50;

      while (!foundUser) {
        const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        });

        if (!userRes.ok) {
          const errText = await userRes.text().catch(() => '');
          console.error(`❌ Failed to query auth.users (HTTP ${userRes.status}): ${errText}`);
          process.exit(1);
        }

        const usersData = await userRes.json();
        const usersList = usersData.users || [];
        if (usersList.length === 0) break;

        foundUser = usersList.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (foundUser || usersList.length < perPage) break;
        page++;
      }

      if (foundUser) {
        resolvedUserId = foundUser.id;
      }
    }

    if (!resolvedUserId) {
      console.error(`❌ User not found: Could not locate user with ${email ? `email '${email}'` : `id '${userId}'`} in auth.users.`);
      console.error(`   The user must first create an account or be invited in Supabase Auth before staff role assignment.`);
      process.exit(1);
    }

    // Upsert into public.staff_roles using safe REST parameterized payload
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/staff_roles`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        user_id: resolvedUserId,
        role: targetRole,
        is_active: true,
      }),
    });

    if (!upsertRes.ok) {
      const err = await upsertRes.text().catch(() => '');
      console.error(`❌ Database Error: Failed to assign staff role: ${err}`);
      process.exit(1);
    }

    console.log(`✅ Successfully provisioned ${email || resolvedUserId} as '${targetRole}' in ${targetEnv.toUpperCase()}.`);
  } catch (err) {
    console.error(`❌ Network or configuration error during provisioning:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

provision();
