# Moody Orange — Staff Authorization & RBAC Architecture

This document outlines the security, identity, and role-based access control (RBAC) architecture implemented for the Moody Orange Staff Portal and Admin APIs (Phase 6).

---

## 1. Threat Model & Architectural Principles

1. **Strict Server-Side Authorization Enforcement:**
   Client-supplied roles, claims, query parameters, local cookies, and JWT payload decorations are **never** trusted for authorization. Fastify backend routes verify the identity against Supabase Auth, extract the authenticated `user.id`, and query `public.staff_roles` via server-level database queries (or security-definer procedures) to determine the user's authoritative role.

2. **Customer vs. Staff Segregation:**
   - Customers authenticate via Supabase Phone OTP. They possess no record in `public.staff_roles`.
   - Any customer token attempting to access `/api/v1/admin/*` is immediately rejected with HTTP `403 FORBIDDEN_NOT_STAFF`.
   - Customer web and Android apps never access admin endpoints or expose service-role credentials.

3. **No Service-Role Leakage:**
   `SUPABASE_SERVICE_ROLE_KEY` is exclusively utilized on the trusted Node.js backend. It is strictly excluded from `apps/customer-web`, `apps/admin-web`, and Android client bundles.

4. **Zero Client Privilege Escalation:**
   Staff cannot escalate their own role. Modifying `public.staff_roles` is guarded by Postgres Row Level Security (`staff_manage_roles_policy`), requiring an active `admin` role or direct DBA execution via the service role key.

---

## 2. Staff Roles & Permission Matrix

| Operation / Endpoint | Counter Staff | Store Manager | Administrator |
| :--- | :---: | :---: | :---: |
| **Inspect Own Profile** (`GET /api/v1/admin/me`) | ✅ | ✅ | ✅ |
| **View Operational KPIs** (`GET /api/v1/admin/dashboard`) | ✅ | ✅ | ✅ |
| **View Live Dispatch Queue** (`GET /api/v1/admin/orders`) | ✅ | ✅ | ✅ |
| **Advance Order State** (`PATCH /api/v1/admin/orders/:id/status`) | ✅ | ✅ | ✅ |
| **Complete Counter Handover** (`POST /api/v1/admin/orders/:id/handover`) | ✅ | ✅ | ✅ |
| **Cancel Order** (`POST /api/v1/admin/orders/:id/cancel`) | ❌ | ✅ | ✅ |
| **View Product Catalog** (`GET /api/v1/admin/products`) | ✅ | ✅ | ✅ |
| **Create / Edit Product** (`POST|PUT /api/v1/admin/products`) | ❌ | ✅ | ✅ |
| **Toggle Product Status** (`PATCH /api/v1/admin/products/:id/status`) | ❌ | ✅ | ✅ |
| **Create / Edit Categories** (`POST|PUT /api/v1/admin/categories`) | ❌ | ✅ | ✅ |
| **Delete Category** (`DELETE /api/v1/admin/categories/:id`) | ❌ | ❌ | ✅ |
| **View Inventory Levels** (`GET /api/v1/admin/inventory`) | ✅ | ✅ | ✅ |
| **Restock / Adjust Stock** (`POST /api/v1/admin/inventory/adjust`) | ❌ | ✅ | ✅ |
| **Record Damage Write-off** (`POST /api/v1/admin/inventory/write-off`) | ❌ | ✅ | ✅ |

---

## 3. Database Invariants & Inventory Write-Off Defense

1. **Active Customer Reservation Defense:**
   - An inventory write-off must never cause `physical_stock < reserved_stock`.
   - When a manager records damaged stock via `POST /api/v1/admin/inventory/write-off` or the Postgres procedure `rpc_write_off_inventory`:
     ```sql
     v_unreserved_stock := v_physical_stock - v_reserved_stock;
     IF p_damaged_quantity > v_unreserved_stock THEN
       RAISE EXCEPTION 'INVENTORY_WRITE_OFF_BLOCKED: Damaged quantity (%) exceeds unreserved stock (%). Active customer reservations are impacted.';
     END IF;
     ```
   - If damaged goods breach active customer reservations, the write-off is blocked with HTTP `409 INVENTORY_WRITE_OFF_BLOCKED`. A manager must explicitly cancel and refund the affected customer orders before the stock can be written off.

2. **Counter Handover Cash Enforcement:**
   - Orders placed with payment method `cash_at_pickup` require staff confirmation of physical cash receipt:
     `{ cashCollected: true }`.
   - If `cashCollected` is `false`, handover is rejected with HTTP `400 CASH_NOT_COLLECTED`.
   - When confirmed, `payment_status` transitions to `captured`, `order_status` transitions to `completed`, and physical inventory is decremented atomically.
   - Handover is protected against replay: subsequent handover calls on already completed orders fail with HTTP `409 ORDER_ALREADY_COMPLETED`.

3. **Category Deletion Foreign Key Safety:**
   - Categories with assigned products cannot be deleted. The API returns HTTP `400 CATEGORY_NOT_EMPTY` with the current product count.

---

## 4. Provisioning Staff Roles

### Option A: Using the CLI Provisioning Utility
```bash
# Provision a Counter Staff member
node scripts/provision-admin.mjs --email staff@moodyorange.local --role counter_staff

# Provision a Store Manager
node scripts/provision-admin.mjs --email manager@moodyorange.local --role manager

# Provision an Administrator
node scripts/provision-admin.mjs --email admin@moodyorange.local --role admin
```

### Option B: Direct SQL Execution (Supabase Studio / psql)
```sql
INSERT INTO public.staff_roles (user_id, role, is_active)
SELECT id, 'admin', true
FROM auth.users
WHERE email = 'admin@moodyorange.local'
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true, updated_at = now();
```

