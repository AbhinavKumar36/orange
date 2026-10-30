# Moody Orange — Comprehensive Testing Strategy & Quality Assurance Plan

**Document Version:** 1.4.1 (Phase 0.4.1 Final Blocker Resolution)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Ready for Phase 0 Approval Review  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial test scenarios and quality pyramid. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Added late webhook automated refund test. |
| **1.2.0** | 2026-10-30 | Lead Architect | Phase 0.2 Revision: Standardized `physical_stock` and multi-product row lock tests. |
| **1.3.0** | 2026-10-30 | Lead Architect | Phase 0.3 Consistency Pass: Cart validation tests, idempotency isolation, cumulative refund cap tests. |
| **1.4.0** | 2026-10-30 | Lead Architect | Phase 0.4 Consistency Pass: Dual-layer security, raw-body HMAC, and evidence-based refunds. |
| **1.4.1** | 2026-10-30 | Lead Architect | **Phase 0.4.1 Final Blocker Resolution:**<br>• Added Scenario 15: Inventory Write-Off Safety with Active Reservations (`rpc_write_off_inventory`).<br>• Added Scenario 16: Cash Order Immunity to Online Payment Expiration Worker.<br>• Added Scenario 17: Concurrent Partial Refunds Cap & Locking.<br>• Explicitly clarified that all test scenarios are documented designs (zero automated code executed in Phase 0). |

---

## 1. Testing Philosophy & Quality Pyramid

Testing for Moody Orange follows a layered quality pyramid to ensure stability across Web, Android, Backend API, and Database:

```
                  / \
                 / E2E \             Playwright (Web) & Compose UI Tests (Android)
                / Tests \            Critical User Journeys, Webhook Simulation
               /─────────\
              /Integration\          Supertest (Backend API Routes), pgTAP
             /    Tests    \         RLS Security Policies, Database RPCs
            /───────────────\
           /      Unit       \       Vitest (TS) & JUnit 5 / MockK (Kotlin)
          /      Tests        \      Pricing Math, StateFlow ViewModels, Zod Schemas
         /─────────────────────\
        / Concurrency & Stress  \    k6 Load Scripts
       /─────────────────────────\   Inventory Lock Contention, Peak Rush Simulation
```

---

## 2. Critical Edge-Case Test Scenarios

The following 17 critical scenarios must pass automated or scripted integration tests before any release candidate is approved:

### 2.1 Scenario 1: Duplicate Product IDs in Cart & Safe Aggregation
- **Objective:** Verify that when a client sends duplicate product IDs in an order payload, quantities are safely aggregated before stock checks.
- **Setup:** Product A has `physical_stock = 5`, `reserved_stock = 0` (`available_stock = 5`).
- **Action:** Client sends: `{ "items": [{ "product_id": "A", "quantity": 2 }, { "product_id": "A", "quantity": 1 }] }`.
- **Expected Outcome:**
  - `rpc_reserve_order_stock` aggregates Product A to `quantity = 3`.
  - Transaction succeeds (`201 Created`). `reserved_stock` updates to 3 (`available_stock = 2`).
  - No duplicate key violations or multiple row updates occur.

### 2.2 Scenario 2: Invalid Quantities & Empty Cart Rejection
- **Objective:** Ensure invalid inputs are rejected at both API and database levels.
- **Action A:** Client sends empty items: `{ "items": [] }`.
- **Action B:** Client sends negative quantity: `{ "items": [{ "product_id": "A", "quantity": -2 }] }`.
- **Action C:** Client sends zero quantity: `{ "items": [{ "product_id": "A", "quantity": 0 }] }`.
- **Expected Outcome:**
  - In all cases, transaction immediately aborts with `HTTP 400 Bad Request`.
  - Zero stock is modified; no database records are created.

### 2.3 Scenario 3: Customer-Scoped Idempotency Isolation
- **Objective:** Verify that Customer B cannot retrieve or access Customer A's order by guessing Customer A's idempotency key.
- **Setup:** Customer A submits checkout with `client_idempotency_key = "key-123"`, creating Order `#101`.
- **Action:** Customer B submits checkout with identical `client_idempotency_key = "key-123"`.
- **Expected Outcome:**
  - The unique constraint is scoped to `(customer_id, client_idempotency_key)`.
  - Customer B's request does NOT return Customer A's order.
  - A new, distinct order is created for Customer B (or isolated properly).

### 2.4 Scenario 4: Idempotency Key Reused with Mismatched Payload Rejection
- **Objective:** Ensure that reusing an idempotency key with a materially different payload is rejected.
- **Setup:** Customer A submits checkout with `key-123` for Product A (qty 1).
- **Action:** Customer A submits a second checkout with `key-123` for Product B (qty 2).
- **Expected Outcome:**
  - The procedure compares `p_payload_hash` against `orders.client_payload_hash`.
  - Mismatch detected: procedure raises exception; API returns `HTTP 409 Conflict` ("Idempotency key reused with mismatched order payload").

### 2.5 Scenario 5: Concurrent Multi-Product Orders & Deadlock Prevention
- **Objective:** Verify that concurrent orders containing multiple products in opposite order do not deadlock.
- **Setup:** 
  - Product A: `physical_stock = 5`, `reserved_stock = 0`.
  - Product B: `physical_stock = 5`, `reserved_stock = 0`.
- **Action:**
  - User 1 requests: `[Product A (qty 1), Product B (qty 1)]`.
  - User 2 simultaneously requests: `[Product B (qty 1), Product A (qty 1)]`.
- **Expected Outcome:**
  - Both transactions sort product IDs deterministically (`ORDER BY product_id ASC`) before acquiring row locks.
  - Both transactions execute and commit successfully without throwing a PostgreSQL 40P01 deadlock exception.

### 2.6 Scenario 6: All-or-Nothing Multi-Product Atomic Reservation (No Partial Allocations)
- **Objective:** Verify that if an order contains multiple items and even one item has insufficient stock, zero items are reserved.
- **Setup:**
  - Product A: `physical_stock = 10`, `reserved_stock = 0` (`available_stock = 10`).
  - Product B: `physical_stock = 1`, `reserved_stock = 0` (`available_stock = 1`).
- **Action:** Customer requests checkout for: `[Product A (qty 2), Product B (qty 2)]`.
- **Expected Outcome:**
  - Pre-validation loop detects Product B has only 1 unit available.
  - Entire transaction aborts and rolls back immediately with `HTTP 409 Conflict`.
  - In `public.inventory`: Product A `reserved_stock = 0` (untouched); Product B `reserved_stock = 0` (untouched). Zero partial reservations.

### 2.7 Scenario 7: Abandoned Online Payment & Stock Auto-Release (TTL Cleanup)
- **Objective:** Verify that stock locked by an abandoned online checkout session is returned to the available pool.
- **Setup:** Customer reserves 1 unit of juice online (`payment_method = 'online_razorpay'`). `reserved_stock` increments to 1 (`available_stock = physical_stock - 1`).
- **Action:** Customer closes the browser without paying. Clock advances 10 minutes past `expires_at`. The scheduled procedure `rpc_release_expired_reservations()` executes.
- **Expected Outcome:**
  - Order status transitions from `draft` to `cancelled_expired`. Payment status becomes `expired`.
  - `reserved_stock` decrements back to 0. `available_stock` restores to original count.

### 2.8 Scenario 8: Successful Payment Does NOT Release Stock Reservation
- **Objective:** Verify that when payment succeeds, reserved stock remains locked for the customer's confirmed order.
- **Setup:** Order placed for 2 cakes; `physical_stock = 10`, `reserved_stock = 2` (`available_stock = 8`).
- **Action:** Razorpay `payment.captured` webhook arrives and is verified.
- **Expected Outcome:**
  - Order status transitions to `confirmed`. Payment status transitions to `captured`. `expires_at` becomes `NULL`.
  - In `public.inventory`, `physical_stock = 10`, `reserved_stock = 2`, `available_stock = 8`.
  - **Stock reservation is NOT released.**

### 2.9 Scenario 9: Cash-at-Pickup Order Completion Enforcement
- **Objective:** Verify that a cash order cannot be marked completed without explicit staff cash receipt confirmation.
- **Setup:** Cash order placed: `order_status = 'ready_for_pickup'`, `payment_status = 'unpaid'`.
- **Action A:** Staff attempts to mark completed with `cash_collected = false`.
- **Expected Outcome A:** Procedure rejects with exception: *"Cannot complete cash order without staff confirmation of cash receipt"*.
- **Action B:** Staff confirms cash received (`cash_collected = true`).
- **Expected Outcome B:** `order_status` becomes `completed`, `payment_status` becomes `captured`, and `physical_stock` and `reserved_stock` decrement by ordered quantity. Replay attempt fails.

### 2.10 Scenario 10: Late Webhook Arrival & Safe Atomic Recovery Decision
- **Objective:** Verify automated refund processing when a delayed payment arrives for an expired order whose stock was sold out.
- **Setup:** Customer A's reservation expires and stock drops to 0 after Customer B buys the last unit.
- **Action:** Delayed Razorpay webhook arrives for Customer A with event `payment.captured`.
- **Expected Outcome:**
  - `rpc_reconcile_late_payment` detects available stock is 0 and refuses confirmation.
  - Order transitions to `cancelled_inventory_depleted` with `payment_status = 'refund_pending'`.
  - Backend API dispatches refund request to Razorpay (`POST /v1/payments/{payment_id}/refund`).
  - Razorpay HTTP 200 response transitions payment status to `refund_processing` (NOT `refunded`).
  - Subsequent webhook `refund.processed` transitions payment status authoritatively to `refunded`.

### 2.11 Scenario 11: Cumulative Refund Cap Enforcement
- **Objective:** Ensure the system cannot issue refunds exceeding the captured payment amount.
- **Setup:** Order captured for ₹1,000. Existing refund of ₹600 in `refund_processing` status.
- **Action:** Staff attempts to issue an additional refund of ₹500.
- **Expected Outcome:**
  - Cumulative requested refund (₹600 + ₹500 = ₹1,100) exceeds captured amount (₹1,000).
  - Backend API and DB constraint reject request with `HTTP 422 Unprocessable Entity` ("Cumulative refund amount cannot exceed captured payment amount").

### 2.12 Scenario 12: Customer Data Isolation (Row Level Security & API Validation)
- **Objective:** Verify that a customer cannot read, guess, or modify another customer's orders or collection tokens.
- **Setup:** Customer A has Order `#101`. Customer B logs in via Phone OTP.
- **Action:** Customer B queries `GET /api/v1/orders/order_101_id`.
- **Expected Outcome:**
  - Backend API extracts `jwt.sub` (Customer B), verifies `order.customer_id != jwt.sub`, and returns `HTTP 403 Forbidden`.
  - Direct Supabase PostgREST query returns an empty set `[]` via RLS.

### 2.13 Scenario 13: Refund Gateway Network Timeout & Idempotent Reconciliation
- **Objective:** Verify that a network timeout during a refund API call does not trigger duplicate refunds.
- **Setup:** Captured payment of ₹500 requires refund. Backend generates stable idempotency key `rfnd_pay_123_uuid`.
- **Action:** Backend calls Razorpay Refunds API, but the HTTP connection times out with HTTP 504.
- **Expected Outcome:**
  - System does NOT issue a blind retry with a new key.
  - Refund record remains in `refund_pending` state.
  - A reconciliation worker queries `GET /v1/payments/pay_123/refunds` using the stable idempotency key to verify provider state.

### 2.14 Scenario 14: Conflicting or Unexpected Payment Webhook Isolation
- **Objective:** Ensure that webhooks for unknown or mismatched internal orders are quarantined safely.
- **Action:** A valid signed webhook arrives for an unknown `order_id` or mismatched amount.
- **Expected Outcome:**
  - System logs an alert and records the payment with status `reconciliation_required`.
  - Order table is not modified. Inventory is not modified. No stock is oversold.

### 2.15 Scenario 15: Inventory Write-Off Safety with Active Reservations
- **Objective:** Verify that staff reporting damaged stock cannot reduce physical stock below reserved stock or silently invalidate reservations.
- **Setup:** Product A has `physical_stock = 10`, `reserved_stock = 6` (`available_stock = 4`).
- **Action A (Damage absorbed by unreserved stock):** Staff reports 3 damaged units.
- **Expected Outcome A:** `physical_stock` decrements to 7, `reserved_stock` remains 6 (`available_stock = 1`). Audit log created. Check constraint `physical_stock >= reserved_stock` holds.
- **Action B (Damage exceeds unreserved stock):** Staff reports 5 damaged units directly.
- **Expected Outcome B:** `rpc_write_off_inventory` aborts with exception: *"INVENTORY_WRITE_OFF_BLOCKED: Damaged quantity (5) exceeds unreserved stock (4). Active customer reservations are impacted."*
- **Action C (Operational Resolution):** Manager explicitly cancels Customer Order X (2 units of Product A) due to damage. Order X status becomes `cancelled_damaged_stock`, `reserved_stock` drops to 4 (`available_stock = 6`), and refund is dispatched. Staff then executes write-off of 5 units.
- **Expected Outcome C:** `physical_stock` drops to 5, `reserved_stock` is 4 (`available_stock = 1`). Invariants hold and customer was authoritatively notified and refunded.

### 2.16 Scenario 16: Cash Order Immunity to Online Payment Expiration Worker
- **Objective:** Verify that background cleanup workers running for abandoned online checkouts never expire valid Cash-at-Pickup orders.
- **Setup:** Customer places Cash-at-Pickup order. Database inserts order with `order_status = 'confirmed'`, `payment_status = 'unpaid'`, `expires_at = NULL`.
- **Action:** 20 minutes elapse. `rpc_release_expired_reservations()` executes.
- **Expected Outcome:**
  - Expiration procedure filters strictly `WHERE order_status = 'draft' AND payment_method = 'online_razorpay' AND expires_at < NOW()`.
  - Cash order is completely ignored. Status remains `'confirmed'`, `payment_status = 'unpaid'`, and stock reservation remains held.

### 2.17 Scenario 17: Concurrent Partial Refunds Cap & Locking
- **Objective:** Verify that concurrent partial refund requests cannot exceed the captured payment amount.
- **Setup:** Order captured for ₹1,000.
- **Action:** Staff initiates two concurrent partial refunds: Refund A for ₹600, Refund B for ₹500.
- **Expected Outcome:**
  - Database locks the payment row `FOR UPDATE`.
  - Refund A commits first, creating a refund record for ₹600.
  - Refund B evaluates `remaining = ₹1,000 - ₹600 = ₹400`. Since ₹500 > ₹400, Refund B aborts with `HTTP 422 Unprocessable Entity` (`REFUND_EXCEEDS_REMAINING_AMOUNT`).

---

## 3. Future CI Contract Drift & Schema Validation Pipeline

*(Architect Note: The automated CI checks outlined below are specified for implementation in Phase 1 & 2. Zero executable tests have been run in Phase 0 documentation review, as application code and database migrations do not exist yet).*

1. **OpenAPI / JSON Schema Authoritative Drift Check:**
   - Source of truth: `packages/api-contracts/src/openapi.yaml`.
   - CI Pipeline step: Runs `spectral lint` on the OpenAPI specification to enforce API guidelines.
   - Generates TypeScript schemas (`zod`) and Kotlin data models via openapi-generator.
   - Drift gate: Fails the build if generated models deviate from checked-in client types.
2. **Database Migration Parity Check:**
   - Uses Supabase CLI (`supabase db diff`) in a test container against `packages/api-contracts` schemas to ensure database columns match DDL definitions.
3. **Android Client Serialization Test:**
   - Runs Kotlin Serialization round-trip unit tests on all API response models against live fixture payloads generated from the OpenAPI specification.
