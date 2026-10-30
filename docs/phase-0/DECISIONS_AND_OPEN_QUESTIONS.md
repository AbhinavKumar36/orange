# Moody Orange — Architectural Decisions & Open Business Questions

**Document Version:** 1.3.0 (Phase 0.3 Final Consistency Pass)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial ADRs and open business questions. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Revised ADR-002 (standalone backend) and added ADR-005. |
| **1.2.0** | 2026-10-30 | Lead Architect | Phase 0.2 Revision: Standardized `physical_stock` and evidence-based refunds. |
| **1.3.0** | 2026-10-30 | Lead Architect | **Phase 0.3 Final Consistency Pass:**<br>• Updated ADR-004: Enforced cart duplicate aggregation, positive quantity validation, and customer-scoped idempotency keys.<br>• Updated ADR-006: Defined separate Cash-at-Pickup lifecycle (`unpaid` state) and authoritative Razorpay verification protocols.<br>• Re-audited all client decisions, keeping operational and financial policies strictly open pending client approval. |

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

### ADR-004: Authoritative Inventory Accounting, Deterministic Row-Locking & Input Validation
- **Context:** The inventory model must prevent deadlocks across multi-product checkouts, eliminate race conditions, maintain stock reservations through payment success until physical collection, and reject malformed checkout inputs.
- **Decision:**
  1. *Authoritative Stock Ledger:*
     - `physical_stock`: Total physical sellable units present in the shop.
     - `reserved_stock`: Units allocated to pending checkout reservations AND confirmed orders awaiting collection.
     - `available_stock = physical_stock - reserved_stock`.
     - Successful payment does NOT release the reservation. Physical stock decreases only at customer collection.
  2. *Deterministic Multi-Product Locking:* All multi-product inventory procedures (checkout reservation, late payment reconciliation, order cancellation, staff handover) sort product IDs in ascending order (`ORDER BY product_id ASC FOR UPDATE`).
  3. *Checkout Validation:* `rpc_reserve_order_stock` safely aggregates duplicate product IDs, enforces positive integer quantities, rejects empty carts and inactive products, and pre-validates availability for all items before allocating any stock.
  4. *Customer-Scoped Idempotency:* Scoped strictly to `(customer_id, client_idempotency_key)` with payload hash verification.
- **Consequences:** Eliminates inventory overselling and deadlocks, ensures accounting consistency across store operations, and prevents cross-customer idempotency data leaks.

---

### ADR-005: Cross-Platform API Contract Management (OpenAPI 3.1 / JSON Schema)
- **Context:** The system utilizes TypeScript for Web/Backend and Kotlin for Android. TypeScript types cannot be directly imported or executed in Kotlin Gradle projects.
- **Decision:** API contracts are defined using JSON Schema / OpenAPI specifications in `packages/api-contracts`:
  - **TypeScript Clients (Web & Backend):** Utilize Zod schemas derived from the API contracts.
  - **Kotlin Client (Android):** Implements native Kotlin `data class` models with `kotlinx.serialization` strictly matching the JSON contracts.
- **Consequences:** Eliminates false assumptions about cross-language sharing while enforcing strict contract parity across platforms.

---

### ADR-006: Asynchronous Webhook Settlement, Evidence-Based Refunds & Cash State Separation
- **Context:** Client-side redirects cannot be trusted. Cash orders cannot be forced into an online gateway payment state. Refunds cannot be assumed complete upon gateway request acceptance.
- **Decision:**
  1. *Payment State Separation:*
     - Online orders: `pending` -> `captured` -> `refund_processing` -> `refunded`.
     - Cash orders: Initialized as `unpaid`. Transitions to `captured` only upon staff cash receipt confirmation at counter handover.
  2. *Authoritative Payment Verification:* Backend API validates payment ID, order ID, amount in paise, currency, and HMAC signature before invoking database procedures. Database procedures also verify expected order totals.
  3. *Evidence-Based Refunds:* Gateway acceptance (`HTTP 200`) sets `refund_processing`. Status becomes `refunded` only upon verified receipt of the gateway webhook `refund.processed`. Cumulative refunds cannot exceed captured order amount.
- **Consequences:** Eliminates fake payment confirmation attacks, prevents uncollected cash orders from being completed, and guarantees refund accounting integrity.

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

## 2. Open Business Decisions Requiring Client Approval

The following business rules and operational policies directly impact system logic and cannot be assumed. They require explicit client review and sign-off prior to implementing Phase 5 (Cart & Stock Engine) and Phase 7 (Payments):

### Category A: Operational & In-Store Policies
1. **Perishable Order Cancellation Window:**
   - *Question:* Can a customer cancel an order once placed?
   - *Options for Client:*
     - A: No cancellations permitted once payment is confirmed (standard for fresh baked goods and pressed juices).
     - B: Cancellations permitted only while status is `Confirmed` (prior to kitchen transitioning status to `Preparing`).
     - C: Cancellations permitted up to 2 hours prior to scheduled pickup time.
   - *Architect Recommendation:* **Option B**. Once the kitchen begins assembling or slicing, ingredients are consumed.

2. **Uncollected / Abandoned Order Policy:**
   - *Question:* What happens if a customer does not arrive to collect their order?
   - *Options for Client:*
     - A: Order held until end of day (store close). At closing, status flips to `Uncollected / Abandoned`, food is discarded, and no refund is issued.
     - B: Order held for a maximum grace period of 90 minutes past scheduled pickup time.
   - *Architect Recommendation:* **Option A**. Perishable food prepared specifically for a customer cannot be restocked once handled and staged.

3. **Advance Notice for Celebration Cakes:**
   - *Question:* Do large celebration cakes (e.g., 1kg or multi-tier cakes) require mandatory advance notice (e.g., minimum 24 hours prior)?
   - *Options for Client:*
     - A: All items in catalog are pre-stocked or ready within standard prep time (15–30 mins).
     - B: Specific items have a "Pre-order Lead Time" attribute (e.g., "Must order 24 hours in advance"), restricting available pickup slots.

---

### Category B: Cash-at-Pickup Financial Risk Controls
4. **Maximum Permissible Cash Order Threshold:**
   - *Question:* What is the maximum order total permitted for "Cash at Pickup"?
   - *Context:* Allowing unrestricted cash orders creates a risk of malicious or fake orders where high-value custom cakes are prepared but never collected, resulting in total financial loss.
   - *Options for Client:*
     - A: Hard cap of ₹1,000 for Cash at Pickup. Orders above ₹1,000 require online payment (Razorpay).
     - B: Hard cap of ₹2,500.
     - C: No cap (client accepts operational risk).
   - *Architect Recommendation:* **Option A (₹1,000 max cap)** for Cash at Pickup to mitigate spoilage loss.

5. **Repeat No-Show Penalties:**
   - *Question:* If a customer places a Cash at Pickup order and fails to collect it, should their account be penalized?
   - *Options for Client:*
     - A: After 1 uncollected cash order, the "Cash at Pickup" option is permanently disabled for their phone number (they may only order via online prepaid).
     - B: Manual blacklisting by store manager in admin portal.
   - *Architect Recommendation:* **Option A (Automated restriction after 1 uncollected cash order)**.

---

### Category C: Tax, Pricing & Packaging Configuration
6. **GST (Goods & Services Tax) Display Norms:**
   - *Question:* Are catalog menu prices inclusive of GST or exclusive?
   - *Options for Client:*
     - A: **Tax Inclusive (Recommended):** Menu displays ₹500; customer pays exactly ₹500 at checkout. Invoice indicates *"Includes 5% GST (₹23.81)"*.
     - B: **Tax Exclusive:** Menu displays ₹500; cart adds 5% GST (₹25); customer pays ₹525.
   - *Architect Recommendation:* **Option A**. Retail bakery consumers expect the shelf price to equal the checkout total.

7. **Packaging & Carry Bag Fees:**
   - *Question:* Should an automated packaging charge be added for delicate items (e.g., insulated cold-boxes for celebration cakes or tamper-proof juice carriers)?
   - *Options for Client:*
     - A: Flat packaging fee (e.g., ₹20 per order).
     - B: Item-specific packaging fee (e.g., ₹30 for 1kg Cake box, ₹0 for chocolate bars).
     - C: Free packaging absorbed in menu price.

---

### Category D: Indian Regulatory & SMS Gateway Requirements
8. **TRAI DLT Registration for SMS OTP:**
   - *Question:* Does Moody Orange possess an active Indian Principal Entity DLT Registration (via Jio, Airtel, Vodafone, or BSNL) with registered SMS Headers (Sender ID) and approved content templates?
   - *Context:* In India, commercial SMS delivery without TRAI DLT template approval is blocked by telecom carriers.
   - *Fallback Option:* If DLT registration is pending, should we enable WhatsApp Business API (via Msg91 / Gupshup) as an immediate OTP delivery bridge?
   - *Action Required:* Client must confirm DLT registration status or authorize WhatsApp OTP provider.

---

### Category E: Counter Pickup Verification Mechanism
9. **Pickup Handover Verification Mechanism:**
   - *Question:* What physical mechanism should counter staff use to verify customer pickup?
   - *Options for Client:*
     - A: **4-Digit Collection PIN + QR Code:** Customer displays PIN or QR on mobile screen; staff types PIN or scans QR.
     - B: **Customer Mobile Number + Order Number:** Staff looks up order by phone number; customer verbally confirms name.
   - *Architect Recommendation:* **Option A**. Fast, error-free, and prevents verbal miscommunication at a busy counter.

---

### Category F: Reservation Timeout & Slot Durations
10. **Stock Reservation Window & Pickup Slot Duration:**
    - *Question:* What is the acceptable stock reservation timeout during checkout? What is the duration of scheduled pickup slots?
    - *Proposals:*
      - Reservation Timeout: 10 minutes (standard for payment window completion).
      - Pickup Slot Interval: 15 minutes (e.g. 5:00 PM – 5:15 PM).
    - *Action Required:* Client must confirm or adjust these operational values.
