#!/usr/bin/env node

/**
 * Moody Orange — Real PostgreSQL Database Concurrency & Invariant Test Suite
 *
 * This test suite executes genuine multi-session, concurrent database operations
 * against a dedicated hosted PostgreSQL/Supabase test database using separate
 * database connections (pg.Client).
 *
 * It verifies:
 * 1. Two simultaneous handover requests for the same order (exactly 1 succeeds).
 * 2. Two simultaneous write-offs exceeding available stock (serialized, exactly 1 succeeds).
 * 3. Simultaneous handover and write-off against the same inventory row (invariants preserved).
 * 4. Exact final physical and reserved stock values.
 * 5. Exactly one successful handover for a given order.
 * 6. Non-negative stock invariant (physical >= 0, reserved >= 0).
 * 7. Stock balance invariant (physical_stock >= reserved_stock).
 * 8. Atomic rollback on multi-item order when one item fails validation.
 *
 * Safeguards:
 * - Requires explicit TEST_SUPABASE_DB_URL or TEST_DB_URL.
 * - Rejects any connection string referencing production.
 * - Safely marks tests BLOCKED if test connection is not configured.
 */

import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

const testDbUrl =
  process.env.TEST_SUPABASE_DB_URL ||
  process.env.TEST_DB_URL ||
  process.env.STAGING_SUPABASE_DB_URL ||
  '';

// Safeguard against production targeting
function assertNotProduction(url) {
  const lower = (url || '').toLowerCase();
  const prodKeywords = ['prod', 'production', 'live'];
  if (prodKeywords.some((kw) => lower.includes(kw))) {
    console.error('❌ CRITICAL SECURITY ERROR: Connection string appears to point to production!');
    console.error(`   Received URL contains production indicators. Concurrency tests against production are strictly forbidden.`);
    process.exit(1);
  }
}

if (!testDbUrl) {
  console.log(`
================================================================================
🍊 Moody Orange — PostgreSQL Database Concurrency & Invariant Test Suite
================================================================================
STATUS: BLOCKED

Reason: No dedicated hosted test database connection string detected.

To execute real multi-session database concurrency tests:
  1. Provision a dedicated hosted development or staging Supabase project.
  2. Set environment variable:
     export TEST_SUPABASE_DB_URL="$YOUR_HOSTED_TEST_DB_URL"
  3. Ensure migrations are applied:
     npx supabase db push --db-url "$TEST_SUPABASE_DB_URL"
  4. Run this script again:
     npm run test:db:concurrency

Safeguard Rules:
  - NEVER point TEST_SUPABASE_DB_URL to production.
  - Local database daemons ('supabase start', local Postgres) are prohibited.
  - In-memory mock tests are NEVER substituted for database concurrency tests.
================================================================================
`);
  process.exit(0);
}

assertNotProduction(testDbUrl);

async function runConcurrencyTests() {
  console.log(`
================================================================================
🍊 Moody Orange — PostgreSQL Database Concurrency & Invariant Test Suite
================================================================================
Target Database: Dedicated Hosted Test Database
Initiating concurrent database client connections...
`);

  const client1 = new Client({ connectionString: testDbUrl, ssl: { rejectUnauthorized: false } });
  const client2 = new Client({ connectionString: testDbUrl, ssl: { rejectUnauthorized: false } });

  await Promise.all([client1.connect(), client2.connect()]);
  console.log('✅ Two independent PostgreSQL sessions established successfully.\n');

  let passedTests = 0;
  let totalTests = 8;

  try {
    // -------------------------------------------------------------------------
    // Setup Test Data Harness
    // -------------------------------------------------------------------------
    const customerId = randomUUID();
    const staffId = randomUUID();
    const managerId = randomUUID();
    const categoryId = randomUUID();

    // Ensure staff roles exist for test actor UUIDs
    await client1.query(`
      INSERT INTO public.categories (id, name, slug)
      VALUES ($1, 'Concurrency Test Category', 'concurrency-cat-${Date.now()}')
      ON CONFLICT DO NOTHING;
    `, [categoryId]);

    await client1.query(`
      INSERT INTO public.staff_roles (user_id, role, is_active)
      VALUES 
        ($1, 'counter_staff', true),
        ($2, 'manager', true)
      ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
    `, [staffId, managerId]);

    // -------------------------------------------------------------------------
    // TEST 1 & 5: Two simultaneous handover requests for the same order
    // -------------------------------------------------------------------------
    console.log('🧪 Test 1 & 5: Two simultaneous handover requests for the same order...');
    {
      const prodId = randomUUID();
      const orderId = randomUUID();

      await client1.query(`
        INSERT INTO public.products (id, category_id, name, slug, description, base_price, tax_rate_pct, is_veg)
        VALUES ($1, $2, 'Concurrent Truffle', 'concurrent-truffle-${Date.now()}', 'Desc', 50000, 5.0, true);
        
        INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
        VALUES ($1, 20, 2);

        INSERT INTO public.orders (
          id, order_number, customer_id, customer_phone, customer_name,
          fulfillment_type, order_status, payment_status, payment_method,
          subtotal_amount, tax_amount, packaging_amount, total_amount
        ) VALUES (
          $2, 'MO-CONC-1-${Date.now()}', $3, '+919876543210', 'Test Customer',
          'counter_pickup', 'ready_for_pickup', 'captured', 'online_upi',
          100000, 5000, 0, 105000
        );

        INSERT INTO public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, tax_rate_snapshot, quantity, line_total)
        VALUES ($4, $2, $1, 'Concurrent Truffle', 50000, 5.0, 2, 100000);
      `, [prodId, categoryId, customerId, randomUUID()]);

      // Fire simultaneous handover queries from both clients
      const [res1, res2] = await Promise.allSettled([
        client1.query('SELECT public.rpc_complete_order_handover($1, $2, false)', [orderId, staffId]),
        client2.query('SELECT public.rpc_complete_order_handover($1, $2, false)', [orderId, staffId]),
      ]);

      const successCount = [res1, res2].filter((r) => r.status === 'fulfilled').length;
      const rejectCount = [res1, res2].filter((r) => r.status === 'rejected').length;

      if (successCount !== 1 || rejectCount !== 1) {
        throw new Error(`Expected exactly 1 handover success and 1 rejection. Got ${successCount} successes and ${rejectCount} rejections.`);
      }

      // Verify exact final physical and reserved stock values
      const invCheck = await client1.query('SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = $1', [prodId]);
      const finalPhys = invCheck.rows[0].physical_stock;
      const finalRes = invCheck.rows[0].reserved_stock;

      if (finalPhys !== 18 || finalRes !== 0) {
        throw new Error(`Expected physical_stock=18 and reserved_stock=0. Found physical=${finalPhys}, reserved=${finalRes}`);
      }

      const orderCheck = await client1.query('SELECT order_status FROM public.orders WHERE id = $1', [orderId]);
      if (orderCheck.rows[0].order_status !== 'completed') {
        throw new Error(`Expected order status 'completed', found '${orderCheck.rows[0].order_status}'`);
      }

      console.log('   ✅ PASS: Exactly 1 handover succeeded, 1 rejected. Stock decremented exactly once (20->18, 2->0).');
      passedTests += 2;
    }

    // -------------------------------------------------------------------------
    // TEST 2: Two simultaneous write-offs that together exceed available stock
    // -------------------------------------------------------------------------
    console.log('\n🧪 Test 2: Two simultaneous write-offs exceeding available stock...');
    {
      const prodId = randomUUID();
      await client1.query(`
        INSERT INTO public.products (id, category_id, name, slug, description, base_price, tax_rate_pct, is_veg)
        VALUES ($1, $2, 'Writeoff Test Cake', 'writeoff-cake-${Date.now()}', 'Desc', 40000, 5.0, true);

        INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
        VALUES ($1, 10, 0);
      `, [prodId, categoryId]);

      // Both try to write off 6 units simultaneously (6 + 6 = 12 > 10 available)
      const [w1, w2] = await Promise.allSettled([
        client1.query('SELECT * FROM public.rpc_adjust_inventory($1, -6, $2, $3)', [prodId, managerId, 'Damage 1']),
        client2.query('SELECT * FROM public.rpc_adjust_inventory($1, -6, $2, $3)', [prodId, managerId, 'Damage 2']),
      ]);

      const wSuccess = [w1, w2].filter((r) => r.status === 'fulfilled').length;
      const wReject = [w1, w2].filter((r) => r.status === 'rejected').length;

      if (wSuccess !== 1 || wReject !== 1) {
        throw new Error(`Expected exactly 1 write-off success and 1 rejection. Got ${wSuccess} successes and ${wReject} rejections.`);
      }

      const invCheck = await client1.query('SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = $1', [prodId]);
      if (invCheck.rows[0].physical_stock !== 4 || invCheck.rows[0].reserved_stock !== 0) {
        throw new Error(`Expected physical_stock=4, reserved_stock=0. Got physical=${invCheck.rows[0].physical_stock}`);
      }

      console.log('   ✅ PASS: Exactly 1 write-off succeeded; 2nd rejected. Physical stock correctly left at 4.');
      passedTests++;
    }

    // -------------------------------------------------------------------------
    // TEST 3 & 4: Simultaneous handover and write-off against same inventory row
    // -------------------------------------------------------------------------
    console.log('\n🧪 Test 3 & 4: Simultaneous handover and write-off on same inventory row...');
    {
      const prodId = randomUUID();
      const orderId = randomUUID();

      await client1.query(`
        INSERT INTO public.products (id, category_id, name, slug, description, base_price, tax_rate_pct, is_veg)
        VALUES ($1, $2, 'Race Product', 'race-prod-${Date.now()}', 'Desc', 30000, 5.0, true);

        INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
        VALUES ($1, 10, 5);

        INSERT INTO public.orders (
          id, order_number, customer_id, customer_phone, customer_name,
          fulfillment_type, order_status, payment_status, payment_method,
          subtotal_amount, tax_amount, packaging_amount, total_amount
        ) VALUES (
          $2, 'MO-RACE-${Date.now()}', $3, '+919876543210', 'Race Customer',
          'counter_pickup', 'ready_for_pickup', 'captured', 'online_upi',
          150000, 7500, 0, 157500
        );

        INSERT INTO public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, tax_rate_snapshot, quantity, line_total)
        VALUES ($4, $2, $1, 'Race Product', 30000, 5.0, 5, 150000);
      `, [prodId, categoryId, customerId, randomUUID()]);

      // Handover takes 5. Write-off attempts to remove 8 (available stock is 10 - 5 = 5, so write-off of 8 must fail)
      const [hRes, wRes] = await Promise.allSettled([
        client1.query('SELECT public.rpc_complete_order_handover($1, $2, false)', [orderId, staffId]),
        client2.query('SELECT * FROM public.rpc_adjust_inventory($1, -8, $2, $3)', [prodId, managerId, 'Excess Writeoff']),
      ]);

      if (hRes.status !== 'fulfilled') {
        throw new Error(`Handover should have succeeded. Error: ${hRes.reason?.message}`);
      }
      if (wRes.status !== 'rejected') {
        throw new Error(`Write-off of 8 should have been rejected (exceeds available stock).`);
      }

      const invCheck = await client1.query('SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = $1', [prodId]);
      if (invCheck.rows[0].physical_stock !== 5 || invCheck.rows[0].reserved_stock !== 0) {
        throw new Error(`Expected physical=5, reserved=0. Got physical=${invCheck.rows[0].physical_stock}, reserved=${invCheck.rows[0].reserved_stock}`);
      }

      console.log('   ✅ PASS: Handover succeeded; concurrent excess write-off rejected. Invariants strictly preserved.');
      passedTests += 2;
    }

    // -------------------------------------------------------------------------
    // TEST 6 & 7: Check constraints (No negative stock, physical >= reserved)
    // -------------------------------------------------------------------------
    console.log('\n🧪 Test 6 & 7: Non-negative & stock balance constraint verification...');
    {
      const prodId = randomUUID();
      await client1.query(`
        INSERT INTO public.products (id, category_id, name, slug, description, base_price, tax_rate_pct, is_veg)
        VALUES ($1, $2, 'Constraint Product', 'constraint-prod-${Date.now()}', 'Desc', 20000, 5.0, true);

        INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
        VALUES ($1, 5, 2);
      `, [prodId, categoryId]);

      // Attempt direct illegal adjustment resulting in physical < reserved
      let caughtBalance = false;
      try {
        await client1.query('SELECT * FROM public.rpc_adjust_inventory($1, -4, $2, $3)', [prodId, managerId, 'Illegal drop']);
      } catch (err) {
        caughtBalance = true;
      }
      if (!caughtBalance) {
        throw new Error('Database allowed adjustment where physical_stock < reserved_stock!');
      }

      // Check DB constraint directly
      let caughtNegative = false;
      try {
        await client1.query('UPDATE public.inventory SET physical_stock = -1 WHERE product_id = $1', [prodId]);
      } catch (err) {
        caughtNegative = true;
      }
      if (!caughtNegative) {
        throw new Error('Database allowed negative physical_stock!');
      }

      console.log('   ✅ PASS: Database check constraints reject physical < reserved and physical < 0.');
      passedTests += 2;
    }

    // -------------------------------------------------------------------------
    // TEST 8: Atomic rollback when multi-product order has one invalid item
    // -------------------------------------------------------------------------
    console.log('\n🧪 Test 8: Atomic rollback on multi-item order with partial inventory failure...');
    {
      const prodValid = randomUUID();
      const prodInvalid = randomUUID();
      const orderId = randomUUID();

      await client1.query(`
        INSERT INTO public.products (id, category_id, name, slug, description, base_price, tax_rate_pct, is_veg)
        VALUES 
          ($1, $3, 'Valid Prod', 'valid-prod-${Date.now()}', 'Desc', 10000, 5.0, true),
          ($2, $3, 'Invalid Prod', 'invalid-prod-${Date.now()}', 'Desc', 10000, 5.0, true);

        -- prodValid has plenty of stock
        INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
        VALUES ($1, 50, 10);

        -- prodInvalid has INSUFFICIENT reserved stock (needs 5, only has 2 reserved)
        INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
        VALUES ($2, 10, 2);

        INSERT INTO public.orders (
          id, order_number, customer_id, customer_phone, customer_name,
          fulfillment_type, order_status, payment_status, payment_method,
          subtotal_amount, tax_amount, packaging_amount, total_amount
        ) VALUES (
          $4, 'MO-MULTI-FAIL-${Date.now()}', $5, '+919876543210', 'Multi Customer',
          'counter_pickup', 'ready_for_pickup', 'captured', 'online_upi',
          20000, 1000, 0, 21000
        );

        INSERT INTO public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, tax_rate_snapshot, quantity, line_total)
        VALUES 
          ($6, $4, $1, 'Valid Prod', 10000, 5.0, 5, 10000),
          ($7, $4, $2, 'Invalid Prod', 10000, 5.0, 5, 10000);
      `, [prodValid, prodInvalid, categoryId, orderId, customerId, randomUUID(), randomUUID()]);

      let handoverError = null;
      try {
        await client1.query('SELECT public.rpc_complete_order_handover($1, $2, false)', [orderId, staffId]);
      } catch (err) {
        handoverError = err;
      }

      if (!handoverError) {
        throw new Error('Expected handover to fail due to insufficient reserved stock on item 2.');
      }
      if (!handoverError.message.includes('INSUFFICIENT_RESERVED_STOCK')) {
        throw new Error(`Expected INSUFFICIENT_RESERVED_STOCK error, got: ${handoverError.message}`);
      }

      // Verify that Item 1 inventory was NOT decremented (strictly atomic rollback)
      const validInv = await client1.query('SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = $1', [prodValid]);
      if (validInv.rows[0].physical_stock !== 50 || validInv.rows[0].reserved_stock !== 10) {
        throw new Error(`Atomic rollback failed! Prod 1 stock was modified: physical=${validInv.rows[0].physical_stock}, reserved=${validInv.rows[0].reserved_stock}`);
      }

      const orderCheck = await client1.query('SELECT order_status FROM public.orders WHERE id = $1', [orderId]);
      if (orderCheck.rows[0].order_status !== 'ready_for_pickup') {
        throw new Error(`Order status was modified despite transaction failure: ${orderCheck.rows[0].order_status}`);
      }

      console.log('   ✅ PASS: Transaction rolled back completely. Valid item stock untouched; order remains ready_for_pickup.');
      passedTests++;
    }

    console.log(`
================================================================================
🎉 CONCURRENCY TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED
All PostgreSQL row-level locks, invariant checks, and atomic rollbacks verified.
================================================================================
`);
  } finally {
    await client1.end().catch(() => {});
    await client2.end().catch(() => {});
  }
}

runConcurrencyTests().catch((err) => {
  console.error('\n❌ Concurrency Test Suite Failed:', err.message);
  process.exit(1);
});
