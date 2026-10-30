# Moody Orange — Functional & Non-Functional Requirements Specification

**Document Version:** 1.2.0 (Phase 0.2 Final Consistency Review)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial functional requirements breakdown. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Decoupled Backend API and added initial requirement tagging. |
| **1.2.0** | 2026-10-30 | Lead Architect | **Phase 0.2 Final Consistency Review:**<br>• Enforced authoritative inventory model (`physical_stock`, `reserved_stock`, `available_stock`).<br>• Specified deterministic multi-product row locking, atomic validation, and all-or-nothing allocation.<br>• Refined payment lifecycle: separated order status from payment status, added `refund_processing`, and mandated gateway evidence before setting `refunded`.<br>• Added explicit server-side authorization matrix and verified JWT user extraction.<br>• Audited requirement classifications: marked unapproved operational policies strictly as `[PROPOSED / CLIENT DECISION REQUIRED]`. |

---

## 1. User Roles & Permission Matrix

The system enforces strict Role-Based Access Control (RBAC). Roles are authoritatively governed at the database level and verified on every server API request.

| User Role | Status | Description | Authentication Mechanism | Allowed Scope & Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Guest / Anonymous** | `[CONFIRMED]` | Unauthenticated visitor | None (Public anonymous session) | • Browse active categories and products.<br>• View stock availability indicators.<br>• Add items to local client cart.<br>• *Restricted:* Cannot initiate checkout or place orders. |
| **Customer** | `[CONFIRMED]` | Authenticated retail customer | Mobile Number + 6-digit SMS OTP | • Full Guest permissions.<br>• Manage personal profile (Name, optional Email).<br>• Request stock reservation and initiate checkout.<br>• Select pickup timing (Immediate vs. Scheduled).<br>• Pay online (Razorpay) or select Cash at Pickup.<br>• View own active and past orders.<br>• Access collection pass for counter handover.<br>• *Restricted:* Customer ID is derived strictly from verified JWT claims. Isolated to own records via database RLS. Cannot access admin endpoints. |
| **Counter Staff** | `[CONFIRMED]` | Front-of-house cashier/barista | Staff Email + Password + Server Session | • View live order queue.<br>• Update order status: `Preparing` -> `Ready for Pickup`.<br>• Verify customer pickup collection.<br>• Confirm cash receipt for "Cash at Pickup" orders.<br>• Mark orders as `Completed`.<br>• *Restricted:* Cannot alter base prices, modify inventory catalog, or manage users. |
| **Store Manager** | `[CONFIRMED]` | Store operations manager | Staff Email + Password + Server Session | • Full Counter Staff permissions.<br>• Update physical stock counts and toggle item availability.<br>• Manage categories, products, and base prices.<br>• Configure store operating hours and pickup scheduling limits.<br>• Authorize customer order cancellations and issue refunds.<br>• View operational sales reports.<br>• *Restricted:* Cannot access raw database infrastructure or modify system secrets. |
| **System Admin** | `[CONFIRMED]` | Platform technical administrator | MFA-enforced credentials | • Full Manager permissions.<br>• Manage staff accounts and assign roles (`counter_staff`, `manager`).<br>• Inspect raw security audit logs and webhook delivery records.<br>• Manage cloud integration keys and environment configurations. |

---

## 2. Customer-Facing Functional Requirements (Web & Android)

### 2.1 Catalog & Product Discovery
- **FR-CAT-01 (Product Categories):** `[CONFIRMED]` The catalog must support three core product categories: `Cakes`, `Juices`, and `Chocolates`.
- **FR-CAT-02 (Product Listings & Details):** `[CONFIRMED]` Products must display high-resolution imagery, product name, description, unit price in INR (₹), and availability status.
- **FR-CAT-03 (Dietary Badges & Attributes):** `[PROPOSED / CLIENT DECISION REQUIRED]` Display dietary badges (`Eggless`, `Contains Egg`, `Vegan`, `Sugar-Free`) and allergen notices.  
  *(Architect Note: Recommended for food retail, but requires client confirmation of menu labeling).*
- **FR-CAT-04 (Search & Availability Filtering):** `[CONFIRMED]` Support instant search across product titles and filtering by product category and stock availability.
- **FR-CAT-05 (Dietary Preference Filters):** `[PROPOSED / CLIENT DECISION REQUIRED]` Multi-select filters for dietary preferences (e.g., "Eggless Only").
- **FR-CAT-06 (Real-Time Availability Indicators):** `[CONFIRMED]` Products must indicate whether they are `In Stock` or `Out of Stock` based on `available_stock = physical_stock - reserved_stock`.  
  `[PROPOSED]` Visual "Low Stock" indicator when available stock is below a configurable threshold.

### 2.2 Shopping Cart & Pre-Checkout
- **FR-CRT-01 (Cart Persistence):** `[CONFIRMED]` Shopping cart must persist locally during browsing. Upon OTP authentication, cart contents must be preserved.
- **FR-CRT-02 (Quantity Selection):** `[CONFIRMED]` Customer can increment or decrement line item quantities, constrained by `available_stock`.
- **FR-CRT-03 (Price Breakdown):** `[CONFIRMED]` Cart must provide a clear cost breakdown: item subtotal, applicable taxes, and authoritative total payable.  
  `[PROPOSED / CLIENT DECISION REQUIRED]` Separate packaging / carry box fee for delicate cakes or cold juices.
- **FR-CRT-04 (Server-Side Price Validation):** `[CONFIRMED]` The backend calculates all prices, taxes, and totals from active database records. Client-submitted prices are discarded.

### 2.3 Fulfillment & Pickup Scheduling Engine
- **FR-FUL-01 (Pickup Timing Modes):** `[CONFIRMED]` Customers must be able to select between two fulfillment timing modes:
  1. **Immediate Pickup:** Order prepared as soon as possible based on kitchen lead times.
  2. **Scheduled Pickup:** Customer chooses a pickup date and time slot within store operating hours.
- **FR-FUL-02 (Operating Hours Validation):** `[CONFIRMED]` Pickup slots must only be selectable within official store operating hours and on days the store is open.
- **FR-FUL-03 (Pickup Slot Duration):** `[PROPOSED / CLIENT DECISION REQUIRED]` Scheduled pickup options grouped into 15-minute collection windows (e.g., 5:00 PM – 5:15 PM).  
  *(Alternative: 30-minute windows. Awaiting client decision).*
- **FR-FUL-04 (Slot Capacity Throttle):** `[PROPOSED / CLIENT DECISION REQUIRED]` Configurable maximum concurrent orders per time slot to prevent physical counter congestion.
- **FR-FUL-05 (Customer Pickup Notes):** `[PROPOSED]` Freeform optional text field for special instructions (e.g., "Gift packaging requested").

### 2.4 Authentication & Identity
- **FR-AUT-01 (Customer Mobile OTP Authentication):** `[CONFIRMED]` Authentication is mobile-number driven via 6-digit SMS OTP (Indian +91 numbers). No password required for customers.
- **FR-AUT-02 (OTP Lifecycle & Rate Limiting):** `[CONFIRMED]` Enforce server-side OTP expiration, cooldown timers between resends, and rate limiting to prevent SMS exhaustion abuse.  
  `[PROPOSED]` 5-minute validity window and 60-second resend cooldown.
- **FR-AUT-03 (Customer Profile):** `[CONFIRMED]` Customer captures full name on initial profile creation. Optional email for receipts.

### 2.5 Payment & Order Placement
- **FR-PAY-01 (Payment Methods):** `[CONFIRMED]` System must support:
  1. **Online Payment:** Integrated via Razorpay (UPI, Credit/Debit Cards, NetBanking, Wallets).
  2. **Cash at Pickup:** Payment collected physically in cash at the store counter.
- **FR-PAY-02 (Deterministic Multi-Product Stock Reservation):** `[CONFIRMED]`
  - To prevent deadlocks, inventory rows for all items in the order must be locked in a **deterministic order** (e.g., `ORDER BY product_id ASC`).
  - The server must validate availability (`physical_stock - reserved_stock >= requested_qty`) for **every** item before allocating any stock.
  - Allocation is **all-or-nothing**: either all items are reserved atomically or none is. Partial reservations are strictly prohibited.
  - Client transmits a `client_idempotency_key`; duplicate checkout requests within the TTL return the existing reservation draft without double-reserving stock.
- **FR-PAY-03 (Reservation Timeout):** `[PROPOSED / CLIENT DECISION REQUIRED]` 10-minute reservation Time-To-Live (TTL). If payment is not completed within this window, reserved stock is released.
- **FR-PAY-04 (Authoritative Payment Verification):** `[CONFIRMED]` An order is marked paid only upon server-side verification of payment gateway signatures and webhooks. Client-side callbacks alone are never treated as proof of payment.
- **FR-PAY-05 (Reservation Retention on Payment Success):** `[CONFIRMED]` Successful payment does NOT release the stock reservation. Confirmed orders continue holding their reserved quantity until physical collection or cancellation.
- **FR-PAY-06 (Cash Order Cap):** `[PROPOSED / CLIENT DECISION REQUIRED]` Cap maximum order value for Cash at Pickup (e.g., ₹1,000) to mitigate spoilage loss from uncollected orders.

### 2.6 Order Tracking & Collection Verification
- **FR-TRK-01 (Order Identification):** `[CONFIRMED]` Every placed order receives a unique, human-readable Order Number (e.g., `MO-2610-042`).
- **FR-TRK-02 (Pickup Collection Verification Mechanism):** `[CONFIRMED]` Counter staff must verify that the collecting customer is the authorized recipient before handing over items.  
  `[PROPOSED / CLIENT DECISION REQUIRED]` System generates a secure 4-digit Collection PIN and QR code displayed on the customer's order tracking screen.  
  *(Alternative: Verification by Customer Mobile Number + Order ID. Awaiting client decision).*
- **FR-TRK-03 (Live Order Status Progression):** `[CONFIRMED]` Customer tracking interface reflects real-time status transitions:
  `draft -> payment_pending -> confirmed -> preparing -> ready_for_pickup -> completed` (or `cancelled / expired`).

---

## 3. Store Staff & Admin Functional Requirements (Admin Web)

### 3.1 Live Dispatch & Counter Order Queue
- **FR-ADM-01 (Live Order Queue):** `[CONFIRMED]` Real-time dispatch board displaying active orders grouped by status (`Confirmed`, `Preparing`, `Ready for Pickup`, `Completed Today`).
- **FR-ADM-02 (New Order Alerts):** `[PROPOSED]` Audible sound chime and visual badge alert when a new order arrives on the counter board.
- **FR-ADM-03 (Pickup Handover & Completion):** `[CONFIRMED]` Staff verifies the customer at the counter, confirms the order, and updates status to `Completed`.  
  **Physical Stock Decrement:** Upon completion, `physical_stock` decreases by the order quantity, and `reserved_stock` decreases by the order quantity.
- **FR-ADM-04 (Cash Collection Recording):** `[CONFIRMED]` For "Cash at Pickup" orders, the system displays the amount due and requires staff confirmation of cash receipt before marking the order `Completed`.

### 3.2 Inventory & Catalog Management
- **FR-INV-01 (Product & Category CRUD):** `[CONFIRMED]` Staff managers can create, update, and manage categories and products (title, description, price, tax rate, preparation time, and availability).
- **FR-INV-02 (Product Image Management):** `[CONFIRMED]` Secure image upload to Supabase Storage with CDN-backed delivery.
- **FR-INV-03 (Physical Stock Adjustments):** `[CONFIRMED]` Managers can update `physical_stock` counts and review inventory change history.
- **FR-INV-04 (Damaged & Spoiled Stock Handling):** `[CONFIRMED]` Damaged, spoiled, or expired items are handled through a dedicated inventory write-off procedure that decrements `physical_stock` with mandatory audit logging.
- **FR-INV-05 (Instant Availability Toggle):** `[CONFIRMED]` One-click action to immediately mark any item as `Out of Stock` or `In Stock` across all platforms.

### 3.3 Operational Configuration & Reporting
- **FR-OPS-01 (Store Hours & Schedule Configuration):** `[CONFIRMED]` Manage daily opening and closing hours and block special holiday closures.
- **FR-OPS-02 (Slot Capacity Configuration):** `[PROPOSED / CLIENT DECISION REQUIRED]` Ability to configure maximum orders allowed per pickup time slot.
- **FR-REP-01 (Basic Operational & Sales Reporting):** `[CONFIRMED]` Daily summary of orders fulfilled, broken down by payment method (Online Razorpay vs. Counter Cash).
- **FR-REP-02 (Cancellation & Refund Logging):** `[CONFIRMED]` Audit log of all cancelled orders, reasons for cancellation, and refund statuses.

---

## 4. Server-Side Authorization Matrix

Because the Supabase Service Role key bypasses RLS, the Backend API (`apps/backend-api`) authoritatively validates caller credentials and role permissions before executing any database operation:

| Endpoint / Operation | Customer (Verified JWT) | Counter Staff | Store Manager | System Admin |
| :--- | :---: | :---: | :---: | :---: |
| **Browse Catalog (`GET /catalog/*`)** | Allowed | Allowed | Allowed | Allowed |
| **Create Cart / Reserve Stock (`POST /orders/checkout`)** | Allowed (own user) | Denied | Denied | Denied |
| **View Own Orders (`GET /orders/*`)** | Allowed (own orders) | Allowed (all) | Allowed (all) | Allowed (all) |
| **Cancel Own Unprepared Order (`POST /orders/:id/cancel`)**| Allowed (if eligible)| Denied | Allowed | Allowed |
| **View Counter Queue (`GET /staff/orders/queue`)** | Denied | Allowed | Allowed | Allowed |
| **Verify Pickup & Handover (`POST /staff/orders/complete`)**| Denied | Allowed | Allowed | Allowed |
| **Adjust Physical Stock (`POST /inventory/adjust`)** | Denied | Denied | Allowed | Allowed |
| **Modify Prices / Catalog (`PUT /catalog/products/:id`)** | Denied | Denied | Allowed | Allowed |
| **Process Refunds (`POST /orders/:id/refund`)** | Denied | Denied | Allowed | Allowed |
| **Manage Staff Roles (`POST /admin/roles`)** | Denied | Denied | Denied | Allowed |

---

## 5. Non-Functional Requirements (NFRs)

### 5.1 Performance & Latency Benchmarks
*(Note: Design benchmarks to guide architecture sizing, to be validated under load in Phase 8).*
- **NFR-PER-01 (Web Loading Benchmark):** `[PLANNING TARGET]` First Contentful Paint (FCP) < 1.5 seconds on standard mobile 4G.
- **NFR-PER-02 (API Response Time):** `[PLANNING TARGET]` Catalog and cart query response times < 300ms p95 under standard load.
- **NFR-PER-03 (Real-time Broadcast Latency):** `[PLANNING TARGET]` Order state update propagation from server to client interfaces < 1.0 second over WebSockets.
- **NFR-PER-04 (Native Android Cold Start):** `[PLANNING TARGET]` App cold start to interactive home screen < 2.0 seconds on mid-tier Android devices (API 26+).

### 5.2 Concurrency & Data Integrity
- **NFR-CON-01 (Zero Overselling & Deadlock Prevention):** `[CONFIRMED]` Under concurrent checkout traffic, multi-product database transactions must sort items deterministically and enforce row-level locks (`SELECT ... FOR UPDATE`). No two customers may be confirmed for the same unit of limited stock.
- **NFR-CON-02 (Webhook Idempotency):** `[CONFIRMED]` Payment and refund webhooks must be strictly idempotent. Repeated webhook deliveries must produce identical state without duplicate order fulfillment or double refunds.

### 5.3 Reliability & Availability
- **NFR-REL-01 (Operating Uptime):** `[PLANNING TARGET]` 99.9% uptime target during physical store operational hours.
- **NFR-REL-02 (Network Drop Resilience):** `[CONFIRMED]` Client applications must handle mobile network interruptions gracefully, with automated reconnection and retry safety using client-generated idempotency keys.

### 5.4 Security & Compliance
- **NFR-SEC-01 (Credential Isolation):** `[CONFIRMED]` Supabase service-role keys, Razorpay key secrets, and webhook secrets must be accessible ONLY to the standalone Backend API runtime. Never bundle secrets in Web or Android builds.
- **NFR-SEC-02 (Customer Isolation via RLS & API):** `[CONFIRMED]` Customer identity is strictly derived from verified JWT claims. Direct client table mutations are denied via RLS.
- **NFR-SEC-03 (Input Validation):** `[CONFIRMED]` All incoming API requests must be validated against authoritative OpenAPI / JSON schemas before execution.
