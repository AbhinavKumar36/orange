# Moody Orange — System Security, Threat Model & Compliance Plan

**Document Version:** 1.2.0 (Phase 0.2 Final Consistency Review)  
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
| **1.2.0** | 2026-10-30 | Lead Architect | **Phase 0.2 Final Consistency Review:**<br>• Formalized server-side authorization architecture to account for Service Role key bypassing RLS.<br>• Mandated customer identity extraction strictly from verified JWT `sub`, prohibiting body-asserted IDs.<br>• Established server-controlled staff role checks and multi-product row lock invariants.<br>• Specified refund idempotency and double-refund prevention protocols.<br>• Audited requirement classifications. |

---

## 1. Threat Modeling & STRIDE Matrix

| STRIDE Category | Threat Scenario | Impact | Mandatory Defensive Mitigation | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates another customer to steal cake/juices at the counter. | Unauthorized order pickup, theft of goods. | Counter staff must verify customer collection token (PIN / QR / Order ID) and phone number. | `[CONFIRMED]` |
| **Tampering** | Customer manipulates request payload to purchase an expensive cake for ₹1.00. | Commercial financial loss. | **Zero-trust client prices.** Server recalculates all subtotals, taxes, and packaging fees from database tables. Client prices are completely discarded. | `[CONFIRMED]` |
| **Repudiation** | Staff claims cash was not collected, or customer denies receiving order. | Internal cash theft or customer dispute. | Staff must explicitly check a mandatory "Cash Received" confirmation before closing an order. Comprehensive event logging in `payments` and `audit_logs`. | `[CONFIRMED]` |
| **Information Disclosure** | Scraping customer phone numbers, names, or addresses by enumerating sequential order IDs. | Customer privacy violation, regulatory exposure. | Use non-sequential UUIDs for database IDs. Enforce PostgreSQL Row Level Security (RLS) so customers query strictly where `customer_id = auth.uid()`. | `[CONFIRMED]` |
| **Denial of Service** | Script floods OTP endpoints to exhaust SMS credits, or locks up stock without paying. | Financial drain (SMS costs), legitimate customers blocked by fake stockouts. | Strict IP and phone-number rate limiting on OTP endpoints. 10-minute reservation TTL with automated cleanup. Max 3 pending orders per customer. | `[CONFIRMED]` |
| **Elevation of Privilege** | Customer passes `{ "role": "admin" }` or attempts to assign themselves a staff role. | Full system compromise. | Database-enforced Role-Based Access Control (`staff_roles`). Backend API checks caller role against trusted DB records on every privileged request. | `[CONFIRMED]` |

---

## 2. Server-Side Authorization Architecture

Because the Backend API (`apps/backend-api`) connects to PostgreSQL using the Supabase Service Role key (which bypasses Row Level Security), **the API layer must authoritatively execute authentication, ownership validation, and role authorization before issuing any database mutation**:

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
   [ 4. Execute Privileged Database Transaction / RPC ]
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

## 3. Strict Credential Isolation & Boundary Protection

> [!CAUTION]
> **The Supabase Service Role Key, Razorpay Key Secret, and Webhook Secret must exist ONLY in the backend server environment (`apps/backend-api/.env`).** Under no circumstances may privileged keys be embedded in client-side code bundles or Android APKs.

| Credential | Scope | Where Stored / Exposed | Prohibited Locations |
| :--- | :--- | :--- | :--- |
| **Supabase Anon Key** | Public Read / Auth Init | Public Client Code (Next.js public env, Android `BuildConfig`) | Safe for public exposure (guarded by RLS) |
| **Supabase Service Role Key** | Database Superuser Access | **Standalone Backend API ONLY (`apps/backend-api/.env`)** | **STRICTLY FORBIDDEN** in Customer Web, Admin Web, Android APK, Git |
| **Razorpay Key ID** | Public Merchant ID | Client Checkout UI & Backend API | Publicly visible (safe) |
| **Razorpay Key Secret** | Financial Capture & Refunds | **Standalone Backend API ONLY (`apps/backend-api/.env`)** | **STRICTLY FORBIDDEN** in Web client bundles, Android APK, Git |
| **Razorpay Webhook Secret** | Webhook HMAC Verification | **Standalone Backend API ONLY (`apps/backend-api/.env`)** | **STRICTLY FORBIDDEN** in Web client bundles, Android APK, Git |
| **SMS Gateway API Key** | OTP Dispatch | **Standalone Backend API ONLY** (or Supabase Auth dashboard) | **STRICTLY FORBIDDEN** in Web client bundles, Android APK, Git |

---

## 4. Payment & Refund Security Architecture

### 4.1 Zero-Trust Client Payment Callbacks `[CONFIRMED]`
Client-side callbacks from Razorpay Web Checkout or Android SDK are treated strictly as **UX cues**, NEVER as proof of payment. Payment status transitions to `captured` only when the server receives and cryptographically validates the `payment.captured` webhook.

### 4.2 Webhook Signature Verification `[CONFIRMED]`
Every incoming Razorpay webhook must be validated against `RAZORPAY_WEBHOOK_SECRET` using HMAC-SHA256 with a constant-time equality check (`crypto.timingSafeEqual`) to prevent timing attacks.

### 4.3 Evidence-Based Refund Verification & Double-Refund Prevention `[CONFIRMED]`
1. **Idempotency Key Enforcement:** Every refund request dispatched to the Razorpay Refunds API must include a unique `X-Refund-Idempotency-Key` (e.g., `rfnd_orderId_timestamp`).
2. **Intermediate Status:** A successful HTTP 200 response from Razorpay's refund endpoint transitions the payment status to `refund_processing`, **NOT** `refunded`.
3. **Confirmed Gateway Evidence:** Status becomes `refunded` only upon receiving the verified asynchronous webhook `refund.processed`.
4. **Failure Handling:** If the gateway sends `refund.failed`, the record updates to `refund_failed`, an immutable log is recorded in `audit_logs`, and an urgent notification is surfaced on the store manager's dashboard for manual investigation.

---

## 5. Customer Mobile Phone OTP Security & Abuse Prevention `[CONFIRMED]`

- **IP Rate Limiting:** Maximum 10 OTP requests per 10 minutes per IP address.
- **Phone Cooldown:** Minimum 60-second cooldown between consecutive OTP requests for the same phone number.
- **Daily Phone Quota:** Maximum 5 OTP dispatches per phone number per 24 hours.
- **Failed Attempt Lockout:** Maximum 5 invalid OTP verification attempts before the session is permanently invalidated and the phone enters a 15-minute lockout.
- **DLT Regulatory Compliance:** Commercial SMS dispatch must comply with Indian TRAI Distributed Ledger Technology (DLT) regulations using registered Sender IDs and pre-approved templates.

---

## 6. Audit Logging & Operational Accountability `[CONFIRMED]`

The following privileged operations trigger an append-only insert into `public.audit_logs`:
- Manual physical stock count adjustments and spoilage deductions.
- Base price and tax rate modifications.
- Staff role assignments, promotions, or revocations.
- Order cancellations and refund executions.
- Manual store emergency closure toggles.

The `public.audit_logs` table is strictly append-only. No user role, including `admin`, possesses `DELETE` or `UPDATE` permissions on audit records.
