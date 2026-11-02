#!/usr/bin/env node

/**
 * Moody Orange - Staff Role Provisioning Script
 *
 * Usage:
 *   node scripts/provision-admin.mjs --email <email> --role <admin|manager|counter_staff>
 *   node scripts/provision-admin.mjs --user-id <uuid> --role <admin|manager|counter_staff>
 */

import { parseArgs } from 'node:util';
import dotenv from 'dotenv';

dotenv.config();

const options = {
  email: { type: 'string' },
  'user-id': { type: 'string' },
  role: { type: 'string', default: 'counter_staff' },
  help: { type: 'boolean', short: 'h' },
};

const { values } = parseArgs({ options, allowPositionals: true });

if (values.help || (!values.email && !values['user-id'])) {
  console.log(`
Moody Orange - Staff Role Provisioning Utility

Options:
  --email <email>       Email of the auth.users record to provision
  --user-id <uuid>      Direct UUID of the auth.users record to provision
  --role <role>         Role to assign: 'counter_staff', 'manager', 'admin' (default: 'counter_staff')
  -h, --help            Show this help message

Examples:
  node scripts/provision-admin.mjs --email staff@moodyorange.local --role counter_staff
  node scripts/provision-admin.mjs --email manager@moodyorange.local --role manager
  node scripts/provision-admin.mjs --email admin@moodyorange.local --role admin
`);
  process.exit(0);
}

const VALID_ROLES = ['counter_staff', 'manager', 'admin'];
const targetRole = values.role.toLowerCase();

if (!VALID_ROLES.includes(targetRole)) {
  console.error(`❌ Error: Invalid role '${values.role}'. Must be one of: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`\n🍊 Moody Orange Staff Role Provisioning`);
console.log(`   Target Identifier: ${values.email || values['user-id']}`);
console.log(`   Assigned Role:     ${targetRole}`);
console.log(`   Target Supabase:   ${SUPABASE_URL}\n`);

async function provision() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.log(`ℹ️ SUPABASE_SERVICE_ROLE_KEY not detected in environment.`);
    console.log(`   To provision directly via SQL in Supabase Studio (http://localhost:54323) or psql:`);
    console.log(`
    INSERT INTO public.staff_roles (user_id, role, is_active)
    SELECT id, '${targetRole}', true
    FROM auth.users
    WHERE email = '${values.email}'
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true, updated_at = now();
`);
    return;
  }

  try {
    let userId = values['user-id'];

    if (!userId && values.email) {
      // Find user by email using Supabase Auth Admin API
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (userRes.ok) {
        const usersData = await userRes.json();
        const found = usersData.users?.find((u) => u.email?.toLowerCase() === values.email.toLowerCase());
        if (found) {
          userId = found.id;
        }
      }
    }

    if (!userId) {
      console.error(`❌ Could not locate user with email '${values.email}' in auth.users.`);
      process.exit(1);
    }

    // Upsert into public.staff_roles
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_roles`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        user_id: userId,
        role: targetRole,
        is_active: true,
      }),
    });

    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      console.error(`❌ Failed to assign staff role: ${err}`);
      process.exit(1);
    }

    console.log(`✅ Successfully provisioned ${values.email || userId} with role: ${targetRole}`);
  } catch (err) {
    console.error(`❌ Provisioning network error:`, err);
    process.exit(1);
  }
}

provision();

