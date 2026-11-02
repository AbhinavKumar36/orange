#!/usr/bin/env node

/**
 * Moody Orange - Staff Role Provisioning Script (Hardened)
 *
 * Authorized Provisioning Procedures:
 * 1. Local Development:
 *    node scripts/provision-admin.mjs --env local --email staff@moodyorange.local --role counter_staff
 *    node scripts/provision-admin.mjs --env local --email manager@moodyorange.local --role manager
 *    node scripts/provision-admin.mjs --env local --email admin@moodyorange.local --role admin
 *
 * 2. Production Environment (Requires explicit --confirm-production flag and PROD_SUPABASE_SERVICE_ROLE_KEY):
 *    node scripts/provision-admin.mjs --env production --email authorized-admin@domain.org --role admin --confirm-production
 */

import { parseArgs } from 'node:util';
import dotenv from 'dotenv';

dotenv.config();

const options = {
  env: { type: 'string', short: 'e' },
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
  node scripts/provision-admin.mjs --env <local|staging|production> [options]

Required Options:
  -e, --env <env>             Target environment: 'local', 'staging', or 'production' (REQUIRED)
  --email <email>             Email address of the auth.users record to provision
       OR
  --user-id <uuid>            Valid UUID of the auth.users record to provision

Optional Options:
  --role <role>               Role to assign: 'counter_staff', 'manager', 'admin' (default: 'counter_staff')
  --confirm-production        Required safeguard flag when targeting 'production'
  -h, --help                  Show this help and provisioning procedures

Examples:
  # Local Development:
  node scripts/provision-admin.mjs --env local --email staff@moodyorange.local --role counter_staff
  node scripts/provision-admin.mjs --env local --email manager@moodyorange.local --role manager
  node scripts/provision-admin.mjs --env local --email admin@moodyorange.local --role admin

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
const VALID_ENVS = ['local', 'staging', 'production'];

if (!targetEnv || !VALID_ENVS.includes(targetEnv)) {
  console.error(`❌ Error: Explicit --env <local|staging|production> is required.`);
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
  supabaseUrl = process.env.PROD_SUPABASE_URL || process.env.SUPABASE_URL || '';
  serviceRoleKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
    console.error(`❌ Safeguard Error: Cannot target local host with --env production. Configured URL: ${supabaseUrl}`);
    process.exit(1);
  }
} else if (targetEnv === 'local') {
  supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // Prevent local dev from silently pointing to remote production
  if (supabaseUrl.startsWith('https://') && !process.env.ALLOW_REMOTE_DEV) {
    console.error(`❌ Safeguard Warning: --env local is configured with remote URL: ${supabaseUrl}`);
    console.error(`   If you intended to provision remote staging/production, use --env staging or --env production.`);
    process.exit(1);
  }
} else {
  // Staging
  supabaseUrl = process.env.STAGING_SUPABASE_URL || process.env.SUPABASE_URL || '';
  serviceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

console.log(`\n🍊 Moody Orange Staff Role Provisioning`);
console.log(`   Target Environment: ${targetEnv.toUpperCase()}`);
console.log(`   Target Identifier:  ${email || userId}`);
console.log(`   Assigned Role:      ${targetRole}`);
console.log(`   Supabase Endpoint:  ${supabaseUrl || '(not configured)'}\n`);

async function provision() {
  if (!serviceRoleKey) {
    console.log(`ℹ️ SUPABASE_SERVICE_ROLE_KEY not detected in environment.`);
    console.log(`   To provision directly via SQL in Supabase Studio or psql:`);
    console.log(`
    INSERT INTO public.staff_roles (user_id, role, is_active)
    SELECT id, '${targetRole}', true
    FROM auth.users
    WHERE ${userId ? `id = '${userId}'` : `email = '${email}'`}
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true, updated_at = now();
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
