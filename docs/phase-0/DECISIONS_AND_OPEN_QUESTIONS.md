# Moody Orange — Architectural Decisions & Open Business Questions

**Document Version:** 1.0.0  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  

---

## 1. Architectural Decision Records (ADRs)

### ADR-001: Supabase + PostgreSQL as the Authoritative Relational Backend
- **Context:** The system requires atomic transactions, strict concurrency management for limited inventory, relational integrity, row-level access control, and real-time updates for counter operations across three interfaces.
- **Decision:** Use PostgreSQL 15+ hosted on Supabase as the single authoritative database.
- **Alternatives Considered:**
  - *Firebase Firestore (NoSQL):* Rejected due to weak relational integrity, complex multi-document transaction costs, and lack of SQL-grade row-locking primitives (`SELECT FOR UPDATE`).
  - *Custom Self-Hosted PostgreSQL:* Rejected for Phase 0–1 due to excessive DevOps overhead (provisioning, replication, connection pooling, backup automation) that Supabase handles out of the box.
- **Consequences:** Provides robust ACID guarantees, built-in connection pooling, instant WebSockets via Supabase Realtime, and seamless S3-compatible image storage.

---

### ADR-002: Unified Next.js Server API for Privileged Operations
- **Context:** While Supabase allows direct client-to-database queries via PostgREST, permitting direct client writes to tables like `orders`, `inventory`, and `payments` exposes the platform to race conditions, client-side price tampering, and complex webhook handling vulnerabilities.
- **Decision:** Implement an authoritative REST API (`/api/v1/...`) within the Next.js server runtime to mediate all mutations. Read operations for public catalog data can query Supabase PostgREST directly using the public anonymous key guarded by RLS.
- **Trade-offs:** Introduces a lightweight API gateway between clients and the database for write operations, but guarantees that Razorpay secret keys, order pricing algorithms, and inventory locks remain strictly server-side.

---

### ADR-003: 100% Native Android App with Kotlin & Jetpack Compose
- **Context:** The client requires a high-performance Android application with a responsive, modern UI and long-term maintainability.
- **Decision:** Build the Android application using 100% native Kotlin, Android Studio, and Jetpack Compose.
- **Alternatives Considered:** React Native, Flutter, WebView wrapper.
- **Rationale:** The prompt explicitly mandates native Kotlin with Jetpack Compose and forbids cross-platform frameworks. Native development provides zero bridge overhead, direct hardware access (biometrics, camera for QR scanning), smooth 120Hz scrolling, and robust background notification handling.

---

### ADR-004: Two-Phase Stock Reservation with 10-Minute TTL Auto-Release
- **Context:** In quick commerce, stock must not be deducted before a customer pays, but must also not be oversold while a customer is completing payment.
- **Decision:** Implement a two-phase stock reservation pattern:
  1. *Phase 1 (Reservation):* When checkout is initiated, stock is shifted from `available` (`current_stock - reserved_stock`) to `reserved_stock` with a 10-minute expiry timestamp (`expires_at`).
  2. *Phase 2 (Commit or Release):* Upon verified payment capture, `current_stock` and `reserved_stock` are decremented simultaneously. If the session times out, a scheduled database procedure automatically decrements `reserved_stock`, returning it to the available pool.
- **Consequences:** Completely eliminates flash-sale overselling while guaranteeing that abandoned payment sessions do not lock up inventory indefinitely.

---

### ADR-005: Webhook-First Payment Settlement with Razorpay
- **Context:** Client-side redirects can fail due to mobile network dropouts, closed browser tabs, or malicious spoofing.
- **Decision:** Order confirmation is driven strictly by asynchronous Razorpay webhooks verified via HMAC-SHA256 signatures. Client-side success callbacks trigger polling or a WebSocket subscription to await authoritative server confirmation.
- **Consequences:** Eliminates fake payment confirmation attacks and guarantees payment-order reconciliation even if the customer's phone loses battery mid-transaction.

---

### ADR-006: Monorepo Architecture with Turborepo
- **Context:** The project encompasses three interfaces (Customer Web, Admin Web, Android App) and shared backend contracts.
- **Decision:** Maintain a single Git repository managed with Turborepo:
  - `apps/customer-web`
  - `apps/admin-web`
  - `apps/android`
  - `packages/shared-types`
  - `supabase/`
- **Consequences:** Enables unified TypeScript type definitions between Web storefront and Admin portal, atomic version control across backend migrations and frontend code, and streamlined CI/CD pipelines.

---

## 2. Open Business Questions Requiring Client Approval

The following business rules and operational policies directly impact system logic and cannot be assumed. They require explicit client review and sign-off prior to implementing Phase 3 and Phase 5:

### Category A: Operational & In-Store Policies
1. **Perishable Order Cancellation Window:**
   - *Question:* Can a customer cancel an order once placed?
   - *Options for Client:*
     - A: No cancellations permitted once payment is confirmed (standard for fresh baked goods and pressed juices).
     - B: Cancellations permitted only while status is `Confirmed` (prior to kitchen transitioning status to `Preparing`).
     - C: Cancellations permitted up to 2 hours prior to scheduled pickup time.
   - *Architect Recommendation:* **Option B**. Once the kitchen begins slicing cake or pressing juice, ingredients are consumed and cannot be reclaimed.

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

### Category E: Physical Counter Operations
9. **Kiosk Hardware at Shop Counter:**
   - *Question:* What physical hardware will counter staff use to run the Admin Web portal?
   - *Options:*
     - A: Dedicated Android/iPad tablet with stand and rear camera for QR scanning.
     - B: Desktop PC / POS terminal with a handheld USB 2D barcode/QR scanner.
     - C: Staff personal smartphones.
   - *Architect Recommendation:* **Option A or B**. The Admin Web UI will support both touchscreen touch targets and keyboard-wedge USB barcode scanners.
