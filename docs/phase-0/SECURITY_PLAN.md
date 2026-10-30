# Moody Orange — System Security, Threat Model & Compliance Plan

**Document Version:** 1.3.0 (Phase 0.3 Final Consistency Pass)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial threat model and security specifications. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Strict credential isolation to `apps/backend-api`. |
| **1.2.0** | 2026-10-30 | Lead Architect | Phase 0.2 Revision: Server-side authorization architecture and verified JWT extraction. |
| **1.3.0** | 2026-10-30 | Lead Architect | **Phase 0.3 Final Consistency Pass:**<br>• Formalized customer-scoped idempotency keys (`customer_id + client_idempotency_key`) with payload hash verification.<br>• Documented authoritative Razorpay payment validation (verifying payment ID, order ID, amount, currency, and signature before DB invocation).<br>• Hardened all `SECURITY DEFINER` procedures with explicit `search_path = public, pg_temp` and restricted `EXECUTE` privileges.<br>• Documented complete RLS coverage across all 10 database tables.<br>• Enforced cumulative refund caps and evidence-based refund confirmation. |

---

## 1. Threat Modeling & STRIDE Matrix

| STRIDE Category | Threat Scenario | Impact | Mandatory Defensive Mitigation | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates another customer to steal items at the counter or claim orders via guessed idempotency key. | Unauthorized order pickup, cross-account data leakage. | Idempotency keys are scoped strictly to authenticated customer (`customer_id + key`). Counter staff must verify customer collection token. | `[CONFIRMED]` |
| **Tampering** | Customer manipulates request payload to purchase an expensive cake for ₹1.00 or submits forged payment amounts. | Commercial financial loss. | **Zero-trust client prices.** Database procedures verify that payment amounts match `orders.total_amount`. Server recalculates all prices from DB tables. | `[CONFIRMED]` |
| **Repudiation** | Staff claims cash was not collected, or customer denies receiving order. | Internal cash theft or customer dispute. | Staff must explicitly check a mandatory "Cash Received" confirmation before closing an order. Comprehensive event logging in `payments` and `audit_logs`. | `[CONFIRMED]` |
| **Information Disclosure** | Scraping customer phone numbers, names, or addresses by enumerating sequential order IDs. | Customer privacy violation, regulatory exposure. | Use non-sequential UUIDs for database IDs. Enforce PostgreSQL Row Level Security (RLS) so customers query strictly where `customer_id = auth.uid()`. | `[CONFIRMED]` |
| **Denial of Service** | Script floods OTP endpoints to exhaust SMS credits, or locks up stock without paying. | Financial drain (SMS costs), legitimate customers blocked by fake stockouts. | Strict IP and phone-number rate limiting on OTP endpoints. 10-minute reservation TTL with automated cleanup. Max 3 pending orders per customer. | `[CONFIRMED]` |
| **Elevation of Privilege** | Customer passes `{ "role": "admin" }` or attempts to invoke privileged database procedures directly. | Full system compromise. | Database procedures revoke `EXECUTE` from `PUBLIC` and grant only to `service_role`. API verifies caller roles against trusted DB records on every request. | `[CONFIRMED]` |

---

## 2. Server-Side Authorization Architecture

Because the Backend API (`apps/backend-api`) connects to PostgreSQL using the Supabase Service Role key (which deliberately bypasses Row Level Security), **the API layer acts as the authoritative security enforcement gateway**:

```
[ Incoming HTTP Request ]
          │
          ▼
   [ 1. Authenticate JWT ]
   Validate Supabase JWT via cryptographic signature (ES256 / HS256)
   └── (Invalid / Missing / Expired) ──► HTTP 401 Unauthorized
          │
          ▼
   [ 2. Extract Caller Identity ]
   Identity = jwt.sub (UUID). NEVER accept customer_id from request body or query params.
          │
          ▼
   [ 3. Authorize Role & Resource Ownership ]
     ├─► Customer Route: Ensure target resource belongs to caller:
     │     SELECT 1 FROM orders WHERE id = :order_id AND customer_id = :jwt_sub
     │     └── Not Owner ──► HTTP 403 Forbidden
     │
     └─► Staff Route: Query public.staff_roles for :jwt_sub:
           SELECT role FROM staff_roles WHERE user_id = :jwt_sub AND is_active = true
           └── Lacks Required Role ──► HTTP 403 Forbidden
          │
          ▼
   [ 4. Input Validation & Payload Hash Verification ]
   Validate payload with Zod; verify idempotency key scope
          │
          ▼
   [ 5. Execute Privileged Database Transaction / RPC ]
```

### 2.1 Role-Based Access Control (RBAC) Matrix

| Operation | Anonymous | Customer (JWT) | Counter Staff | Store Manager | System Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Browse Active Catalog** | Allowed | Allowed | Allowed | Allowed | Allowed |
| **Initiate Checkout & Reserve Stock** | Denied | Allowed (own ID) | Denied | Denied | Denied |
| **View Own Orders** | Denied | Allowed (own ID) | Allowed (all) | Allowed (all) | Allowed (all) |
| **Cancel Own Unprepared Order** | Denied | Allowed (if draft) | Denied | Allowed | Allowed |
| **Live Dispatch Queue Access** | Denied | Denied | Allowed | Allowed | Allowed |
| **Verify Counter Pickup & Complete** | Denied | Denied | Allowed | Allowed | Allowed |
| **Adjust Physical Stock / Spoilage** | Denied | Denied | Denied | Allowed | Allowed |
| **Modify Product Prices & Catalog** | Denied | Denied | Denied | Allowed | Allowed |
| **Initiate Customer Refund** | Denied | Denied | Denied | Allowed | Allowed |
| **Assign or Revoke Staff Roles** | Denied | Denied | Denied | Denied | Allowed |

---

## 3. Checkout Idempotency & Customer Scoping `[CONFIRMED]`

To prevent cross-customer replay attacks or data leaks:
1. **Scoped Storage:** Idempotency keys are stored in `public.orders` with a composite unique constraint: `UNIQUE (customer_id, client_idempotency_key)`. A customer guessing another customer's idempotency key will never match.
2. **Payload Hash Verification:** When a checkout request arrives, the server computes a SHA-256 hash of the canonical request payload (`client_payload_hash`).
   - If the key exists for the customer and the hash matches: Return the existing draft order.
   - If the key exists but the hash differs (mismatched items or fulfillment): Reject immediately with `HTTP 409 Conflict` ("Idempotency key reused with mismatched order payload").

---

## 4. Authoritative Payment & Refund Verification Protocols

### 4.1 Payment Verification Sequence `[CONFIRMED]`
Neither the Backend API nor the database procedures blindly trust payment notifications:
1. **Webhook Signature Check:** The Backend API validates `X-Razorpay-Signature` against `RAZORPAY_WEBHOOK_SECRET` using HMAC-SHA256 with constant-time equality check (`crypto.timingSafeEqual`).
2. **Authoritative Field Matching:** Before calling the database procedure, the Backend API verifies:
   - `payment.entity.id` matches provider payment ID format (`pay_*`).
   - `payment.entity.order_id` matches the stored `orders.provider_order_id`.
   - `payment.entity.amount` (in paise) exactly equals `orders.total_amount * 100`.
   - `payment.entity.currency` equals `'INR'`.
   - `payment.entity.status` equals `'captured'`.
3. **Database Invariant Enforcement:** `rpc_reconcile_late_payment` and payment recording procedures independently verify that `p_amount = v_order.total_amount`. Mismatched amounts raise an exception and abort the transaction.

### 4.2 Refund Ledger Security & Cumulative Cap Enforcement `[CONFIRMED]`
1. **Idempotency Key Enforcement:** Every refund request includes a unique `idempotency_key` (e.g., `rfnd_<order_id>_<timestamp>`).
2. **Cumulative Refund Cap:** Stored procedures and API middleware enforce that:
   $$\sum \text{refunds.amount (where status} \neq \text{'refund_failed')} + \text{new\_refund} \le \text{payment.amount (where status = 'captured')}$$
   Attempting to refund more than the captured order amount is rejected at the database level.
3. **Evidence-Based Progression:** Gateway HTTP 200 acceptance transitions status to `refund_processing`. Status becomes `refunded` **only** upon receiving verified webhook `refund.processed`.

---

## 5. Database Function Hardening & Privilege Boundaries

All stored procedures in PostgreSQL are hardened against SQL injection, search path hijacking, and unauthorized invocation:

1. **Explicit Search Path:** Every `SECURITY DEFINER` function explicitly sets:
   ```sql
   SET search_path = public, pg_temp;
   ```
   This prevents malicious search-path hijacking attacks where untrusted users create objects in temporary schemas.
2. **Restricted Execute Permissions:** By default, PostgreSQL grants `EXECUTE` on new functions to `PUBLIC`. All sensitive procedures explicitly revoke public access:
   ```sql
   REVOKE EXECUTE ON FUNCTION public.rpc_reserve_order_stock FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.rpc_reserve_order_stock TO service_role;
   ```
   Direct calls by `anon` or standard `authenticated` database connections are rejected with permission errors.
3. **Static Parameterized Queries:** Dynamic SQL execution (`EXECUTE format(...)`) is avoided. All database operations use static parameterized SQL statements.

---

## 6. Complete Table Row Level Security (RLS) Matrix

| Table Name | Anon Access | Authenticated Customer Access | Staff / Counter Access | Manager / Admin Access | Service Role Access |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`profiles`** | Denied | SELECT / UPDATE (own record) | SELECT (all) | SELECT (all) | ALL (via API) |
| **`staff_roles`** | Denied | Denied | SELECT (own role) | SELECT / ALL (admins only) | ALL (via API) |
| **`categories`** | SELECT (active) | SELECT (active) | SELECT (all) | ALL (manage catalog) | ALL (via API) |
| **`products`** | SELECT (active) | SELECT (active) | SELECT (all) | ALL (manage catalog) | ALL (via API) |
| **`inventory`** | SELECT (public) | SELECT (public) | SELECT (public) | UPDATE (adjust stock) | ALL (via API) |
| **`orders`** | Denied | SELECT (own orders only) | SELECT / UPDATE (all) | SELECT / UPDATE (all) | ALL (via API) |
| **`order_items`** | Denied | SELECT (own orders only) | SELECT (all) | SELECT (all) | ALL (via API) |
| **`payments`** | Denied | SELECT (own orders only) | SELECT (all) | SELECT (all) | ALL (via API) |
| **`refunds`** | Denied | SELECT (own orders only) | SELECT (all) | SELECT (all) | ALL (via API) |
| **`audit_logs`** | Denied | Denied | Denied | SELECT (admins only) | ALL (via API) |

*Direct client INSERT, UPDATE, and DELETE operations on `orders`, `order_items`, `payments`, and `refunds` are denied across all user roles via RLS.*
