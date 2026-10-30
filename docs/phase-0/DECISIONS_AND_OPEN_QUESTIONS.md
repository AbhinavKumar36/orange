# Moody Orange — Architectural Decisions & Open Business Questions

**Document Version:** 1.1.0 (Phase 0.1 Revision)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial ADRs and open business questions. |
| **1.1.0** | 2026-10-30 | Lead Architect | **Phase 0.1 Revision:**<br>• Revised ADR-002: Standalone Modular Monolith Backend API (`apps/backend-api`) replacing embedded Next.js API.<br>• Added ADR-005: Cross-platform API contract management (OpenAPI/JSON Schema) without cross-language TypeScript-to-Kotlin sharing illusions.<br>• Updated open business decisions list to clearly isolate unapproved operational assumptions. |

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

### ADR-004: Two-Phase Stock Reservation with 10-Minute TTL & Automated Late Webhook Reconciliation
- **Context:** In quick commerce, stock must not be deducted before a customer pays, but must also not be oversold while a customer is completing payment. Furthermore, delayed payment webhooks can arrive after reservation expiry.
- **Decision:** Implement a two-phase stock reservation pattern:
  1. *Reservation Phase:* At checkout initiation, stock moves to `reserved_stock` with a 10-minute expiry timestamp (`expires_at`).
  2. *Commit Phase:* Upon verified payment webhook, reservation converts to confirmed order.
  3. *Auto-Release:* If checkout is abandoned, a background worker releases `reserved_stock`.
  4. *Late Webhook Reconciliation:* If a delayed payment webhook arrives for an expired order:
     - If stock is still available: Re-reserve stock and confirm order.
     - If stock was sold to someone else: Refuse confirmation, mark order `cancelled_inventory_depleted`, and automatically trigger a full refund via Razorpay Refunds API.
- **Consequences:** Completely eliminates flash-sale overselling while guaranteeing that customers who pay late receive either their goods or an immediate automated refund.

---

### ADR-005: Cross-Platform API Contract Management (OpenAPI / JSON Schema)
- **Context:** The system utilizes TypeScript for Web/Backend and Kotlin for Android. TypeScript types cannot be directly imported or executed in Kotlin Gradle projects.
- **Decision:** API contracts are defined using JSON Schema / OpenAPI specifications in `packages/api-contracts`:
  - **TypeScript Clients (Web & Backend):** Utilize Zod schemas derived from the API contracts.
  - **Kotlin Client (Android):** Implements equivalent Kotlin `data class` models with `kotlinx.serialization` strictly matching the JSON contracts.
- **Consequences:** Eliminates false assumptions about cross-language sharing while enforcing strict contract parity across platforms.

---

### ADR-006: Webhook-First Payment Settlement with Razorpay
- **Context:** Client-side redirects can fail due to mobile network dropouts, closed browser tabs, or malicious spoofing.
- **Decision:** Order confirmation is driven strictly by asynchronous Razorpay webhooks verified via HMAC-SHA256 signatures. Client-side success callbacks trigger polling or a WebSocket subscription to await authoritative server confirmation.
- **Consequences:** Eliminates fake payment confirmation attacks and guarantees payment-order reconciliation.

---

### ADR-007: Practical Monorepo Structure
- **Context:** Managing three interfaces, one backend service, and shared contracts across multiple separate repositories creates version drift and complex deployment coordination.
- **Decision:** Maintain a single Git repository managed with Turborepo:
  - `apps/customer-web`
  - `apps/admin-web`
  - `apps/android`
  - `apps/backend-api`
  - `packages/api-contracts`
  - `supabase/`
- **Consequences:** Atomic version control across backend migrations, API contracts, and frontend code.

---

## 2. Open Business Decisions Requiring Client Approval

The following business rules and operational policies directly impact system logic and cannot be assumed. They require explicit client review and sign-off prior to implementing Phase 3 and Phase 5:

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
