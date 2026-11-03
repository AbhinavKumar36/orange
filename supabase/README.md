# Moody Orange — Hosted Supabase Database Layer

This directory configures the authoritative Supabase PostgreSQL 15+ database layer for the Moody Orange platform.

## Architecture Requirement: Hosted Services Only

Moody Orange operates strictly against **hosted Supabase projects** (Development, Staging, and Production):
- **No Local Supabase**: Developers do **not** run `supabase start` or `supabase stop`.
- **No Docker Requirement**: Docker Desktop and local PostgreSQL containers are not used.
- **No Local Studio**: Database inspection and administration use the hosted Supabase Dashboard.
- **No Production Testing**: Tests run exclusively against dedicated hosted staging or test databases, never production.

---

## 🗄️ Remote Migration Workflow

All database schema definitions, check constraints, RLS policies, and stored procedures are version-controlled in `supabase/migrations/`:

1. `20261031180000_core_schema.sql`: 5 ENUMs, 10 core tables, check constraints (`chk_stock_balance`, `chk_cash_no_online_expiry`), and performance indexes.
2. `20261031180100_row_level_security.sql`: `get_staff_role()`, RLS enabled on all 10 tables, explicit client mutation denials, and defense-in-depth table grants.
3. `20261031180200_inventory_and_order_procedures.sql`: 7 hardened `SECURITY DEFINER` stored procedures with `SET search_path = public, pg_temp;` and revoked `PUBLIC` execute access.
4. `20261102180000_enforce_checkout_idempotency.sql`: Customer-scoped checkout idempotency enforcement.
5. `20261102190000_inventory_concurrency_procedures.sql`: Strict inventory reservation validation, row-level locking, and atomic handover.

### Applying Migrations to Remote Projects

Apply migrations to your dedicated hosted development or staging database:
```bash
npx supabase db push --db-url "$DEV_SUPABASE_DB_URL"
```

> [!CAUTION]
> Never run `supabase db reset`, `DROP SCHEMA`, or truncate operations on hosted databases. Migrations must be non-destructive and preserve data.

---

## 🧪 Remote Testing Procedures

### 1. Hosted pgTAP Tests
Database integrity tests are defined in `supabase/tests/database/database.test.sql` (76 assertions).
Execute against a dedicated hosted staging/test database using `pg_prove`:
```bash
pg_prove --dbname "$TEST_SUPABASE_DB_URL" supabase/tests/database/database.test.sql
```

### 2. Multi-Session Database Concurrency Tests
Execute real concurrent multi-session transactions against the hosted test database:
```bash
npm run test:db:concurrency
# Or directly:
node scripts/test-database-concurrency.mjs
```

If `TEST_SUPABASE_DB_URL` is not set in the environment, the tests safely report status **BLOCKED** to protect against test pollution of production environments.
