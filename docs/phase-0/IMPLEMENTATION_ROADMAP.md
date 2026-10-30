# Moody Orange — Phased Implementation Roadmap & Engineering Plan

**Document Version:** 1.1.0 (Phase 0.1 Revision)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial 9-phase roadmap. |
| **1.1.0** | 2026-10-30 | Lead Architect | **Phase 0.1 Revision:**<br>• Formalized the strict phase progression cycle: `Plan → Implement → Code Review → Test → Approve → Next Phase`.<br>• Embedded standalone `apps/backend-api` deliverables across milestones.<br>• Reaffirmed local-first development and deferred production deployments until acceptance testing in Phase 8. |

---

## 1. Engineering Governance & Phase Progression Cycle

Every engineering phase in Moody Orange follows a mandatory 6-step quality control lifecycle. No phase may advance without satisfying its explicit completion gate:

```
+─────────────────────────────────────────────────────────────────────────+
| 1. PLAN          Define technical tasks, API schemas, and test criteria |
|        │                                                                |
|        ▼                                                                |
| 2. IMPLEMENT     Write clean, typed code adhering to architecture specs |
|        │                                                                |
|        ▼                                                                |
| 3. CODE REVIEW   Inspect code for security, RLS leaks, and code standards|
|        │                                                                |
|        ▼                                                                |
| 4. TEST          Execute automated unit, integration, and DB tests in CI|
|        │                                                                |
|        ▼                                                                |
| 5. APPROVE       Formal client / technical lead review and sign-off     |
|        │                                                                |
|        ▼                                                                |
| 6. NEXT PHASE    Promote branch, tag milestone, unlock next phase scope |
+─────────────────────────────────────────────────────────────────────────+
```

---

## 2. Detailed Phase Breakdown

### Phase 0: Requirements, Architecture & Project Governance
- **Status:** **Active / Current Phase**
- **Objective:** Establish authoritative documentation, threat models, database schemas, and architectural alignment prior to writing application code.
- **Deliverables:** Complete 9 core Phase 0 architecture documents in `docs/phase-0/`.
- **Completion Gate:** Client review and formal written approval of Phase 0 deliverables.

---

### Phase 1: Repository Foundation, Database Schema & Standalone Backend API
- **Prerequisites:** Phase 0 approval.
- **Objectives:** Establish the version-controlled monorepo, local Dockerized Supabase instance, core PostgreSQL migrations, and the standalone Backend API scaffold.
- **Key Tasks:**
  1. Initialize Turborepo monorepo with workspaces:
     - `apps/customer-web`
     - `apps/admin-web`
     - `apps/android`
     - `apps/backend-api` (Standalone modular monolith REST service)
     - `packages/api-contracts` (OpenAPI / JSON schemas)
  2. Configure Supabase local development environment (`supabase start`).
  3. Write and apply idempotent PostgreSQL migrations (tables, check constraints, RLS policies).
  4. Scaffold `apps/backend-api` with health check and Supabase connection pool.
  5. Implement `pgTAP` database test suites to verify RLS isolation and constraint enforcement.
- **Completion Gate:** `supabase db reset` applies cleanly; 100% of `pgTAP` tests pass in CI; Backend API health check returns HTTP 200 OK.

---

### Phase 2: Catalog Management, Media Storage & Public Storefront
- **Prerequisites:** Phase 1 complete and signed off.
- **Objectives:** Build product/category management on Admin Web, configure Supabase Storage CDN, and render the public catalog on Web and Android.
- **Key Tasks:**
  1. Configure Supabase Storage bucket `product-images` with CDN caching and public read policies.
  2. **Backend API:** Implement `/api/v1/catalog/*` endpoints.
  3. **Admin Web:** Build category CRUD and product forms with image upload and availability toggles.
  4. **Customer Web:** Build responsive catalog homepage, category tabs, and real-time stock status badges.
  5. **Native Android:** Build Jetpack Compose catalog screen, Coil image loading, and category filter chips.
- **Completion Gate:** Admin uploads product image and publishes item; item renders immediately on Customer Web and Android App.

---

### Phase 3: Cart Engine, Atomic Stock Reservation & Pickup Scheduling
- **Prerequisites:** Phase 2 complete and signed off.
- **Objectives:** Build cart calculations, store scheduling engine, and atomic stock reservation procedure.
- **Key Tasks:**
  1. Implement shared pricing and tax calculation rules in `packages/api-contracts`.
  2. Implement `rpc_reserve_order_stock` stored procedure in PostgreSQL with `FOR UPDATE` row locks.
  3. Implement automated reservation cleanup procedure (`rpc_release_expired_reservations`) scheduled to run every 60 seconds.
  4. Build pickup time slot selection engine (Immediate vs. Scheduled windows) enforcing store operating hours and slot capacity.
  5. Implement `/api/v1/orders/checkout` in Backend API and connect Web and Android cart flows.
- **Completion Gate:** Concurrency reservation test verifies zero overselling; expired reservations release stock automatically after 10 minutes.

---

### Phase 4: Customer Phone OTP Authentication & Staff RBAC
- **Prerequisites:** Phase 3 complete and signed off.
- **Objectives:** Implement secure Indian mobile phone OTP authentication for customers and role-based login for store staff.
- **Key Tasks:**
  1. Configure Supabase Auth SMS provider / webhook with 60-second resend throttling and 5-minute expiry.
  2. **Customer Web & Android:** Build OTP input bottom sheet / modal with countdown timer and profile name prompt.
  3. **Admin Web:** Build secure staff login screen using email/password.
  4. Implement RBAC middleware in `apps/backend-api` verifying `staff_roles` in DB.
- **Completion Gate:** Customer logs in via OTP; staff accesses admin queue; unauthenticated requests to `/admin` receive HTTP 403 Forbidden.

---

### Phase 5: Payment Processing (Razorpay Test Mode) & Cash at Pickup
- **Prerequisites:** Phase 4 complete and signed off.
- **Objectives:** Integrate Razorpay Payment Gateway in test mode and build the cash-at-pickup commitment flow.
- **Key Tasks:**
  1. Implement Razorpay Order creation in `apps/backend-api`.
  2. Integrate Razorpay Standard Web Checkout on Web and Razorpay Android Standard SDK on Android.
  3. Implement `/api/v1/webhooks/razorpay` with HMAC-SHA256 signature verification and idempotency checks.
  4. Implement late webhook reconciliation and automated refund trigger (`rpc_reconcile_late_payment`).
  5. Implement Cash-at-Pickup flow (orders marked `confirmed`, `payment_status = unpaid`).
- **Completion Gate:** Test card/UPI payment confirms order via webhook; duplicate webhooks do not duplicate orders; late payment after stock exhaustion triggers automated refund.

---

### Phase 6: Admin Live Order Desk & Counter Pickup Handover
- **Prerequisites:** Phase 5 complete and signed off.
- **Objectives:** Equip store staff with real-time order queue, audible alerts, and counter collection verification.
- **Key Tasks:**
  1. **Admin Web:** Build live Kanban order dispatch board connected to Supabase Realtime WebSocket channel.
  2. Implement Web Audio API alert sound when new orders arrive.
  3. Implement Counter Collection Modal:
     - Numerical input for customer collection token.
     - Webcam / tablet camera scanner for QR code validation.
  4. Enforce cash collection confirmation checkbox for `cash_at_pickup` orders before unlocking "Complete Handover".
  5. Customer Web & Android live order tracking screen reflects state changes instantly.
- **Completion Gate:** Order placement chimes on admin counter board; staff verifies token, confirms cash receipt, and marks completed; customer tracking screen reflects "Completed".

---

### Phase 7: Concurrency Stress Testing, Security Audit & E2E Validation
- **Prerequisites:** Phase 6 complete and signed off.
- **Objectives:** Validate system resilience under heavy concurrent load and verify complete security posture.
- **Key Tasks:**
  1. Run k6 load test scripts simulating 10 concurrent users attempting to buy the last unit of stock (verify zero overselling).
  2. Run Playwright automated E2E tests for full web customer purchase journeys.
  3. Perform mobile penetration review: ensure Android APK contains zero secrets (`apktool` / reverse-engineering inspection).
  4. Validate all 9 critical edge cases in `TESTING_STRATEGY.md`.
- **Completion Gate:** All 9 critical edge-case scenarios pass; zero secret keys found in client bundles; acceptance sign-off by technical lead.

---

### Phase 8: Production Deployment, Live Merchant Activation & Launch
- **Prerequisites:** Phase 7 complete and signed off.
- **Objectives:** Deploy to production cloud infrastructure, activate live Razorpay merchant credentials, and train store staff.
- **Key Tasks:**
  1. Provision Supabase Production project and run verified migrations.
  2. Deploy `apps/backend-api`, `apps/customer-web`, and `apps/admin-web` with custom domains and Cloudflare SSL.
  3. Switch Razorpay from Test Mode to Live Mode using verified merchant credentials.
  4. Publish Android production build (AAB) to Google Play Console.
  5. In-store counter kiosk tablet setup and staff operational training.
  6. Day-1 on-site launch monitoring.
- **Completion Gate:** First real customer places an order, pays live, and successfully collects fresh items at the physical counter.

---

## 3. Work Breakdown Structure (WBS) & Dependency Matrix

| Phase | Milestone Name | Dependencies | Estimated Complexity | Completion Gate |
| :---: | :--- | :--- | :---: | :--- |
| **0** | Requirements & Architecture | None | Medium | Client sign-off on 9 architecture documents |
| **1** | Monorepo, DB Schema & Backend API | Phase 0 | High | `pgTAP` tests pass, API health check green |
| **2** | Catalog, Storage & Storefront | Phase 1 | Medium | Real-time catalog render on Web & Android |
| **3** | Cart, Stock Lock & Pickup Slots | Phase 2 | High | Atomic lock test passes, TTL auto-release works |
| **4** | Phone OTP Auth & Staff RBAC | Phase 3 | Medium | Rate limits enforced, session claims valid |
| **5** | Razorpay Test, Webhooks & Cash Flow| Phase 4 | High | Webhook HMAC verified, idempotency confirmed |
| **6** | Admin Live Desk & Counter Pickup | Phase 5 | High | Realtime chime, pickup verification works |
| **7** | Concurrency Load & Security Audit | Phase 6 | High | k6 stress test passes (0 oversell), 0 leaked keys |
| **8** | Production Launch & Staff Handoff | Phase 7 | Medium | Live payment confirmed, counter order collected |
