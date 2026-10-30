# Moody Orange — System Architecture Specification

**Document Version:** 1.1.0 (Phase 0.1 Revision)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial architectural proposal with API embedded in Customer Next.js app. |
| **1.1.0** | 2026-10-30 | Lead Architect | **Phase 0.1 Revision:**<br>• Decoupled Backend API into an independent practical modular monolith (`apps/backend-api`).<br>• Evaluated modular monolith vs. microservices vs. embedded architectures with trade-offs.<br>• Added explicit data flow and automated reconciliation for late payment webhooks.<br>• Classified requirements and clarified client vs. backend boundaries. |

---

## 1. Architectural Strategy & Evaluation

### 1.1 Core Architectural Principles
1. **Single Authoritative Source of Truth:** `[CONFIRMED]` All business calculations, price determinations, stock balances, tax calculations, and order state progressions are enforced strictly on the server and database. Client applications are presentation layers with zero authority to dictate prices or stock.
2. **Zero-Trust Client Inputs:** `[CONFIRMED]` The backend never accepts client-calculated totals or arbitrary payment confirmation signals.
3. **Atomic Concurrency Guarantee:** `[CONFIRMED]` Inventory reservations use strict row-level locking (`SELECT ... FOR UPDATE`) in PostgreSQL to guarantee that race conditions and overselling cannot occur.
4. **Asynchronous Webhook-First Settlement:** `[CONFIRMED]` Payment capture is confirmed exclusively via cryptographically signed webhooks and direct server-to-gateway verification, never client-side redirects alone.
5. **Independent Backend Separation:** `[CONFIRMED ARCHITECTURE]` The backend API is logically and deployably independent from both the customer-facing and admin-facing web applications.

---

### 1.2 Evaluation of Backend Topology: Modular Monolith vs. Alternatives

To fulfill the requirement that Customer Web, Admin Web, and Native Android App consume the **exact same authoritative backend contracts and business rules**, three architecture patterns were evaluated:

```
+───────────────────────────────────────────────────────────────────────────────+
| PATTERN A: Embedded API in Customer Next.js App (PREVIOUS PROPOSAL)          |
| Pros: Low infrastructure count (single web server).                           |
| Cons: Tight coupling. Scaling or deploying customer website restarts backend; |
|       Android app and Admin panel depend on Customer Web deployment stability.|
| Status: REJECTED                                                              |
+───────────────────────────────────────────────────────────────────────────────+

+───────────────────────────────────────────────────────────────────────────────+
| PATTERN B: Microservices (Catalog Service, Order Service, Payment Service)     |
| Pros: Independent scaling of individual business domains.                     |
| Cons: Extreme operational complexity, distributed transactions (sagas),        |
|       network latency overhead, multiple CI/CD pipelines, unnecessary for a   |
|       single physical retail store.                                           |
| Status: REJECTED (Unwarranted complexity)                                     |
+───────────────────────────────────────────────────────────────────────────────+

+───────────────────────────────────────────────────────────────────────────────+
| PATTERN C: Practical Modular Monolith Backend API (RECOMMENDED)               |
| Location: apps/backend-api (Node.js / TypeScript REST API)                    |
| Pros:                                                                         |
| • Independently deployable and isolated from frontend web apps.               |
| • Single, authoritative REST API (/api/v1/...) consumed identically by        |
|   Customer Web, Admin Web, and Native Android App.                            |
| • Internal modular domains (Catalog, Orders, Payments, Staff) share a single  |
|   high-performance codebase and single PostgreSQL connection pool.            |
| • Zero distributed transaction overhead; uses Postgres ACID transactions.     |
| Status: ACCEPTED & ADOPTED                                                    |
+───────────────────────────────────────────────────────────────────────────────+
```

---

### 1.3 Technology Stack Evaluation

| Proposed Component | Proposed Usage | Evaluation & Architectural Decision | Status |
| :--- | :--- | :--- | :--- |
| **PostgreSQL 15+** | Relational Database | ACID transactional reliability, row-level locking (`SELECT ... FOR UPDATE`), check constraints, and JSONB audit logging. | `[CONFIRMED]` |
| **Supabase Platform** | Managed BaaS | Managed Postgres, connection pooling (PgBouncer/Supavisor), Auth, Storage, and Realtime out of the box. Direct client mutations to orders/inventory are blocked via RLS. | `[CONFIRMED]` |
| **Standalone Backend API** | Authoritative REST API (`apps/backend-api`) | Node.js/TypeScript modular monolith. Executes Zod input validation, Razorpay SDK operations, webhook verification, and calls PostgreSQL Stored Procedures. | `[CONFIRMED ARCHITECTURE]` |
| **Customer Web** | Customer Storefront (`apps/customer-web`) | Next.js (App Router), TypeScript. Server components for catalog SEO; client components for cart, checkout, and tracking. | `[CONFIRMED]` |
| **Native Android App** | Mobile App (`apps/android`) | 100% Native Kotlin, Jetpack Compose. Zero web wrappers or cross-platform bridges. Consumes `/api/v1/...` REST endpoints. | `[CONFIRMED]` |
| **Admin Web** | Counter Portal (`apps/admin-web`) | Next.js (App Router), TypeScript. Realtime queue board, audio alert integration, PIN/QR collection verification modal. | `[CONFIRMED]` |
| **Razorpay Gateway** | Payment Engine | Indian payment gateway supporting UPI, Cards, NetBanking. HMAC-SHA256 webhook signatures and refund APIs. | `[CONFIRMED]` |

---

## 2. High-Level System Architecture Topology

```mermaid
graph TB
    subgraph "Client Presentation Layer"
        CW["Customer Website<br/>(Next.js / TypeScript)<br/>shop.moodyorange.com"]
        AA["Native Android App<br/>(Kotlin / Jetpack Compose)<br/>Google Play Build"]
        AW["Admin & Counter Web<br/>(Next.js / TypeScript)<br/>admin.moodyorange.com"]
    end

    subgraph "Edge & Network Boundary"
        CDN["Cloudflare Edge CDN / Reverse Proxy<br/>(SSL Termination, DDoS, API Routing)"]
    end

    subgraph "Compute Layer: Modular Monolith"
        API["Authoritative Backend API (apps/backend-api)<br/>(Node.js / TypeScript REST Service)<br/>Endpoints: /api/v1/*"]
        
        subgraph "Internal Domain Modules"
            MOD_CAT["Catalog Module"]
            MOD_ORD["Order & Reservation Engine"]
            MOD_PAY["Payment & Webhook Engine"]
            MOD_STF["Staff & Counter Module"]
        end
        API --- MOD_CAT
        API --- MOD_ORD
        API --- MOD_PAY
        API --- MOD_STF
    end

    subgraph "Managed Data & Infrastructure (Supabase VPC)"
        AUTH["Supabase Auth<br/>(Phone OTP & JWT Verification)"]
        RT["Supabase Realtime<br/>(WebSocket CDC Broadcast)"]
        ST["Supabase Storage<br/>(Product Images Bucket CDN)"]
        PG[("PostgreSQL 15+ Database<br/>- Row Level Security (RLS)<br/>- Stored Procedures (RPCs)<br/>- ACID Concurrency Locks")]
    end

    subgraph "External Payment & Telecom Partners"
        RP["Razorpay Gateway<br/>(Orders API, Webhooks, Refunds API)"]
        SMS["SMS Gateway (Msg91 / Twilio)<br/>(TRAI DLT Verified OTP)"]
    end

    %% Client traffic
    CW --> CDN
    AA --> CDN
    AW --> CDN
    CDN -->|"API Requests /api/v1/*"| API

    %% Auth Flows
    CW -.->|"OTP Request/Verify"| AUTH
    AA -.->|"OTP Request/Verify"| AUTH
    AW -.->|"Staff Login"| AUTH
    AUTH --> SMS

    %% Backend to Database & External
    API -->|"Privileged Transactions (Service Role / RPC)"| PG
    API -->|"Create Order / Fetch Details"| RP
    API -->|"Initiate Automatic Refunds"| RP
    RP -->|"Asynchronous Webhooks (HMAC-SHA256)"| API

    %% Storage & Realtime
    AW -->|"Upload Media"| ST
    ST -.->|"Public Image CDN"| CW
    ST -.->|"Public Image CDN"| AA
    PG --> RT
    RT -.->|"Order Channel"| CW
    RT -.->|"Order Channel"| AA
    RT -.->|"Live Queue Channel"| AW
```

---

## 3. End-to-End Data Flows

### 3.1 Flow 1: Order Placement & Atomic Stock Reservation

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Web / Android)
    participant API as Backend API (/api/v1/orders/checkout)
    participant DB as PostgreSQL Database
    participant RP as Razorpay API

    Customer->>API: POST /api/v1/orders/checkout<br/>{ items: [{product_id, qty}], fulfillment_type, pickup_time }
    Note over API: 1. Verify Supabase JWT & validate payload via Zod
    API->>DB: CALL rpc_reserve_order_stock(...)
    
    critical Atomic Database Transaction
        DB->>DB: SELECT current_stock, reserved_stock FROM inventory<br/>WHERE product_id IN (...) FOR UPDATE
        alt Available Stock Insufficient
            DB-->>API: ROLLBACK (Error: INSUFFICIENT_STOCK)
            API-->>Customer: 409 Conflict ("One or more items are out of stock")
        else Stock Available
            DB->>DB: UPDATE inventory SET reserved_stock = reserved_stock + qty
            DB->>DB: INSERT INTO orders (order_status='payment_pending', expires_at=NOW()+10min)
            DB->>DB: INSERT INTO order_items (snapshot unit_price, tax_rate)
            DB-->>API: COMMIT (order_id, calculated_total_amount)
        end
    end

    alt Online Payment Selected
        API->>RP: POST /v1/orders (amount: total_in_paise, currency: 'INR', receipt: order_id)
        RP-->>API: { razorpay_order_id: "order_xyz123" }
        API->>DB: UPDATE orders SET provider_order_id = 'order_xyz123'
        API-->>Customer: 201 Created { order_id, razorpay_order_id, amount, expires_at }
    else Cash at Pickup Selected
        API->>DB: UPDATE orders SET order_status='confirmed', payment_status='unpaid'
        API-->>Customer: 201 Created { order_id, status: 'confirmed', collection_token }
    end
```

---

### 3.2 Flow 2: Razorpay Asynchronous Webhook & Standard Payment Settlement

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant Gateway as Razorpay Checkout SDK
    participant RP as Razorpay Server
    participant WebhookAPI as Backend API (/api/v1/webhooks/razorpay)
    participant DB as PostgreSQL Database
    participant RT as Supabase Realtime

    Customer->>Gateway: Submits Payment (UPI / Card / NetBanking)
    Gateway->>RP: Authorize & Capture Funds
    RP-->>Gateway: Payment Captured Successfully
    Gateway-->>Customer: Display Client-Side Success Cue (Awaiting Confirmation)

    Note over RP,WebhookAPI: Independent Asynchronous Webhook
    RP->>WebhookAPI: POST /api/v1/webhooks/razorpay<br/>Header: X-Razorpay-Signature<br/>Payload: { event: "payment.captured", payment_id, order_id }

    Note over WebhookAPI: 1. Verify HMAC-SHA256 signature against RAZORPAY_WEBHOOK_SECRET
    alt Invalid Signature
        WebhookAPI-->>RP: 400 Bad Request (Log Security Alert)
    else Signature Valid
        Note over WebhookAPI: 2. Idempotency Check: Check provider_payment_id in payments table
        alt Payment Already Processed
            WebhookAPI-->>RP: 200 OK (Duplicate ignored safely)
        else First-Time Processing
            WebhookAPI->>DB: CALL rpc_finalize_payment_success(payment_payload)
            critical Atomic State Transition
                DB->>DB: INSERT INTO payments (status='paid', provider_payment_id=...)
                DB->>DB: UPDATE orders SET order_status='confirmed', payment_status='paid'
                DB->>DB: Keep reserved_stock locked (committed for physical pickup)
            end
            DB->>RT: Emit status event on 'orders:order_id' & 'store:orders'
            RT-->>Customer: Live Screen Updates: "Order Confirmed!"
            RT-->>Admin: Ring Audio Alert + Insert Card in Live Queue
            WebhookAPI-->>RP: 200 OK
        end
    end
```

---

### 3.3 Flow 2B: Late Webhook Arrival After Reservation Expiry (Critical Edge Case)

This scenario occurs when a customer's payment window lapses, their stock reservation expires, another customer purchases the remaining stock, and Razorpay subsequently delivers a delayed `payment.captured` webhook.

```mermaid
sequenceDiagram
    autonumber
    participant RP as Razorpay Server
    participant WebhookAPI as Backend API (/api/v1/webhooks/razorpay)
    participant DB as PostgreSQL Database
    participant RP_API as Razorpay Refunds API
    participant RT as Supabase Realtime

    RP->>WebhookAPI: POST /api/v1/webhooks/razorpay (payment.captured for expired Order A)
    Note over WebhookAPI: Verify HMAC-SHA256 Signature (Valid)
    
    WebhookAPI->>DB: CALL rpc_reconcile_late_payment(payment_details)
    critical Atomic Reconciliation Evaluation
        DB->>DB: SELECT order_status, expires_at FROM orders WHERE id = order_a_id FOR UPDATE
        Note over DB: Order A is 'expired'. Stock reservation was previously released.
        DB->>DB: Check if current inventory can fulfill Order A's items:
        DB->>DB: SELECT (current_stock - reserved_stock) FROM inventory WHERE product_id = ... FOR UPDATE
        alt Inventory IS Still Available
            DB->>DB: Re-reserve stock: reserved_stock = reserved_stock + qty
            DB->>DB: UPDATE orders SET order_status = 'confirmed', payment_status = 'paid'
            DB-->>WebhookAPI: Status: CONFIRMED_REALLOCATED
        else Inventory IS NOT Available (Sold Out to Another Customer)
            DB->>DB: Record payment in payments table with status 'unallocatable_needs_refund'
            DB->>DB: UPDATE orders SET order_status = 'cancelled_inventory_depleted', payment_status = 'refund_pending'
            DB-->>WebhookAPI: Status: INSUFFICIENT_STOCK_TRIGGER_REFUND
        end
    end

    alt Inventory Was Reallocated
        WebhookAPI-->>RP: 200 OK
        DB->>RT: Push "Confirmed" to customer and admin
    else Inventory Was Depleted (Automatic Refund Flow)
        Note over WebhookAPI: Trigger Automated Full Refund via Gateway
        WebhookAPI->>RP_API: POST /v1/payments/{payment_id}/refund<br/>{ amount: order_total, notes: { reason: "stock_depleted_after_reservation_expiry" } }
        RP_API-->>WebhookAPI: { refund_id: "rfnd_abc123", status: "processed" }
        
        WebhookAPI->>DB: INSERT INTO refunds (order_id, provider_refund_id, amount, status='processed')
        WebhookAPI->>DB: UPDATE orders SET payment_status = 'refunded'
        DB->>RT: Push notification to Customer: "Order cancelled due to stock exhaustion. Full refund issued."
        DB->>RT: Push alert to Admin Live Queue: "Late order #A unfulfilled; auto-refund processed."
        WebhookAPI-->>RP: 200 OK
    end
```

---

### 3.4 Flow 3: Counter Pickup Verification & Order Handover

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (At Counter)
    actor Staff as Counter Staff (Admin Web)
    participant AdminUI as Admin Web Interface
    participant API as Backend API (/api/v1/staff/orders)
    participant DB as PostgreSQL Database
    participant RT as Supabase Realtime

    Customer->>Staff: Identifies Order (Presents PIN / QR / Order Number)
    Staff->>AdminUI: Enters Token or Scans QR in Handover Modal
    AdminUI->>API: POST /api/v1/staff/orders/verify { token: "..." }
    API->>DB: SELECT * FROM orders WHERE id = ... AND order_status = 'ready_for_pickup'
    DB-->>API: Return order details and payment status
    API-->>AdminUI: Render Order Verification Modal

    alt Order is Cash at Pickup (Unpaid)
        AdminUI->>Staff: Prompt: "COLLECT CASH: ₹X.XX"
        Staff->>Customer: Collects Cash and places in cash drawer
        Staff->>AdminUI: Checks box: [x] "Cash Received in Register" & Clicks "Complete"
        AdminUI->>API: POST /api/v1/staff/orders/complete { order_id, cash_collected: true }
        critical Commit Cash Payment and Order
            API->>DB: UPDATE orders SET order_status='completed', payment_status='paid', collected_at=NOW()
            API->>DB: UPDATE inventory SET current_stock = current_stock - qty, reserved_stock = reserved_stock - qty
            API->>DB: INSERT INTO payments (provider='cash', status='paid', amount=...)
        end
    else Order is Prepaid Online
        Staff->>AdminUI: Clicks "Handover & Complete"
        AdminUI->>API: POST /api/v1/staff/orders/complete { order_id }
        critical Commit Physical Stock Deduction
            API->>DB: UPDATE orders SET order_status='completed', collected_at=NOW()
            API->>DB: UPDATE inventory SET current_stock = current_stock - qty, reserved_stock = reserved_stock - qty
        end
    end

    DB->>RT: Broadcast order_status = 'completed'
    RT-->>Customer: Screen updates: "Order Completed. Thank you for visiting!"
    AdminUI-->>Staff: Card moves to "Completed Today"
```

---

## 4. Subsystem Architectures

### 4.1 Authoritative Backend API (`apps/backend-api`)
- **Runtime:** Node.js LTS (v20+) with TypeScript.
- **Framework Choice:** Fastify or Express (Fastify recommended for low overhead and native JSON schema serialization).
- **Core Responsibilities:**
  - Route Handlers under `/api/v1/` for catalog, cart, checkout, staff verification, and webhooks.
  - Zod validation on every incoming request.
  - Razorpay SDK management (server-only key secrets).
  - PostgreSQL stored procedure invocation using the Supabase Service Role client.

### 4.2 Customer Website (`apps/customer-web`)
- **Framework:** Next.js (App Router), TypeScript, Vanilla CSS / design tokens.
- **Rendering Pattern:**
  - Server-Side Rendering (SSR) & Incremental Static Regeneration (ISR) for fast SEO-indexed catalog browsing.
  - Client components for interactive cart, OTP modal, checkout, and live tracking.
- **Data Fetching:** Direct read queries to Supabase PostgREST for public catalog; all mutations route to `apps/backend-api` at `/api/v1/*`.

### 4.3 Native Android Application (`apps/android`)
- **Technology:** 100% Native Kotlin, Jetpack Compose, Material 3.
- **Architecture:** Clean Architecture + MVI (Model-View-Intent).
- **Networking:** Retrofit2 / OkHttp client consuming `https://api.moodyorange.com/api/v1/`.
- **Data Models:** Authored Kotlin data classes strictly matching the `/api/v1/` REST JSON contracts.
- **Local Persistence:** Jetpack Room for offline catalog caching; DataStore for session tokens.

### 4.4 Admin Counter Website (`apps/admin-web`)
- **Framework:** Next.js (App Router), TypeScript.
- **Layout:** High-density, high-contrast dashboard optimized for 10-inch counter tablets and desktop POS displays.
- **Hardware Integration:** Supports camera-based QR scanning via WebRTC or USB keyboard-wedge barcode scanners.
- **Live Dispatch Queue:** Subscribed to Supabase Realtime WebSocket channel `store:orders`.
