# Moody Orange — Comprehensive Testing Strategy & Quality Assurance Plan

**Document Version:** 1.1.0 (Phase 0.1 Revision)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial test scenarios and quality pyramid. |
| **1.1.0** | 2026-10-30 | Lead Architect | **Phase 0.1 Revision:**<br>• Added explicit test scenario for late webhook arrival and automated refund trigger.<br>• Clarified performance metrics as planning benchmarks rather than guaranteed contractual SLAs.<br>• Defined standalone Backend API test suites and cross-platform validation. |

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

The following 9 critical scenarios must pass automated or scripted integration tests before any release candidate is approved:

### 2.1 Scenario 1: High-Concurrency Flash Sale (Zero Overselling Guarantee)
- **Objective:** Verify that when available stock is lower than concurrent demand, no race condition permits overselling.
- **Setup:** A specialty cake has `current_stock = 1` and `reserved_stock = 0` (available = 1).
- **Action:** 10 virtual users (via k6 load script) fire concurrent checkout requests (`POST /api/v1/orders/checkout`) within a 50ms window.
- **Expected Outcome:**
  - Exactly **1 request** receives `201 Created` with a stock reservation.
  - Exactly **9 requests** receive `409 Conflict` ("Item out of stock").
  - In `public.inventory`, `current_stock = 1` and `reserved_stock = 1` (available = 0).
  - No database deadlocks occur.

### 2.2 Scenario 2: Abandoned Payment & Stock Auto-Release (TTL Cleanup)
- **Objective:** Verify that stock locked by an abandoned checkout session is returned to the available pool.
- **Setup:** Customer reserves the last bottle of juice. `reserved_stock` increments to 1.
- **Action:** Customer closes the browser without paying. Clock advances 10 minutes past `expires_at`. The scheduled procedure `rpc_release_expired_reservations()` executes.
- **Expected Outcome:**
  - Order status transitions from `payment_pending` to `expired`.
  - `reserved_stock` decrements back to 0. Available stock restores to 1.
  - Another customer can now immediately purchase the item.

### 2.3 Scenario 3: Razorpay Webhook Idempotency & Replay Safety
- **Objective:** Verify that duplicate or replayed webhook events from Razorpay do not cause duplicate order confirmations, duplicate receipts, or double inventory deductions.
- **Setup:** A customer completes payment for an order. Razorpay fires `payment.captured` webhook.
- **Action:** The test harness transmits the exact same webhook payload and HMAC signature **3 times consecutively** to `/api/v1/webhooks/razorpay`.
- **Expected Outcome:**
  - Request 1 processes the event, creates a record in `payments`, updates order to `confirmed`, and returns HTTP 200 OK.
  - Requests 2 and 3 detect the existing `provider_payment_id` via unique index, log an idempotent skip, and return HTTP 200 OK without mutating state or stock twice.

### 2.4 Scenario 4: Late Webhook Arrival After Reservation Expiry (Stock Depleted)
- **Objective:** Verify the system's automated reconciliation and refund pipeline when a delayed payment arrives for an already expired order whose stock was sold to someone else.
- **Setup:** Customer A reserves the last unit of a chocolate box. Reservation expires after 10 minutes; stock is released. Customer B immediately purchases that last unit. Available stock is now 0.
- **Action:** Delayed Razorpay webhook arrives for Customer A with event `payment.captured`.
- **Expected Outcome:**
  - Backend API calls `rpc_reconcile_late_payment`.
  - Stored procedure detects that available stock is 0 and refuses confirmation.
  - Order transitions to `cancelled_inventory_depleted` with `payment_status = 'refund_pending'`.
  - Backend API automatically dispatches a refund request to Razorpay Refunds API (`POST /v1/payments/{payment_id}/refund`).
  - Order updates to `refunded`, and customer receives an SMS/push notification explaining the stock exhaustion and confirmed refund.
  - Admin Live Queue receives an informational alert. Zero stock discrepancy occurs.

### 2.5 Scenario 5: Price Tampering Defense
- **Objective:** Ensure malicious clients cannot dictate product prices, discounts, or tax totals.
- **Setup:** A cake retails for ₹1,200.00 in the database.
- **Action:** Attacker sends a forged JSON payload: `{ "items": [{ "product_id": "...", "quantity": 1 }], "price": 1.00 }`.
- **Expected Outcome:**
  - Backend API ignores client-submitted prices and queries `public.products` directly.
  - The generated order and Razorpay transaction amount is strictly ₹1,200.00 + applicable taxes.

### 2.6 Scenario 6: Customer Data Isolation (Row Level Security)
- **Objective:** Verify that a customer cannot read, guess, or modify another customer's orders or collection tokens.
- **Setup:** Customer A has Order `#101`. Customer B logs in via Phone OTP.
- **Action:** Customer B queries Supabase: `supabase.from('orders').select('*').eq('id', order_101_id)`.
- **Expected Outcome:**
  - Query returns an empty set `[]` (0 rows). RLS blocks row visibility.

### 2.7 Scenario 7: Cash-at-Pickup Counter Collection Handover
- **Objective:** Verify that a cash order cannot be completed without explicit cash collection confirmation by counter staff.
- **Setup:** Order placed with `payment_method = cash_at_pickup`, status is `ready_for_pickup`, and `payment_status = unpaid`.
- **Action:** Staff enters customer collection token on Admin Web. System prompts: *"Collect Cash ₹850"*.
- **Expected Outcome:**
  - The "Complete Handover" action remains disabled until staff checks the confirmation box: `[x] Cash Received in Register`.
  - Upon submission, order status updates to `completed`, `payment_status` updates to `paid`, and `current_stock` is decremented.

### 2.8 Scenario 8: Scheduled Pickup Slot Capacity Enforcement
- **Objective:** Ensure physical counter throughput limits are honored.
- **Setup:** Slot "Today 5:00 PM – 5:15 PM" has a capacity limit of 10 orders. 10 confirmed orders already exist for this slot.
- **Action:** An 11th customer attempts to book the 5:00 PM slot.
- **Expected Outcome:**
  - The slot displays as "Unavailable / Slot Full" on both Web and Android.
  - If a client bypasses UI and attempts direct API submission, the backend rejects the request with HTTP 422 Unprocessable Entity.

### 2.9 Scenario 9: Android Network Interruption & Idempotent Checkout
- **Objective:** Ensure spotty 4G connectivity or sudden app kill does not cause duplicate orders or double charges.
- **Setup:** Android user taps "Pay & Place Order".
- **Action:** The Android app generates a client-side idempotency UUID (`client_order_token`). Network drops right as the request leaves the device. User taps "Retry".
- **Expected Outcome:**
  - The retry request transmits the same `client_order_token`.
  - The backend recognizes the in-flight reservation and returns the existing draft order rather than reserving duplicate stock.

---

## 3. Automated Testing Tooling by Subsystem

| Test Scope | Primary Tooling | Target Coverage | Execution Trigger |
| :--- | :--- | :--- | :--- |
| **Database Unit & RLS Tests** | `pgTAP` (running inside local Supabase Docker) | 100% of RLS policies, check constraints, and stored procedures | Local pre-commit hook & GitHub Actions CI |
| **Backend API (`apps/backend-api`)** | Vitest, Supertest, Zod schemas | > 85% branch coverage on `/api/v1/*` routes | GitHub Actions on every Pull Request |
| **Customer & Admin Web** | Vitest, React Testing Library, Mock Service Worker | > 80% component logic coverage | GitHub Actions on PR |
| **Web End-to-End (E2E)** | Playwright | Full checkout journeys, webhook simulations | Nightly CI & Pre-Release Tagging |
| **Android Unit & Architecture** | JUnit 5, MockK, Turbine (for Kotlin Flows) | > 85% coverage on ViewModels, UseCases, Repositories | Gradle `testDebugUnitTest` in CI |
| **Android UI & Compose Tests** | Jetpack Compose Testing Library, Espresso | Key checkout screens and PIN verification modal | Gradle `connectedCheck` on Android Emulator |
| **Concurrency & Load Tests** | k6 (Grafana k6 load test scripts) | Stock reservation endpoint under concurrent virtual users | Phase 7 pre-launch audit |

---

## 4. Planning Benchmarks vs. Performance Commitments

> [!NOTE]
> Latency metrics (e.g., API < 300ms, page load < 1.5s) are **planning benchmarks** utilized to size caching, database indexes, and connection pools. They are not contractual commitments until formal load testing and acceptance verification are completed in Phase 7.
