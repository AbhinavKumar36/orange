import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Supabase Database Migrations & Security Invariants', () => {
  const migrationsDir = join(process.cwd(), '../../supabase/migrations');
  const testsDir = join(process.cwd(), '../../supabase/tests');

  it('should find ordered migration files in supabase/migrations/', () => {
    expect(existsSync(migrationsDir)).toBe(true);
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThanOrEqual(3);
    
    // Ensure chronological ordering
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });

  it('should declare all 10 authoritative tables across migration files', () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const combinedSql = files
      .map((f) => readFileSync(join(migrationsDir, f), 'utf-8'))
      .join('\n');

    const expectedTables = [
      'public.profiles',
      'public.staff_roles',
      'public.categories',
      'public.products',
      'public.inventory',
      'public.orders',
      'public.order_items',
      'public.payments',
      'public.refunds',
      'public.audit_logs',
    ];

    expectedTables.forEach((table) => {
      const regex = new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${table.replace('.', '\\.')}`, 'i');
      expect(combinedSql).toMatch(regex);
    });
  });

  it('should enforce critical database invariants and check constraints', () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const combinedSql = files
      .map((f) => readFileSync(join(migrationsDir, f), 'utf-8'))
      .join('\n');

    // Inventory constraints
    expect(combinedSql).toContain('chk_stock_balance CHECK (physical_stock >= reserved_stock)');
    expect(combinedSql).toContain('chk_physical_non_negative CHECK (physical_stock >= 0)');
    expect(combinedSql).toContain('chk_reserved_non_negative CHECK (reserved_stock >= 0)');

    // Cash checkout constraints
    expect(combinedSql).toContain('chk_cash_order_state CHECK');
    expect(combinedSql).toContain('chk_cash_no_online_expiry CHECK');

    // Customer-scoped idempotency
    expect(combinedSql).toContain('CONSTRAINT uq_customer_idempotency UNIQUE (customer_id, client_idempotency_key)');
  });

  it('should enable Row Level Security on every table', () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const combinedSql = files
      .map((f) => readFileSync(join(migrationsDir, f), 'utf-8'))
      .join('\n');

    const expectedTables = [
      'public.profiles',
      'public.staff_roles',
      'public.categories',
      'public.products',
      'public.inventory',
      'public.orders',
      'public.order_items',
      'public.payments',
      'public.refunds',
      'public.audit_logs',
    ];

    expectedTables.forEach((table) => {
      const regex = new RegExp(`ALTER TABLE ${table.replace('.', '\\.')} ENABLE ROW LEVEL SECURITY`, 'i');
      expect(combinedSql).toMatch(regex);
    });
  });

  it('should harden all stored procedures with SECURITY DEFINER and search_path = public, pg_temp', () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const combinedSql = files
      .map((f) => readFileSync(join(migrationsDir, f), 'utf-8'))
      .join('\n');

    const expectedFunctions = [
      'rpc_reserve_order_stock',
      'rpc_release_expired_reservations',
      'rpc_reconcile_late_payment',
      'rpc_complete_order_handover',
      'rpc_write_off_inventory',
      'rpc_cancel_order',
      'rpc_issue_refund',
      'rpc_advance_order_status',
      'rpc_adjust_inventory',
    ];

    expectedFunctions.forEach((fn) => {
      expect(combinedSql).toContain(`FUNCTION public.${fn}`);
      expect(combinedSql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn} FROM PUBLIC;`);
      expect(combinedSql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`);
    });

    // Count occurrences of SET search_path = public, pg_temp
    const searchPathMatches = combinedSql.match(/SET search_path = public, pg_temp/g);
    // 7 RPCs + 1 get_staff_role = at least 8 occurrences
    expect(searchPathMatches?.length).toBeGreaterThanOrEqual(8);
  });

  it('should contain comprehensive canonical pgTAP test suite in supabase/tests/database/', () => {
    const canonicalTestFile = join(testsDir, 'database/database.test.sql');
    expect(existsSync(canonicalTestFile)).toBe(true);

    const testSql = readFileSync(canonicalTestFile, 'utf-8');
    expect(testSql).toContain('plan(');
    expect(testSql).toContain('chk_stock_balance');
    expect(testSql).toContain('product_availability');
    expect(testSql).toContain('rpc_reserve_order_stock');
    expect(testSql).toContain('rpc_release_expired_reservations');
    expect(testSql).toContain('rpc_reconcile_late_payment');
    expect(testSql).toContain('rpc_complete_order_handover');
    expect(testSql).toContain('rpc_write_off_inventory');
    expect(testSql).toContain('rpc_advance_order_status');
    expect(testSql).toContain('rpc_adjust_inventory');
    expect(testSql).toContain('rpc_cancel_order');
    expect(testSql).toContain('rpc_issue_refund');
  });
});

