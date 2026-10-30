# Moody Orange — Comprehensive Testing Strategy & Quality Assurance Plan

**Document Version:** 1.0.0  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  

---

## 1. Testing Philosophy & Quality Pyramid

To ensure Moody Orange functions as a mission-critical, enterprise-grade retail platform, testing follows a layered pyramid:

```
                  / \
                 / E2E \             Playwright (Web) & Espresso (Android)
                / Tests \            Critical User Journeys, Payment Webhooks
               /─────────\
              /Integration\          Supertest API, Next.js Routes, pgTAP
             /    Tests    \         RLS Security Policies, Database RPCs
            /───────────────\
           /      Unit       \       Vitest (TS) & JUnit 5 / MockK (Kotlin)
          /      Tests        \      Pricing Math, Cart Logic, StateFlow ViewModels
         /─────────────────────\
        / Concurrency & Stress  \    k6 Load Scripts
       /─────────────────────────\   Inventory Lock Contention, Peak Slot Capacity
```

---

## 2. Critical Edge-Case Test Scenarios

The following 8 critical scenarios must pass automated or scripted integration tests before any release candidate is promoted to production:

### 2.1 Scenario 1: High-Concurrency Flash Sale (Zero Overselling Guarantee)
- **Objective:** Verify that when available stock is lower than concurrent demand, no race condition permits overselling.
- **Setup:** A specialty cake (e.g., "Signature Belgian Truffle Cake 1kg") has `current_stock = 1` and `reserved_stock = 0`.
- **Action:** 10 virtual users (via k6 script) fire concurrent checkout requests (`POST /api/v1/orders/checkout`) within a 50ms window.
- **Expected Outcome:**
  - Exactly **1 request** receives `201 Created` with a 10-minute stock reservation.
  - Exactly **9 requests** receive `409 Conflict` with error message `"Item out of stock"`.
  - In `public.inventory`, `current_stock = 1` and `reserved_stock = 1` (available = 0).
  - No database deadlocks occur.

### 2.2 Scenario 2: Abandoned Payment & Stock Auto-Release (TTL Cleanup)
- **Objective:** Verify that stock locked by an abandoned checkout session is returned to the pool after the 10-minute window.
- **Setup:** Customer reserves the last bottle of "Valencia Orange Juice 350ml". `reserved_stock` increments to 1.
- **Action:** Customer closes the browser tab without completing Razorpay payment. Clock advances 10 minutes past `expires_at`. The scheduled procedure `rpc_release_expired_reservations()` executes.
- **Expected Outcome:**
  - Order status transitions from `payment_pending` to `expired`.
  - `reserved_stock` decrements back to 0. Available stock restores to 1.
  - An entry is logged in `inventory_logs` with reason `reservation_expired_release`.
  - Another customer can now immediately purchase the item.

### 2.3 Scenario 3: Razorpay Webhook Idempotency & Replay
- **Objective:** Verify that duplicate or replayed webhook events from Razorpay do not cause duplicate order confirmations, duplicate receipts, or double inventory deductions.
- **Setup:** A customer completes payment for an order. Razorpay fires `payment.captured` webhook.
- **Action:** The test harness transmits the exact same webhook payload and HMAC signature **3 times consecutively** to `/api/v1/webhooks/razorpay`.
- **Expected Outcome:**
  - Request 1 processes the event, creates a record in `payments`, updates order to `confirmed`, and returns `200 OK`.
  - Requests 2 and 3 detect the existing `provider_payment_id` via unique index, log an idempotent skip, and return `200 OK` without throwing errors or mutating stock twice.

### 2.4 Scenario 4: Price Tampering Defense
- **Objective:** Ensure malicious clients cannot dictate product prices, discounts, or tax totals.
- **Setup:** A cake retails for ₹1,200.00 in the database.
- **Action:** Attacker sends a forged JSON payload:
  ```json
  {
    "items": [{ "product_id": "...", "quantity": 1 }],
    "client_price": 1.00,
    "total_amount": 1.00
  }
  ```
- **Expected Outcome:**
  - The server API ignores `client_price` and queries `public.products` directly.
  - The generated order and Razorpay transaction amount is strictly ₹1,200.00 + applicable taxes.
  - If the client attempts to forge the Razorpay SDK amount, the webhook signature verification fails due to amount mismatch, and the order is flagged as compromised.

### 2.5 Scenario 5: Customer Data Isolation & Row Level Security (RLS)
- **Objective:** Verify that a customer cannot read, guess, or modify another customer's orders or collection PINs.
- **Setup:** Customer A has Order `#101` with Collection PIN `7294`. Customer B logs in via Phone OTP.
- **Action:** Customer B sends a direct query to Supabase: `supabase.from('orders').select('*').eq('id', order_101_id)`.
- **Expected Outcome:**
  - Query returns an empty set `[]` (0 rows). RLS blocks row visibility.
  - Customer B cannot read Customer A's collection PIN, phone number, or item contents.

### 2.6 Scenario 6: Cash-at-Pickup Counter Collection Handover
- **Objective:** Verify that a cash order cannot be completed without explicit cash collection confirmation by counter staff.
- **Setup:** Order placed with `payment_method = cash_at_pickup`, status is `ready_for_pickup`, and `payment_status = unpaid`.
- **Action:** Staff enters customer PIN `7294` on Admin Web. System prompts: *"Collect Cash ₹850"*.
- **Expected Outcome:**
  - The "Complete Handover" action remains disabled until staff checks the confirmation box.
  - Upon submission, order status updates to `completed`, `payment_status` updates to `paid`, and a cash payment entry is logged with staff user ID.

### 2.7 Scenario 7: Scheduled Pickup Slot Capacity Enforcement
- **Objective:** Ensure physical counter throughput limits are honored.
- **Setup:** Slot "Today 5:00 PM – 5:15 PM" has a capacity limit of 10 orders. 10 confirmed orders already exist for this slot.
- **Action:** An 11th customer attempts to book the 5:00 PM slot.
- **Expected Outcome:**
  - The slot displays as "Unavailable / Slot Full" on both Web and Android.
  - If a client bypasses UI and attempts direct API submission, the backend rejects the request with `422 Unprocessable Entity` ("Selected pickup slot has reached capacity").

### 2.8 Scenario 8: Android Network Interruption & Idempotent Checkout
- **Objective:** Ensure poor 4G connectivity or sudden app kill does not cause duplicate orders or lost carts.
- **Setup:** Android user taps "Pay & Place Order".
- **Action:** The Android app generates a client-side idempotency UUID (`client_order_token`). Network drops right as the request leaves the device. User taps "Retry".
- **Expected Outcome:**
  - The retry request transmits the same `client_order_token`.
  - The backend recognizes the in-flight or completed reservation and returns the existing draft order rather than reserving duplicate stock.

---

## 3. Test Automation Frameworks & Tooling

| Test Scope | Primary Tooling | Coverage Target | Execution Trigger |
| :--- | :--- | :--- | :--- |
| **Database Unit & RLS Tests** | `pgTAP` (running inside local Supabase Docker) | 100% of RLS policies, check constraints, and stored procedures | Local pre-commit hook & GitHub Actions CI |
| **API & Business Logic** | Vitest, Supertest, Zod schema validation | > 85% branch coverage on `/api/v1/*` routes | GitHub Actions on every Pull Request |
| **Web Frontend Components** | Vitest, React Testing Library, Mock Service Worker (MSW) | > 80% component logic coverage | GitHub Actions on PR |
| **Web End-to-End (E2E)** | Playwright (Automated Chromium, Firefox, WebKit) | Complete user journeys (Catalog -> Cart -> OTP -> Checkout -> Tracking) | Nightly CI & Pre-Release Tagging |
| **Android Unit & Architecture** | JUnit 5, MockK, Turbine (for Kotlin Flows) | > 85% coverage on ViewModels, UseCases, Repositories | Gradle `testDebugUnitTest` in CI |
| **Android UI & Compose Tests** | Jetpack Compose Testing Library, Espresso | Key checkout screens and PIN verification modal | Gradle `connectedCheck` on Android Emulator |
| **Performance & Concurrency** | k6 (Grafana k6 load test scripts) | Stock reservation endpoint under 100 concurrent VUs | Staging environment pre-launch audit |

---

## 4. Phase-by-Phase Verification Gate Matrix

Before any implementation phase is marked complete, it must satisfy its strict verification criteria:

```
[Phase 1: Backend Foundation] ──► pgTAP tests pass 100% + Schema migrations apply cleanly
              │
[Phase 2: Catalog & Storefront] ─► Web & Android render catalog + Image uploads succeed to CDN
              │
[Phase 3: Stock & Cart Engine] ──► Concurrency test passes (0 overselling) + TTL release works
              │
[Phase 4: Phone OTP Auth] ───────► Rate limits trigger on abuse + JWT claims verified in RLS
              │
[Phase 5: Payments (Razorpay)] ──► Webhook signature verification succeeds + Idempotency verified
              │
[Phase 6: Admin Order Desk] ─────► Realtime chimes trigger < 1s + PIN/QR verification completes
              │
[Phase 7: Hardening & Security] ─► Security penetration test clean + Zero secrets in client APK
```
