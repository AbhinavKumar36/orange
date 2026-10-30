# Moody Orange — Functional & Non-Functional Requirements Specification

**Document Version:** 1.0.0  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  

---

## 1. User Roles & Permission Matrix

The system enforces strict Role-Based Access Control (RBAC). Roles are authoritatively governed at the database level and verified on every server API request.

| User Role | Description | Authentication Mechanism | Allowed Scope & Permissions |
| :--- | :--- | :--- | :--- |
| **Guest / Anonymous** | Unauthenticated website or app visitor | None (Public anonymous session) | • Browse active catalog, categories, and products.<br>• View real-time stock availability indicators.<br>• Add items to a local client cart.<br>• *Restricted:* Cannot initiate checkout or place orders without authentication. |
| **Customer** | Registered retail buyer | Mobile Number + 6-digit SMS OTP | • Full Guest permissions.<br>• Manage personal profile (Name, Email).<br>• Lock stock reservation and proceed to checkout.<br>• Choose pickup timing (Immediate vs. Scheduled).<br>• Execute payments (Online via Razorpay or Cash at Pickup).<br>• View personal active and past orders.<br>• Access unique 4-digit Collection PIN & QR code.<br>• Cancel eligible un-prepared orders.<br>• *Restricted:* Cannot view other customers' orders or any admin interfaces. |
| **Counter Staff** | Front-of-house cashier and barista | Staff Email + Strong Password + Session | • View live order dispatch board (read-only customer contact info masked except phone digits needed for identification).<br>• Update order state: `Preparing` -> `Ready for Pickup`.<br>• Verify customer collection via PIN input or QR scanner.<br>• Confirm cash receipt for "Cash at Pickup" orders.<br>• Mark orders as `Completed`.<br>• *Restricted:* Cannot alter base prices, delete products, or view financial profit analytics. |
| **Store Manager** | Operational lead & kitchen manager | Staff Email + Strong Password + Session | • Full Counter Staff permissions.<br>• Emergency stock override (toggle items In/Out of stock).<br>• Adjust current physical stock counts.<br>• Create, edit, and archive categories and products.<br>• Configure store operating hours and pickup slot limits.<br>• Process order cancellations and authorize refunds.<br>• Export daily sales and cash reconciliation summaries.<br>• *Restricted:* Cannot modify database schema or manage system infrastructure. |
| **System Admin** | Technical Lead & Platform Administrator | MFA-enforced credentials + Direct DB access | • Full Manager permissions.<br>• Manage staff user accounts and assign roles (`counter_staff`, `manager`).<br>• Inspect raw system audit logs and webhook delivery logs.<br>• Manage third-party API configurations (Razorpay, SMS gateways, Supabase Storage buckets). |

---

## 2. Customer-Facing Functional Requirements (Web & Android)

### 2.1 Catalog & Product Discovery
- **FR-CAT-01 (Category Structure):** The catalog must be organized into three mandatory core categories: `Cakes`, `Juices`, and `Chocolates`. Subcategories or promotional collections (e.g., "Eggless Cakes", "Cold-Pressed Detox", "Dark Chocolate Truffles") may be defined dynamically by admins.
- **FR-CAT-02 (Product Attributes):** Each product card and detail view must display:
  - High-resolution product image(s) served via CDN.
  - Product Name and concise description.
  - Clear Dietary Badges: `100% Vegetarian / Eggless`, `Contains Egg`, `Vegan`, `Sugar-Free`, `Gluten-Free`.
  - Allergen Warnings (e.g., "Contains Nuts / Dairy").
  - Unit/Portion specification (e.g., "500g / Serves 4-6", "350ml Glass Bottle", "Box of 12").
  - Pricing in Indian Rupees (₹ INR), formatted with standard Indian currency grouping (e.g., `₹1,250`).
  - Approximate kitchen preparation lead time (e.g., "Ready in 25 mins" vs. "Pre-order 2 hrs prior").
- **FR-CAT-03 (Search & Filtering):**
  - Instant client-side search across product titles and ingredient tags with debounce (< 250ms).
  - Multi-select filters for dietary preferences (e.g., Eggless Only, Sugar-Free).
  - Category tabs with smooth scrolling and persistent selection.
- **FR-CAT-04 (Real-time Stock Indication):**
  - **In Stock:** Add to Cart enabled with quantity selector.
  - **Low Stock:** Visible warning badge ("Only 2 left!") when available stock is below the category threshold.
  - **Sold Out:** Visual grayscale treatment, disabled Add to Cart button, and clear "Sold Out" overlay.

### 2.2 Shopping Cart & Pre-Checkout
- **FR-CRT-01 (Cart Persistence):** Unauthenticated guest cart must persist in local storage (web) and local Room database / DataStore (Android). Upon OTP login, guest cart items must merge with any existing active customer session cart.
- **FR-CRT-02 (Line Item Quantity Controls):** Customers can adjust quantities between 1 and a maximum permissible limit per item (e.g., 10 items or available stock, whichever is lower).
- **FR-CRT-03 (Transparent Cost Breakdown):** Cart summary must display:
  - Items Subtotal.
  - Applicable GST (explicitly separated or clearly labeled as GST-inclusive per Indian tax norms).
  - Packaging / Bag Fee (if applicable for insulated cake boxes).
  - Final Authoritative Total Payable.
- **FR-CRT-04 (Pre-Checkout Stock Validation):** When the customer taps "Proceed to Checkout", the server must re-verify stock availability before transitioning to the fulfillment and payment step.

### 2.3 Fulfillment & Pickup Scheduling Engine
- **FR-FUL-01 (Pickup Options):** The customer must explicitly select one of two fulfillment timing modes:
  1. **Immediate Pickup:** Order is queued for the earliest possible pickup based on the maximum preparation time among the ordered items (e.g., max(Juice: 10m, Cake: 25m) = 25 minutes from placement).
  2. **Scheduled Pickup:** Customer selects a specific pickup date and a 15-minute time slot (e.g., "Today, 5:30 PM – 5:45 PM" or "Tomorrow, 11:00 AM – 11:15 AM").
- **FR-FUL-02 (Operational Hours Validation):** Scheduled pickup slots are only available within store operating hours (e.g., 09:00 AM to 10:00 PM). Slots falling outside operating hours or on store holidays must be locked.
- **FR-FUL-03 (Cut-Off & Capacity Rules):**
  - Immediate pickup disables 45 minutes prior to store closing.
  - Each 15-minute slot has a server-enforced concurrency limit (e.g., maximum 12 customer orders per slot) to prevent counter congestion. Once filled, the slot displays "Slot Full".
- **FR-FUL-04 (Customer Contact Capture):** Customer must provide full name and an optional pickup contact note (e.g., "Brother will collect", "Please write 'Happy Birthday Anita' on cake box").

### 2.4 Authentication & Identity
- **FR-AUT-01 (Mobile Number Verification):** Authentication is strictly mobile-number driven (Indian +91 standard). No password friction for customers.
- **FR-AUT-02 (OTP Lifecycle):**
  - 6-digit numeric OTP sent via SMS.
  - OTP validity window: exactly 5 minutes (300 seconds).
  - Resend OTP countdown timer: 60-second cooldown enforced on both client and server.
  - Maximum 5 failed attempts per OTP before the code is invalidated.
- **FR-AUT-03 (Profile Completion):** On first login, the customer is prompted for their Name. Email is optional for digital tax invoices.

### 2.5 Payment & Order Placement
- **FR-PAY-01 (Supported Payment Methods):**
  - **Online Payment (Razorpay):** Supports UPI (Google Pay, PhonePe, Paytm), Credit Cards, Debit Cards, and NetBanking.
  - **Cash at Pickup:** Customer reserves order online and commits to paying cash directly at the counter upon collection.
- **FR-PAY-02 (Server-Side Price Authority):** The client application never submits prices. The client submits only `{ product_id, quantity }`. The server calculates item prices, discounts, and taxes using live database values.
- **FR-PAY-03 (Stock Reservation Window):** Before opening the Razorpay payment gateway, the server temporarily reserves stock for 10 minutes. If payment fails or times out, the stock is released automatically.
- **FR-PAY-04 (Order Confirmation):** An order is marked `Confirmed` only when:
  - For Online Payment: Server receives a cryptographically verified Razorpay webhook or server-to-server signature validation.
  - For Cash at Pickup: The order passes fraud/rate-limit checks and stock is successfully reserved.

### 2.6 Order Tracking & Digital Collection Pass
- **FR-TRK-01 (Unique Identifiers):** Every confirmed order generates:
  - A friendly, human-readable Order Number (e.g., `MO-2610-042`).
  - A secure, unique **4-digit Collection PIN** (e.g., `8391`).
  - An encrypted **Collection QR Code** encoding the Order ID and a secure verification hash.
- **FR-TRK-02 (Live Status Progression):** The customer's tracking screen updates in real time via WebSockets through the following state pipeline:
  ```
  Pending Payment -> Confirmed -> Preparing -> Ready for Pickup -> Completed
                                      \
                                       -> Cancelled / Expired
  ```
- **FR-TRK-03 (Store Pickup Guidance):** The screen displays store address, an interactive Google Maps location link, store phone number, and instructions: *"Show your Collection PIN or QR code at the counter."*

---

## 3. Store Staff & Admin Functional Requirements (Admin Web)

### 3.1 Live Dispatch & Counter Order Queue
- **FR-ADM-01 (Real-time Kanban Board):** A multi-column, real-time board grouping active orders:
  - Column 1: `New / Confirmed` (Ordered by scheduled pickup time urgency).
  - Column 2: `Preparing` (Kitchen actively assembling/packing).
  - Column 3: `Ready for Pickup` (Staged on counter shelves awaiting customer).
  - Column 4: `Completed Today` (Audit log of collected orders).
- **FR-ADM-02 (Audio-Visual Alerts):**
  - Distinct auditory chime on incoming orders.
  - Flashing badge notification for urgent orders (immediate pickup or scheduled slot starting within 15 minutes).
- **FR-ADM-03 (Customer Identification & Handover Verification):**
  - Staff can quickly search orders by customer phone number, customer name, or Order ID.
  - **Handover Verification Modal:** Staff scans customer's QR code via USB webcam / mobile camera, OR enters the customer's 4-digit Collection PIN. The system validates the token and surfaces the order details.
- **FR-ADM-04 (Cash-at-Pickup Enforcement):** If an order is marked `payment_method = cash_at_pickup` and `payment_status = unpaid`:
  - The UI displays a high-contrast warning: *"COLLECT CASH: ₹X.XX"*.
  - The staff must check a mandatory confirmation box: *"Cash received in register"* before the order can transition to `Completed`.

### 3.2 Inventory & Menu Management
- **FR-INV-01 (Product CRUD):** Admin can create, read, update, and soft-delete products (Name, Category, Description, Base Price, Tax %, Prep Time, Dietary Tags).
- **FR-INV-02 (Product Image Upload):** Direct image upload to Supabase Storage with client-side image compression and validation (max 5MB, JPEG/PNG/WebP).
- **FR-INV-03 (Real-Time Stock Adjustment):**
  - Immediate manual stock count updates (e.g., setting available Mango Juice bottles to 18).
  - Mandatory audit reason selection: `Morning Batch Restock`, `Physical Count Correction`, `Damaged / Expired / Spoilage`.
- **FR-INV-04 (Emergency Stock Freeze):** A one-click toggle to immediately mark any item as "Out of Stock" across both the customer website and Android application.

### 3.3 Operational Configuration
- **FR-OPS-01 (Store Status Switch):** Emergency "Master Store Toggle" to flip store status: `Open`, `Busy / Temporarily Paused (15/30/60 mins)`, or `Closed`.
- **FR-OPS-02 (Slot Capacity Configuration):** Admin can tune the maximum allowable orders per 15-minute pickup window based on counter staffing levels.
- **FR-OPS-03 (Special Closures & Holiday Calendar):** Ability to block specific dates or times from the scheduled pickup calendar.

### 3.4 Operational & Financial Reporting
- **FR-REP-01 (Daily Cash Drawer Reconciliation):**
  - Summary of total orders fulfilled today.
  - Exact breakdown: Total Online Collected (Razorpay) vs. Total Cash Collected at Counter.
- **FR-REP-02 (Product Sales Velocity):** Real-time counter of top-selling items today (e.g., "Dutch Chocolate Cake: 14 sold, 2 remaining").
- **FR-REP-03 (Cancellation & Spoilage Log):** Detailed log of all cancelled orders, associated cancellation reasons, and recorded inventory waste.

---

## 4. Non-Functional Requirements (NFRs)

### 4.1 Performance & Latency
- **NFR-PER-01 (Page Load Time):** Customer website must achieve First Contentful Paint (FCP) < 1.2 seconds and Largest Contentful Paint (LCP) < 2.2 seconds on 4G mobile connections.
- **NFR-PER-02 (API Response Time):** Server API response time for catalog browsing and cart validation must be under 300ms at the 95th percentile (p95).
- **NFR-PER-03 (Realtime Synchronization):** WebSocket status broadcasts from Admin action to Customer UI update must propagate within 800ms.
- **NFR-PER-04 (Cold Start Optimization):** Android application cold startup time to interactive home screen must be < 1.8 seconds on standard mid-tier devices (e.g., Snapdragon 600-series equivalent).

### 4.2 Concurrency & Data Integrity
- **NFR-CON-01 (Zero Overselling):** Database transactions must enforce serializable or row-locked atomic operations (`SELECT ... FOR UPDATE`) during checkout. Under no circumstances may 2 customers be confirmed for a single remaining stock unit.
- **NFR-CON-02 (Idempotent Payment Handling):** Razorpay webhook processors must be strictly idempotent. Repeated webhook deliveries with identical payment IDs must produce identical state without duplicate receipts or stock reductions.

### 4.3 Reliability & Availability
- **NFR-REL-01 (Uptime SLA):** 99.9% uptime during operational store hours (08:00 AM – 11:00 PM IST).
- **NFR-REL-02 (Graceful Degradation):** If real-time WebSockets disconnect due to spotty mobile coverage, client apps must automatically fall back to exponential backoff polling (5s, 10s, 20s) without crashing.
- **NFR-REL-03 (Offline Cart Safety):** The Android app must cache catalog data in local Room storage, allowing customers to browse items even if network connectivity temporarily drops.

### 4.4 Usability & Accessibility
- **NFR-USA-01 (Touch Targets):** All interactive buttons and touch targets on mobile web and Android app must meet the minimum standard of 48x48 dp/px.
- **NFR-USA-02 (Counter Admin Ergonomics):** The Admin Live Queue UI must be optimized for tablet-mounted counter kiosks (high contrast, large typography, one-tap status updates, audible cues).
- **NFR-USA-03 (Localization):** All currency displays must adhere to Indian numbering norms (`₹1,50,000`). All timestamps must be localized to Indian Standard Time (IST, UTC+05:30).

### 4.5 Security & Privacy
- **NFR-SEC-01 (Zero Privilege Exposure):** No database service-role secrets, private payment gateway keys, or admin tokens may ever exist in client code bundles.
- **NFR-SEC-02 (Customer Isolation):** Database Row Level Security (RLS) must prevent any authenticated customer from viewing, modifying, or guessing any other customer's order records.
- **NFR-SEC-03 (Input Sanitization):** All inputs must be strictly validated via Zod schemas on the web server and Kotlin data serialization contracts on Android.
