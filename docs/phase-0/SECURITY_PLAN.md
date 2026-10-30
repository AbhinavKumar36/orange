# Moody Orange — System Security, Threat Model & Compliance Plan

**Document Version:** 1.4.1 (Phase 0.4.1 Final Blocker Resolution)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Ready for Phase 0 Approval Review  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial threat model and security specifications. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Strict credential isolation to `apps/backend-api`. |
| **1.2.0** | 2026-10-30 | Lead Architect | Phase 0.2 Revision: Server-side authorization architecture and verified JWT extraction. |
| **1.3.0** | 2026-10-30 | Lead Architect | Phase 0.3 Consistency Pass: Customer-scoped idempotency keys, hardened DB functions, RLS matrix. |
| **1.4.0** | 2026-10-30 | Lead Architect | Phase 0.4 Consistency Pass: Dual-layer security, raw-body HMAC, and evidence-based refunds. |
| **1.4.1** | 2026-10-30 | Lead Architect | **Phase 0.4.1 Final Blocker Resolution:**<br>• Delineated action-level permissions: counter staff strictly blocked from catalog/price changes and inventory write-offs.<br>• Added partial refund concurrency locking (`payments` row lock `FOR UPDATE`) and cumulative cap calculation.<br>• Documented inventory write-off protection preventing unassisted stock reduction when units are reserved.<br>• Reaffirmed verification status: controls are documented and specified, not claimed as executed in Phase 0. |

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

## 2. Dual-Layer Security Model

The Moody Orange security architecture enforces controls at two complementary layers:

```
[ Client Request (Web / Android) ]
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: BACKEND API GATEWAY (Node.js / TypeScript)             │
│ • Validates Supabase JWT signature (ES256 / HS256)             │
│ • Derives identity strictly from jwt.sub (ignores request body) │
│ • Validates input schemas via Zod (positive qty, non-empty)     │
│ • Enforces RBAC via staff_roles lookup                          │
│ • Verifies customer-scoped idempotency keys & payload hashes    │
│ • Verifies raw-body HMAC-SHA256 Razorpay webhook signatures     │
│ • Possesses service_role secret for privileged DB execution    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Database Connection Pool (service_role)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: POSTGRESQL DATABASE DEFENSE-IN-DEPTH (Supabase PG 15+)  │
│ • RLS Policies: Defense-in-depth if clients connect directly   │
│ • Hardened SECURITY DEFINER: SET search_path = public, pg_temp │
│ • Explicit Access Control: REVOKE EXECUTE ... FROM PUBLIC      │
│ • CHECK Constraints: physical_stock >= reserved_stock, >= 0    │
│ • Cash Order Invariants: chk_cash_no_online_expiry             │
│ • Deterministic Row Locking: ORDER BY product_id ASC FOR UPDATE│
│ • Atomic State Transitions & Idempotency Storage               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Backend API Authorization Pipeline

Because `apps/backend-api` connects to PostgreSQL using the Supabase Service Role key (which intentionally bypasses Row Level Security), **the Backend API layer is the authoritative authorization gateway**:

1. **Authenticate JWT:** Validate Supabase JWT cryptographic signature. Reject invalid, expired, or missing tokens with `HTTP 401 Unauthorized`.
2. **Extract Identity:** Bind caller identity strictly to `jwt.sub` (UUID). Untrusted user input (`customer_id`, `user_id`) in request bodies or query parameters is strictly ignored.
3. **Authorize Role & Resource Ownership:**
   - **Customer Endpoints:** Ensure requested resource belongs to caller:
     ```sql
     SELECT 1 FROM orders WHERE id = :order_id AND customer_id = :jwt_sub
     ```
     If mismatched: Return `HTTP 403 Forbidden`.
   - **Staff Endpoints:** Query `public.staff_roles` for active roles:
     ```sql
     SELECT role FROM staff_roles WHERE user_id = :jwt_sub AND is_active = true
     ```
     If missing required role: Return `HTTP 403 Forbidden`.
4. **Input Validation & Idempotency Check:** Validate payload schema and verify customer-scoped idempotency key before database execution.
5. **Execute Privileged Transaction:** Call database stored procedures using parameterized queries.

### 2.2 Role-Based Access Control (RBAC) Matrix

| Operation | Anonymous | Customer (JWT) | Counter Staff | Store Manager | System Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Browse Active Catalog** | Allowed | Allowed | Allowed | Allowed | Allowed |
| **Initiate Checkout & Reserve Stock** | Denied | Allowed (own ID) | Denied | Denied | Denied |
| **View Own Orders** | Denied | Allowed (own ID) | Allowed (all) | Allowed (all) | Allowed (all) |
| **Cancel Own Draft / Unpaid Order** | Denied | Allowed (if draft) | Denied | Allowed | Allowed |
| **Live Dispatch Queue Access** | Denied | Denied | Allowed | Allowed | Allowed |
| **Verify Counter Pickup & Complete** | Denied | Denied | Allowed | Allowed | Allowed |
| **Adjust Physical Stock / Spoilage** | Denied | Denied | Denied | Allowed | Allowed |
| **Inventory Write-Off (`rpc_write_off_inventory`)** | Denied | Denied | Denied | Allowed | Allowed |
| **Modify Product Prices & Catalog** | Denied | Denied | Denied | Allowed | Allowed |
| **Initiate Customer Refund** | Denied | Denied | Denied | Allowed | Allowed |
| **Assign or Revoke Staff Roles** | Denied | Denied | Denied | Denied | Allowed |

---

## 3. Checkout Idempotency & Customer Isolation `[CONFIRMED]`

To prevent cross-customer replay attacks, resource exhaustion, or order hijacking:
1. **Customer-Scoped Constraint:** Idempotency keys are stored in `public.orders` with a composite unique constraint: `UNIQUE (customer_id, client_idempotency_key)`. An idempotency key generated by Customer A cannot conflict with, match, or expose orders created by Customer B.
2. **Payload Hash Verification:** When a checkout request arrives with `Idempotency-Key: <UUID>`, the Backend API computes a SHA-256 hash of the canonical request payload (`client_payload_hash`).
   - **Same Key + Same Hash:** Return the existing order representation immediately without re-executing reservation logic or allocating stock again.
   - **Same Key + Different Hash:** Reject immediately with `HTTP 409 Conflict` (`IDEMPOTENCY_PAYLOAD_MISMATCH`).
3. **Lookup Isolation:** An authenticated customer querying by idempotency key can only retrieve orders where `customer_id = jwt.sub`. Any lookup attempting to access another customer's order returns `HTTP 404 Not Found`.

---

## 4. Authoritative Payment & Refund Verification Protocols

### 4.1 Payment Verification Sequence `[CONFIRMED]`
Neither the Backend API nor the database procedures blindly trust client-side callbacks or unverified webhooks:
1. **Raw Body Webhook Signature Check:** The Backend API captures the raw request body buffer and validates `X-Razorpay-Signature` against `RAZORPAY_WEBHOOK_SECRET` using HMAC-SHA256 with constant-time equality check (`crypto.timingSafeEqual`).
2. **Authoritative Field Matching:** Before calling any database procedure, the Backend API verifies:
   - `payment.entity.id` matches provider payment ID format (`pay_*`).
   - `payment.entity.order_id` matches the stored `orders.provider_order_id`.
   - `payment.entity.amount` (in paise) exactly equals `orders.total_amount * 100`.
   - `payment.entity.currency` equals `'INR'`.
   - `payment.entity.status` equals `'captured'`.
3. **Database Invariant Enforcement:** `rpc_reconcile_late_payment` and payment recording procedures independently verify that `p_amount = v_order.total_amount`. Mismatched amounts raise an exception and abort the transaction.
4. **Idempotent Webhook Processing:** Duplicate webhook deliveries are deduplicated against `payments.provider_payment_id`. A second delivery of the same payment event returns `HTTP 200 OK` without creating duplicate payment records or re-transitioning the order.
5. **Conflicting or Unexpected Payments:** If a payment arrives for an unknown order or an order that was cancelled and expired, the event is recorded in `payments` with status `reconciliation_required` or `late_payment_refund_pending`, alerting operations without silently reviving the order or overselling stock.
6. **Cash-at-Pickup Integrity:** Cash orders are initialized with `payment_status = 'unpaid'`. Handover cannot complete until counter staff explicitly verifies and confirms cash receipt, transitioning `payment_status` to `'captured'`.

### 4.2 Refund Ledger Security & Concurrency Controls `[CONFIRMED]`
1. **Payment Row Locking:** When initiating a refund, `rpc_issue_refund` acquires an exclusive row lock on the captured payment record (`SELECT ... FROM payments WHERE ... FOR UPDATE`).
2. **Cumulative Refund Cap Formula:** Stored procedures and API middleware enforce that:
   $$\sum \text{refunds.amount (where status} \in (\text{'refund_pending'}, \text{'refund_processing'}, \text{'refunded'})) + \text{new\_refund} \le \text{payment.amount (where status = 'captured')}$$
   Attempting to refund more than the remaining refundable amount is rejected at both the API and database levels with `HTTP 422 Unprocessable Entity`.
3. **Stable Refund Idempotency Keys:** Every refund dispatch to Razorpay uses a deterministic idempotency key formatted as `rfnd_<payment_id>_<refund_uuid>`.
4. **Network Timeout & Ambiguous Response Handling:**
   - If the API call to Razorpay times out or returns HTTP 5xx, the system **MUST NOT** trigger a blind duplicate refund request.
   - The refund record remains in `refund_pending` or `refund_processing` state.
   - A reconciliation job queries Razorpay (`GET /v1/payments/{payment_id}/refunds`) using the stable idempotency key to determine if the provider processed the refund.
5. **Evidence-Based Progression:** 
   - Gateway HTTP 200 response transitions status to `refund_processing`.
   - Status transitions to `refunded` **only** upon receiving verified webhook `refund.processed`.
   - Webhook `refund.failed` transitions status to `refund_failed` and alerts store management.

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

   REVOKE EXECUTE ON FUNCTION public.rpc_release_expired_reservations FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.rpc_release_expired_reservations TO service_role;

   REVOKE EXECUTE ON FUNCTION public.rpc_reconcile_late_payment FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.rpc_reconcile_late_payment TO service_role;

   REVOKE EXECUTE ON FUNCTION public.rpc_complete_order_handover FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.rpc_complete_order_handover TO service_role;

   REVOKE EXECUTE ON FUNCTION public.rpc_cancel_order FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.rpc_cancel_order TO service_role;

   REVOKE EXECUTE ON FUNCTION public.rpc_write_off_inventory FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.rpc_write_off_inventory TO service_role;

   REVOKE EXECUTE ON FUNCTION public.rpc_issue_refund FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.rpc_issue_refund TO service_role;
   ```
   Direct calls by `anon` or standard `authenticated` database connections are rejected with permission errors.
3. **Static Parameterized Queries:** Dynamic SQL execution (`EXECUTE format(...)`) is avoided. All database operations use static parameterized SQL statements.

---

## 6. Table Row Level Security (RLS) Matrix

RLS is enabled and enforced across all 10 tables as defense-in-depth against accidental direct database exposure:

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

*Direct client INSERT, UPDATE, and DELETE operations on `orders`, `order_items`, `payments`, and `refunds` are denied across all client roles via RLS.*

---

## 7. Credential & Environment Variable Isolation

Private secrets must **NEVER** appear in client-side bundles, version control, or public environment variables:

| Secret / Credential | Permitted Location | Prohibited Locations | Purpose |
| :--- | :--- | :--- | :--- |
| **`SUPABASE_SERVICE_ROLE_KEY`** | `apps/backend-api/.env` | Android app, Customer web, Admin web, Git | Bypasses RLS for authoritative server-side transactions. |
| **`RAZORPAY_KEY_SECRET`** | `apps/backend-api/.env` | Android app, Customer web, Admin web, Git | API authentication for payment verification and refunds. |
| **`RAZORPAY_WEBHOOK_SECRET`**| `apps/backend-api/.env` | Android app, Customer web, Admin web, Git | HMAC-SHA256 signature verification of incoming webhooks. |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Customer web, Admin web | Prohibited from having write access to sensitive tables. | Public client read access governed by RLS. |
| **`RAZORPAY_KEY_ID`** | Android app, Customer web | Allowed in client apps (public identifier). | Initializes client checkout SDK. |
