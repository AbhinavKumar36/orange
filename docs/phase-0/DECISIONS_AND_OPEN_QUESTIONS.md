# Moody Orange — Architectural Decisions & Open Business Questions

**Document Version:** 1.4.1 (Phase 0.4.1 Final Blocker Resolution)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Ready for Phase 0 Approval Review  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial ADRs and open business questions. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Revised ADR-002 (standalone backend) and added ADR-005. |
| **1.2.0** | 2026-10-30 | Lead Architect | Phase 0.2 Revision: Standardized `physical_stock` and evidence-based refunds. |
| **1.3.0** | 2026-10-30 | Lead Architect | Phase 0.3 Consistency Pass: Scoped idempotency, cash state separation, hardened DB RPCs. |
| **1.4.0** | 2026-10-30 | Lead Architect | Phase 0.4 Consistency Pass: Dual-layer security, raw-body HMAC, and evidence-based refunds. |
| **1.4.1** | 2026-10-30 | Lead Architect | **Phase 0.4.1 Final Blocker Resolution:**<br>• Enhanced ADR-004 with inventory write-off protection preventing stock reduction below active reservations.<br>• Enhanced ADR-006 with separated checkout lifecycles (cash orders immune to online reservation TTL), atomic late payment recovery decisions, and partial refund concurrency.<br>• Reaffirmed Central Decision Register governance: architect recommendations are proposed baselines and do NOT constitute client approval. |

---

## 1. Architectural Decision Records (ADRs)

### ADR-001: Supabase + PostgreSQL as the Authoritative Relational Backend
- **Context:** The system requires atomic transactions, strict concurrency management for limited inventory, relational integrity, row-level access control, and real-time updates across three interfaces.
- **Decision:** Use PostgreSQL 15+ hosted on Supabase as the single authoritative database.
- **Alternatives Considered:**
  - *Firebase Firestore (NoSQL):* Rejected due to weak relational integrity, complex multi-document transaction costs, and lack of SQL-grade row-locking primitives (`SELECT FOR UPDATE`).
  - *Custom Self-Hosted PostgreSQL:* Rejected for Phase 0–1 due to excessive DevOps overhead that Supabase handles out of the box.
- **Consequences:** Provides ACID transactional guarantees, built-in connection pooling, instant WebSockets via Supabase Realtime, and S3-compatible image storage.

---

### ADR-002: Standalone Practical Modular Monolith Backend API (`apps/backend-api`)
- **Context:** The system has three client interfaces (Customer Web, Admin Web, Native Android App) that must share the exact same authoritative business logic, pricing calculations, stock locks, and payment verifications.
- **Decision:** Implement a standalone, independently deployable Node.js/TypeScript REST API in `apps/backend-api`.
- **Alternatives Evaluated:**
  - *Alternative 1: API Embedded in Customer Next.js App:* Rejected. Coupling frontend deployments with backend operations creates risk: redeploying the customer storefront restarts the API, risking in-flight Android checkout transactions.
  - *Alternative 2: Microservices:* Rejected. Splitting catalog, orders, and payments into separate services introduces network latency, distributed transactions (sagas), multiple repositories/pipelines, and unnecessary operational cost for a single retail business.
  - *Alternative 3 (ADOPTED): Practical Modular Monolith (`apps/backend-api`):* Single deployable unit with internal domain modules (Catalog, Orders, Payments, Staff). Shares a single PostgreSQL connection pool, eliminates network hop latency, and exposes unified REST endpoints (`/api/v1/...`).
- **Consequences:** Clean separation of concerns, independent scaling and deployment, and identical consumption by Web and Android clients.

---

### ADR-003: 100% Native Android App with Kotlin & Jetpack Compose
- **Context:** The client requires a high-performance Android application with a responsive, modern UI and long-term maintainability.
- **Decision:** Build the Android application using 100% native Kotlin, Android Studio, and Jetpack Compose.
- **Alternatives Considered:** React Native, Flutter, WebView wrapper.
- **Rationale:** Mandated by client requirements. Native development provides zero bridge overhead, direct hardware access (biometrics, camera for QR scanning), smooth 120Hz scrolling, and robust background notification handling.

---

### ADR-004: Authoritative Inventory Accounting, Protected Write-Offs & Row-Locking
- **Context:** The inventory model must prevent deadlocks across multi-product checkouts, eliminate race conditions, maintain stock reservations through payment success until physical collection, protect `physical_stock >= reserved_stock` during staff write-offs, and reject malformed checkout inputs.
- **Decision:**
  1. *Authoritative Stock Ledger:*
     - `physical_stock`: Total physical sellable units present in the shop.
     - `reserved_stock`: Units allocated to active online checkouts AND confirmed orders awaiting collection.
     - `available_stock = physical_stock - reserved_stock`.
     - Successful online payment does NOT release the reservation. Physical stock decreases only at customer counter handover.
  2. *Protected Inventory Write-Offs (`rpc_write_off_inventory`):*
     - If damage $\le$ unreserved stock (`available_stock`), physical stock is decremented safely via audit log.
     - If damage exceeds unreserved stock, direct write-off is blocked. Active customer reservations are never silently invalidated. A manager must explicitly cancel the affected order(s) via `rpc_cancel_order` with reason `'cancelled_damaged_stock'` (freeing reserved stock and triggering a refund) before physical write-off is permitted.
  3. *Deterministic Multi-Product Locking:* All multi-product inventory procedures (checkout reservation, late payment reconciliation, order cancellation, staff handover) sort product IDs in ascending order (`ORDER BY product_id ASC FOR UPDATE`).
  4. *Checkout Validation:* `rpc_reserve_order_stock` safely aggregates duplicate product IDs, enforces positive integer quantities, rejects empty carts and inactive products, and pre-validates availability for all items before allocating any stock.
  5. *Customer-Scoped Idempotency:* Scoped strictly to `(customer_id, client_idempotency_key)` with canonical payload hash verification.
- **Consequences:** Eliminates inventory overselling and deadlocks, guarantees `physical_stock >= reserved_stock` at all times, and prevents cross-customer idempotency data leaks.

---

### ADR-005: Cross-Platform API Contract Management (OpenAPI 3.1 / JSON Schema)
- **Context:** The system utilizes TypeScript for Web/Backend and Kotlin for Android. TypeScript types cannot be directly imported or executed in Kotlin Gradle projects.
- **Decision:** API contracts are defined using JSON Schema / OpenAPI specifications in `packages/api-contracts`:
  - **TypeScript Clients (Web & Backend):** Utilize Zod schemas derived from the API contracts.
  - **Kotlin Client (Android):** Implements native Kotlin `data class` models with `kotlinx.serialization` strictly matching the JSON contracts.
- **Consequences:** Eliminates false assumptions about cross-language sharing while enforcing strict contract parity across platforms.

---

### ADR-006: Asynchronous Webhook Settlement, Separated Lifecycles & Refund Controls
- **Context:** Client-side redirects cannot be trusted. Cash orders cannot share an online gateway timeout. Late payments after reservation expiry must not automatically revive orders without a valid atomic decision. Refunds must support partial accounting without race conditions.
- **Decision:**
  1. *Separated Checkout Lifecycles:*
     - Online orders: `draft` $\rightarrow$ `pending` (under proposed 10-min TTL) $\rightarrow$ `confirmed` / `captured` upon verified webhook.
     - Cash orders: Accepted immediately as `confirmed`, `payment_status = 'unpaid'`, `expires_at = NULL`. The online payment reservation TTL **does not apply** to cash orders.
  2. *Authoritative Payment Verification:* Backend API validates raw-body HMAC signature, provider payment ID, provider order ID, amount in paise, and currency before invoking database procedures.
  3. *Atomic Late-Payment Recovery Decision Tree (`rpc_reconcile_late_payment`):*
     - Locks order and inventory rows deterministically.
     - If stock remains available and pickup time is valid: performs explicit atomic recovery (`reserved_stock += qty`, `order_status = 'confirmed'`, `payment_status = 'captured'`, `expires_at = NULL`).
     - If stock was claimed by another customer: does NOT revive order or oversell stock; records payment as `refund_pending` and dispatches automated refund.
  4. *Evidence-Based Partial Refunds & Concurrency (`rpc_issue_refund`):*
     - Locks payment row `FOR UPDATE`.
     - Enforces cumulative cap: $\sum \text{refunds} \le \text{captured payment amount}$.
     - Gateway acceptance (`HTTP 200`) sets `refund_processing`. Status becomes `refunded` only upon verified webhook `refund.processed`.
     - Network timeouts do NOT trigger blind retries; stable idempotency key (`rfnd_<payment_id>_<refund_uuid>`) enables provider reconciliation.
- **Consequences:** Eliminates fake payment confirmation attacks, prevents uncollected cash orders from being completed without cash receipt, and guarantees refund accounting integrity.

---

### ADR-007: Practical Monorepo Structure
- **Context:** Managing three interfaces, one backend service, and shared contracts across multiple separate repositories creates version drift and complex deployment coordination.
- **Decision:** Maintain a single Git repository managed with Turborepo:
  - `apps/backend-api`
  - `apps/customer-web`
  - `apps/admin-web`
  - `apps/android`
  - `packages/api-contracts`
  - `supabase/`
- **Consequences:** Atomic version control across backend migrations, API contracts, and frontend code.

---

### ADR-008: Dual-Layer Security Model & Credential Isolation
- **Context:** Supabase service-role keys bypass PostgreSQL RLS. Privileged credentials must never leak into client apps.
- **Decision:**
  1. *Dual-Layer Security:* Layer 1 enforces authorization in `apps/backend-api` (validating JWT signatures and verifying caller permissions from DB before calling RPCs). Layer 2 enforces PostgreSQL defense-in-depth (RLS, explicit search_path, revoked public execute).
  2. *Action-Level Role Separation:* Counter staff can view dispatch queues and confirm cash collections, but are strictly blocked from price edits, catalog changes, and inventory write-offs (manager only).
  3. *Strict Credential Isolation:* `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` reside solely in `apps/backend-api/.env`. Client apps only possess public anon keys and public gateway key IDs.
- **Consequences:** Protects against privilege escalation, search path hijacking, and credential leakage.

---

## 2. Central Register of Open Decisions Requiring Client Approval

> [!IMPORTANT]
> **GOVERNANCE RULE: Recommendations Are Not Client Approvals!**  
> The 10 items below represent core business, financial, and operational policies that require explicit client sign-off. Architect recommendations are proposed baselines to assist evaluation, but **they remain strictly unapproved until the client signs off**. They must not be converted into confirmed requirements during development without written client authorization.

### Category A: Operational & In-Store Policies
1. **Perishable Order Cancellation Window:** `[CLIENT DECISION REQUIRED]`
   - *Question:* Can a customer cancel an order once placed?
   - *Options for Client:*
     - Option A: No cancellations permitted once payment is confirmed.
     - Option B (Recommended Default): Cancellations permitted only while status is `Confirmed` (prior to kitchen transitioning status to `Preparing`).
     - Option C: Cancellations permitted up to 2 hours prior to scheduled pickup time.
   - *Architect Recommendation:* **Option B**. Prevents ingredient waste once preparation commences.

2. **Uncollected / Abandoned Order Policy:** `[CLIENT DECISION REQUIRED]`
   - *Question:* What happens if a customer does not arrive to collect their order?
   - *Options for Client:*
     - Option A (Recommended Default): Order held until store closing. At closing, status flips to `cancelled_uncollected`, food is discarded, and no refund is issued.
     - Option B: Order held for a maximum grace period of 90 minutes past scheduled pickup time.
   - *Architect Recommendation:* **Option A**. Perishable customized items cannot be restocked once staged.

3. **Advance Notice for Celebration Cakes:** `[CLIENT DECISION REQUIRED]`
   - *Question:* Do large celebration cakes (e.g., 1kg or multi-tier cakes) require mandatory advance notice?
   - *Options for Client:*
     - Option A: All items in catalog are pre-stocked or ready within standard prep time (15–30 mins).
     - Option B (Recommended Default): Specific items have a "Pre-order Lead Time" attribute (e.g., 24 hours in advance), restricting selectable pickup slots.
   - *Architect Recommendation:* **Option B**. Allows fresh baking while preventing impossible on-demand orders.

4. **Preparation Time per Product:** `[CLIENT DECISION REQUIRED]`
   - *Question:* What standard prep time buffers should be configured for cakes vs. juices vs. chocolates?
   - *Recommended Default:* 10 minutes for juices/chocolates; 30 minutes for standard cakes; 24 hours for custom celebration cakes.

---

### Category B: Cash-at-Pickup Financial Risk Controls
5. **Maximum Permissible Cash Order Threshold:** `[CLIENT DECISION REQUIRED]`
   - *Question:* What is the maximum order total permitted for "Cash at Pickup"?
   - *Options for Client:*
     - Option A (Recommended Default): Hard cap of ₹1,000 for Cash at Pickup. Orders above ₹1,000 require online payment (Razorpay).
     - Option B: Hard cap of ₹2,500.
     - Option C: No cap (client accepts financial risk of uncollected food).
   - *Architect Recommendation:* **Option A (₹1,000 max cap)** to mitigate spoilage loss.

6. **Repeat No-Show Penalties:** `[CLIENT DECISION REQUIRED]`
   - *Question:* If a customer places a Cash at Pickup order and fails to collect it, should their account be penalized?
   - *Options for Client:*
     - Option A (Recommended Default): After 1 uncollected cash order, "Cash at Pickup" is disabled for their phone number (prepaid online only).
     - Option B: Manual blacklisting by store manager in admin portal.
   - *Architect Recommendation:* **Option A**. Automated protection against repeated bad-faith orders.

---

### Category C: Tax, Pricing & Packaging Configuration
7. **GST (Goods & Services Tax) Display Norms:** `[CLIENT DECISION REQUIRED]`
   - *Question:* Are catalog menu prices inclusive of GST or exclusive?
   - *Options for Client:*
     - Option A (Recommended Default): **Tax Inclusive:** Menu displays ₹500; customer pays exactly ₹500 at checkout. Invoice indicates *"Includes 5% GST (₹23.81)"*.
     - Option B: **Tax Exclusive:** Menu displays ₹500; cart adds 5% GST (₹25); customer pays ₹525.
   - *Architect Recommendation:* **Option A**. Retail bakery customers expect the advertised price to equal checkout total.

8. **Packaging & Carry Bag Fees:** `[CLIENT DECISION REQUIRED]`
   - *Question:* Should an automated packaging charge be added for delicate items (e.g., insulated cold-boxes or carry bags)?
   - *Options for Client:*
     - Option A: Flat packaging fee (e.g., ₹20 per order).
     - Option B: Item-specific packaging fee (e.g., ₹30 for cake box, ₹0 for chocolate bars).
     - Option C (Recommended Default): Free packaging absorbed in menu price.
   - *Architect Recommendation:* **Option C**. Reduces checkout friction for retail customers.

---

### Category D: Counter Pickup Verification & Scheduling
9. **Pickup Handover Verification Mechanism:** `[CLIENT DECISION REQUIRED]`
   - *Question:* What physical mechanism should counter staff use to verify customer pickup?
   - *Options for Client:*
     - Option A (Recommended Default): **4-Digit Collection PIN + QR Code:** Customer displays PIN or QR on mobile screen; staff types PIN or scans QR.
     - Option B: **Customer Mobile Number + Order Number:** Staff looks up order by phone number; customer verbally confirms name.
   - *Architect Recommendation:* **Option A**. Fast, secure, and eliminates verbal miscommunication at a busy counter.

10. **Stock Reservation Window & Pickup Slot Duration:** `[CLIENT DECISION REQUIRED]`
    - *Question:* What is the acceptable stock reservation timeout during checkout? What is the duration of scheduled pickup slots?
    - *Recommended Defaults:*
      - Reservation Timeout: **10 minutes** (standard payment window before releasing stock for online orders; cash orders do not expire).
      - Pickup Slot Interval: **15 minutes** (e.g., 5:00 PM – 5:15 PM).
      - Slot Capacity Throttle: **10 orders per 15-minute slot** (prevents counter congestion).
