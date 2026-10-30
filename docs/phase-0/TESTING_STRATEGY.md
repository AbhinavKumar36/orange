# Moody Orange — Comprehensive Testing Strategy & Quality Assurance Plan

**Document Version:** 1.2.0 (Phase 0.2 Final Consistency Review)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial test scenarios and quality pyramid. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Added late webhook automated refund test. |
| **1.2.0** | 2026-10-30 | Lead Architect | **Phase 0.2 Final Consistency Review:**<br>• Enforced `physical_stock` and `reserved_stock` in all test fixtures.<br>• Added explicit test for concurrent multi-product orders and deterministic row-locking deadlock prevention.<br>• Added explicit test for all-or-nothing multi-product atomic rollback (zero partial reservations).<br>• Expanded refund lifecycle test: verified intermediate `refund_processing` state and gateway evidence requirements. |

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

The following 10 critical scenarios must pass automated or scripted integration tests before any release candidate is approved:

### 2.1 Scenario 1: High-Concurrency Flash Sale (Single Product Zero Overselling)
- **Objective:** Verify that when available stock is lower than concurrent demand, no race condition permits overselling.
- **Setup:** A specialty cake has `physical_stock = 1` and `reserved_stock = 0` (`available_stock = 1`).
- **Action:** 10 virtual users fire concurrent checkout requests (`POST /api/v1/orders/checkout`) within a 50ms window.
- **Expected Outcome:**
  - Exactly **1 request** receives `201 Created` with a stock reservation.
  - Exactly **9 requests** receive `409 Conflict` ("Item out of stock").
  - In `public.inventory`, `physical_stock = 1` and `reserved_stock = 1` (`available_stock = 0`).
  - No database deadlocks occur.

### 2.2 Scenario 2: Concurrent Multi-Product Orders & Deadlock Prevention
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
  - Product A: `reserved_stock = 2`. Product B: `reserved_stock = 2`.

### 2.3 Scenario 3: All-or-Nothing Multi-Product Atomic Reservation (No Partial Allocations)
- **Objective:** Verify that if an order contains multiple items and even one item has insufficient stock, zero items are reserved.
- **Setup:**
  - Product A: `physical_stock = 10`, `reserved_stock = 0` (`available_stock = 10`).
  - Product B: `physical_stock = 1`, `reserved_stock = 0` (`available_stock = 1`).
- **Action:** Customer requests checkout for: `[Product A (qty 2), Product B (qty 2)]`.
- **Expected Outcome:**
  - Pre-validation loop detects Product B has only 1 unit available.
  - Entire transaction aborts and rolls back immediately with HTTP 409 Conflict.
  - In `public.inventory`: Product A `reserved_stock = 0` (untouched); Product B `reserved_stock = 0` (untouched).
  - Absolutely zero partial reservations occur.

### 2.4 Scenario 4: Abandoned Payment & Stock Auto-Release (TTL Cleanup)
- **Objective:** Verify that stock locked by an abandoned checkout session is returned to the available pool.
- **Setup:** Customer reserves 1 unit of juice. `reserved_stock` increments to 1 (`available_stock = physical_stock - 1`).
- **Action:** Customer closes the browser without paying. Clock advances 10 minutes past `expires_at`. The scheduled procedure `rpc_release_expired_reservations()` executes.
- **Expected Outcome:**
  - Order status transitions from `payment_pending` to `expired`.
  - `reserved_stock` decrements back to 0. `available_stock` restores to original count.
  - Another customer can now immediately purchase the item.

### 2.5 Scenario 5: Successful Payment Does NOT Release Stock Reservation
- **Objective:** Verify that when payment succeeds, reserved stock remains locked for the customer's confirmed order.
- **Setup:** Order placed for 2 cakes; `physical_stock = 10`, `reserved_stock = 2` (`available_stock = 8`).
- **Action:** Razorpay `payment.captured` webhook arrives and is verified.
- **Expected Outcome:**
  - Order status transitions to `confirmed`. Payment status transitions to `captured`.
  - In `public.inventory`, `physical_stock = 10`, `reserved_stock = 2`, `available_stock = 8`.
  - **Stock reservation is NOT released.**

### 2.6 Scenario 6: Customer Counter Handover Decrements Physical Stock
- **Objective:** Verify that physical stock count decrements only when items are physically handed over at the counter.
- **Setup:** Confirmed order for 2 cakes awaiting pickup (`physical_stock = 10`, `reserved_stock = 2`).
- **Action:** Counter staff verifies collection token and clicks "Complete Handover".
- **Expected Outcome:**
  - Order status updates to `completed`.
  - In `public.inventory`: `physical_stock = 8` (10 - 2), `reserved_stock = 0` (2 - 2), `available_stock = 8`.

### 2.7 Scenario 7: Late Webhook Arrival & Evidence-Based Refund Lifecycle
- **Objective:** Verify automated refund processing when a delayed payment arrives for an expired order whose stock was sold out.
- **Setup:** Customer A's reservation expires and stock drops to 0 after Customer B buys the last unit.
- **Action:** Delayed Razorpay webhook arrives for Customer A with event `payment.captured`.
- **Expected Outcome:**
  - `rpc_reconcile_late_payment` detects available stock is 0 and refuses confirmation.
  - Order transitions to `cancelled_inventory_depleted` with `payment_status = 'refund_pending'`.
  - Backend API dispatches refund request to Razorpay (`POST /v1/payments/{payment_id}/refund`).
  - Razorpay HTTP 200 response transitions payment status to `refund_processing` (NOT `refunded`).
  - Subsequent webhook `refund.processed` transitions payment status authoritatively to `refunded`.
  - Customer receives notification; staff dashboard displays informational alert.

### 2.8 Scenario 8: Webhook Idempotency & Replay Safety
- **Objective:** Verify that duplicate or replayed webhook events do not cause duplicate order confirmations or double inventory deductions.
- **Setup:** Customer completes payment. Webhook test harness transmits the identical `payment.captured` payload **3 times consecutively**.
- **Expected Outcome:**
  - Request 1 confirms the order and records payment.
  - Requests 2 and 3 match the unique constraint on `provider_payment_id`, log an idempotent skip, and return HTTP 200 OK without mutating state or stock twice.

### 2.9 Scenario 9: Price Tampering Defense
- **Objective:** Ensure malicious clients cannot dictate product prices, discounts, or tax totals.
- **Setup:** A cake retails for ₹1,200.00 in the database.
- **Action:** Attacker sends a forged JSON payload: `{ "items": [{ "product_id": "...", "quantity": 1 }], "price": 1.00 }`.
- **Expected Outcome:**
  - Backend API ignores client-submitted prices and queries `public.products` directly.
  - The generated order and Razorpay transaction amount is strictly ₹1,200.00 + applicable taxes.

### 2.10 Scenario 10: Customer Data Isolation (Row Level Security & API Validation)
- **Objective:** Verify that a customer cannot read, guess, or modify another customer's orders or collection tokens.
- **Setup:** Customer A has Order `#101`. Customer B logs in via Phone OTP.
- **Action:** Customer B queries `GET /api/v1/orders/order_101_id`.
- **Expected Outcome:**
  - Backend API extracts `jwt.sub` (Customer B), verifies `order.customer_id != jwt.sub`, and returns HTTP 403 Forbidden.
  - Direct Supabase PostgREST query returns an empty set `[]` via RLS.

---

## 3. Planning Benchmarks vs. Performance Commitments

> [!NOTE]
> Latency metrics (e.g., API < 300ms, page load < 1.5s) are **planning benchmarks** utilized to size caching, database indexes, and connection pools. They are not contractual commitments until formal load testing and acceptance verification are completed in Phase 8.
