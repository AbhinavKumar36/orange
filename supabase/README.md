# Moody Orange — Local Supabase Environment

This directory configures the authoritative Supabase PostgreSQL 15+ database layer for the Moody Orange platform.

## Prerequisites
1. **Docker Desktop**: Docker must be running on your machine.
2. **Supabase CLI**: Install via npm (`npm install -g supabase`) or package manager (`brew install supabase/tap/supabase` or `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`).

## Quick Start
```bash
# 1. Start the local Supabase stack
supabase start

# 2. Reset database and apply all migrations & seeds
supabase db reset

# 3. Execute pgTAP database test suite
supabase test db

# 4. Check service status and connection strings
supabase status
# API Gateway:    http://localhost:54321
# PostgreSQL DB:  postgresql://postgres:postgres@localhost:54322/postgres
# Supabase Studio:http://localhost:54323
# Inbucket Mail:  http://localhost:54324

# 5. Stop local Supabase when done
supabase stop
```

## Phase 2 Implemented Structure

### Migrations (`supabase/migrations/`)
1. `20261031180000_core_schema.sql`: 5 ENUMs, 10 core tables, check constraints (`chk_stock_balance`, `chk_cash_no_online_expiry`), and performance indexes.
2. `20261031180100_row_level_security.sql`: `get_staff_role()`, RLS enabled on all 10 tables, explicit client mutation denials, and defense-in-depth table grants.
3. `20261031180200_inventory_and_order_procedures.sql`: 7 hardened `SECURITY DEFINER` stored procedures with `SET search_path = public, pg_temp;` and revoked `PUBLIC` execute access (`rpc_reserve_order_stock`, `rpc_release_expired_reservations`, `rpc_reconcile_late_payment`, `rpc_complete_order_handover`, `rpc_write_off_inventory`, `rpc_cancel_order`, `rpc_issue_refund`).

### Tests (`supabase/tests/`)
- `supabase/tests/database.test.sql`: Complete pgTAP test suite covering table existence, stock balance check constraints, negative price rejection, idempotency, cash order immunity to expiration, protected write-offs, and atomic handover stock deductions.
