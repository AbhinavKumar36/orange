# Moody Orange — System Architecture Specification

**Document Version:** 1.3.0 (Phase 0.3 Final Consistency Pass)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial architectural proposal with embedded Next.js API. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Decoupled standalone Backend API modular monolith (`apps/backend-api`). |
| **1.2.0** | 2026-10-30 | Lead Architect | Phase 0.2 Revision: Standardized `physical_stock` and multi-product deterministic row locks. |
| **1.3.0** | 2026-10-30 | Lead Architect | **Phase 0.3 Final Consistency Pass:**<br>• Hardened Flow 1 data flow: aggregated duplicate product IDs, validated positive quantities, scoped idempotency keys to customer with payload hash.<br>• Separated Cash-at-Pickup (`unpaid` state) from online payment gateway states; prevented cash order completion without verified cash receipt.<br>• Enforced deterministic `ORDER BY product_id ASC FOR UPDATE` locking across all inventory procedures.<br>• Documented authoritative Razorpay payment validation prior to DB procedure invocation.<br>• Formalized evidence-based refund state progression (`refund_pending` -> `refund_processing` -> `refunded`). |

---

## 1. Architectural Strategy & Evaluation

### 1.1 Core Architectural Principles
1. **Single Authoritative Source of Truth:** `[CONFIRMED]` All business calculations, prices, stock balances, taxes, and order state progressions are enforced strictly on the server and database. Client applications are presentation layers with zero authority to dictate prices or stock.
2. **Zero-Trust Client Inputs:** `[CONFIRMED]` The backend never accepts client-calculated totals, arbitrary payment confirmation signals, or client-asserted customer IDs. Customer identity is derived strictly from verified JWT `sub`.
3. **Atomic Multi-Product Concurrency Guarantee:** `[CONFIRMED]` Inventory reservations lock rows in deterministic ascending order (`ORDER BY product_id ASC`) to eliminate deadlocks, and pre-validate all line items before allocating stock on an all-or-nothing basis.
4. **Asynchronous Webhook-First Settlement & Evidence-Based Refunds:** `[CONFIRMED]` Payment capture and refunds are confirmed exclusively via cryptographically signed webhooks and direct gateway evidence, never client-side redirects alone.
5. **Independent Backend Separation:** `[CONFIRMED ARCHITECTURE]` The backend API is logically and deployably independent from both the customer-facing and admin-facing web applications.

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
            MOD_PAY["Payment & Refund Engine"]
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
        PG[("PostgreSQL 15+ Database<br/>- Row Level Security (RLS)<br/>- Hardened Stored Procedures (RPCs)<br/>- Deterministic Row Locks")]
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

## 3. Server-Side Authorization Architecture

Because the Backend API communicates with Supabase using the Service Role key (which deliberately bypasses PostgreSQL RLS), **the Backend API middleware must act as the authoritative security enforcement gateway**:

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
   [ 4. Input Validation & Customer-Scoped Idempotency Check ]
   Validate Zod schema; compute canonical payload hash; scope idempotency key to jwt.sub
          │
          ▼
   [ 5. Execute Privileged Database Transaction / RPC ]
```

---

## 4. End-to-End Data Flows

### 4.1 Flow 1: Multi-Product Order Placement & Deterministic Stock Reservation

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Web / Android)
    participant API as Backend API (/api/v1/orders/checkout)
    participant DB as PostgreSQL Database
    participant RP as Razorpay API

    Customer->>API: POST /api/v1/orders/checkout<br/>Headers: Authorization (JWT), X-Idempotency-Key<br/>Body: { items: [{product_id, qty}], fulfillment, pickup_time }
    
    Note over API: 1. Extract customer_id = jwt.sub<br/>2. Validate payload via Zod (quantities > 0, cart not empty)<br/>3. Compute payload hash for idempotency verification
    API->>DB: CALL rpc_reserve_order_stock(...)
    
    critical Atomic Multi-Product Database Transaction
        Note over DB: Check idempotency scoped to (customer_id, idempotency_key)
        alt Key Exists with Matching Payload Hash
            DB-->>API: Return existing order draft
        else Key Exists with Mismatched Payload
            DB-->>API: ROLLBACK (Error: IDEMPOTENCY_KEY_PAYLOAD_MISMATCH)
        end

        Note over DB: Aggregate duplicate product IDs: SUM(qty) GROUP BY product_id
        DB->>DB: Sort aggregated items deterministically: ORDER BY product_id ASC
        DB->>DB: SELECT physical_stock, reserved_stock FROM inventory<br/>WHERE product_id IN (...) ORDER BY product_id ASC FOR UPDATE
        
        Note over DB: Pre-validation of ALL items
        loop For Every Item in Aggregated Order
            DB->>DB: Check (physical_stock - reserved_stock) >= requested_qty
            alt Any Item Has Insufficient Stock
                DB-->>API: ROLLBACK (Error: INSUFFICIENT_STOCK)
                API-->>Customer: 409 Conflict ("Item X is out of stock. Zero items reserved.")
            end
        end

        Note over DB: Atomic All-or-Nothing Allocation
        loop For Every Item in Aggregated Order
            DB->>DB: UPDATE inventory SET reserved_stock = reserved_stock + qty
        end
        DB->>DB: INSERT INTO orders (order_status='draft', payment_status=INITIAL_STATUS, expires_at=NOW()+10min)
        DB->>DB: INSERT INTO order_items (snapshot unit_price, tax_rate)
        DB-->>API: COMMIT (order_id, calculated_total_amount)
    end

    alt Online Payment Selected (payment_status = 'pending')
        API->>RP: POST /v1/orders (amount: total_in_paise, currency: 'INR', receipt: order_id)
        RP-->>API: { razorpay_order_id: "order_xyz123" }
        API->>DB: UPDATE orders SET provider_order_id = 'order_xyz123'
        API-->>Customer: 201 Created { order_id, razorpay_order_id, amount, expires_at }
    else Cash at Pickup Selected (payment_status = 'unpaid')
        API->>DB: UPDATE orders SET order_status='confirmed', payment_status='unpaid'
        API-->>Customer: 201 Created { order_id, status: 'confirmed', collection_token }
    end
```

---

### 4.2 Flow 2: Razorpay Payment Settlement & Authoritative Verification

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
    RP->>WebhookAPI: POST /api/v1/webhooks/razorpay<br/>Header: X-Razorpay-Signature<br/>Payload: { event: "payment.captured", payment_id, order_id, amount, currency }

    Note over WebhookAPI: 1. Verify HMAC-SHA256 signature against RAZORPAY_WEBHOOK_SECRET
    alt Invalid Signature
        WebhookAPI-->>RP: 400 Bad Request (Log Security Alert)
    else Signature Valid
        Note over WebhookAPI: 2. Authoritative Verification: Verify payment_id, order_id, amount in paise, currency
        WebhookAPI->>DB: CALL rpc_finalize_payment_success(payment_payload)
        critical Atomic State Transition
            DB->>DB: Verify p_amount matches orders.total_amount
            DB->>DB: INSERT INTO payments (status='captured', provider_payment_id=...)
            DB->>DB: UPDATE orders SET order_status='confirmed', payment_status='captured'
            Note over DB: IMPORTANT: reserved_stock is NOT released!<br/>Confirmed orders hold reserved stock until collection.
        end
        DB->>RT: Emit status event on 'orders:order_id' & 'store:orders'
        RT-->>Customer: Live Screen Updates: "Order Confirmed!"
        RT-->>Admin: Ring Audio Alert + Insert Card in Live Queue
        WebhookAPI-->>RP: 200 OK
    end
```

---

### 4.3 Flow 2B: Late Webhook Arrival & Evidence-Based Refund Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant RP as Razorpay Server
    participant WebhookAPI as Backend API (/api/v1/webhooks/razorpay)
    participant DB as PostgreSQL Database
    participant RP_API as Razorpay Refunds API
    participant RT as Supabase Realtime

    RP->>WebhookAPI: POST /api/v1/webhooks/razorpay (event: payment.captured for Expired Order A)
    Note over WebhookAPI: Verify HMAC Signature, Order ID, Amount, Currency (Valid)
    
    WebhookAPI->>DB: CALL rpc_reconcile_late_payment(...)
    critical Atomic Reconciliation Evaluation
        DB->>DB: Lock inventory rows for Order A deterministically: ORDER BY product_id ASC FOR UPDATE
        Note over DB: Check if (physical_stock - reserved_stock) >= Order A items
        alt Inventory IS Still Available for ALL Items
            DB->>DB: Re-reserve stock: reserved_stock = reserved_stock + qty
            DB->>DB: UPDATE orders SET order_status = 'confirmed', payment_status = 'captured'
            DB-->>WebhookAPI: Status: CONFIRMED_REALLOCATED
        else Inventory IS NOT Available (Depleted)
            DB->>DB: INSERT INTO payments (status='refund_pending', provider_payment_id=...)
            DB->>DB: UPDATE orders SET order_status = 'cancelled_inventory_depleted', payment_status = 'refund_pending'
            DB-->>WebhookAPI: Status: INSUFFICIENT_STOCK_TRIGGER_REFUND
        end
    end

    alt Inventory Reallocated
        WebhookAPI-->>RP: 200 OK
        DB->>RT: Push "Confirmed" to customer and admin
    else Inventory Depleted (Evidence-Based Refund Workflow)
        Note over WebhookAPI: Step 1: Request Refund from Razorpay with Idempotency Key
        WebhookAPI->>RP_API: POST /v1/payments/{payment_id}/refund<br/>Headers: X-Refund-Idempotency-Key
        RP_API-->>WebhookAPI: HTTP 200 { id: "rfnd_123", status: "processed" }
        
        Note over WebhookAPI: Step 2: Gateway acceptance sets 'refund_processing', NOT 'refunded'!
        WebhookAPI->>DB: INSERT INTO refunds (provider_refund_id, status='refund_processing', idempotency_key=...)
        WebhookAPI->>DB: UPDATE orders SET payment_status = 'refund_processing'
        WebhookAPI-->>RP: 200 OK

        Note over RP,WebhookAPI: Step 3: Asynchronous Gateway Confirmation Webhook
        RP->>WebhookAPI: POST /api/v1/webhooks/razorpay (event: refund.processed)
        WebhookAPI->>DB: UPDATE refunds SET status = 'refunded'
        WebhookAPI->>DB: UPDATE orders SET payment_status = 'refunded'
        DB->>RT: Notify Customer: "Refund completed to original payment method."
        WebhookAPI-->>RP: 200 OK
    end
```

---

### 4.4 Flow 3: Counter Collection & Physical Stock Decrement

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

    alt Order is Cash at Pickup (payment_status = 'unpaid')
        AdminUI->>Staff: Prompt: "COLLECT CASH: ₹X.XX"
        Staff->>Customer: Collects Cash and places in cash register
        Staff->>AdminUI: Checks box: [x] "Cash Received in Register" & Clicks "Complete"
        AdminUI->>API: POST /api/v1/staff/orders/complete { order_id, cash_collected: true }
        critical Commit Cash Payment and Physical Stock Decrement
            Note over API,DB: CALL rpc_complete_order_handover(order_id, staff_id, cash_collected=true)
            DB->>DB: Verify payment_method='cash_at_pickup' AND cash_collected=true
            DB->>DB: Lock inventory rows: ORDER BY product_id ASC FOR UPDATE
            DB->>DB: UPDATE orders SET order_status='completed', payment_status='captured', collected_at=NOW()
            DB->>DB: UPDATE inventory SET physical_stock = physical_stock - qty, reserved_stock = reserved_stock - qty
            DB->>DB: INSERT INTO payments (provider='cash_register', status='captured', amount=...)
        end
    else Order is Prepaid Online (payment_status = 'captured')
        Staff->>AdminUI: Clicks "Handover & Complete"
        AdminUI->>API: POST /api/v1/staff/orders/complete { order_id }
        critical Commit Physical Stock Decrement
            Note over API,DB: CALL rpc_complete_order_handover(order_id, staff_id, cash_collected=false)
            DB->>DB: Lock inventory rows: ORDER BY product_id ASC FOR UPDATE
            DB->>DB: UPDATE orders SET order_status='completed', collected_at=NOW()
            DB->>DB: UPDATE inventory SET physical_stock = physical_stock - qty, reserved_stock = reserved_stock - qty
        end
    end

    DB->>RT: Broadcast order_status = 'completed'
    RT-->>Customer: Screen updates: "Order Completed. Thank you for visiting!"
    AdminUI-->>Staff: Card moves to "Completed Today"
```
