# Moody Orange — Phased Implementation Roadmap & Engineering Plan

**Document Version:** 1.0.0  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  

---

## 1. Roadmap Overview & Phased Architecture

The implementation of Moody Orange is structured into 9 sequential phases (Phase 0 through Phase 8). Each phase delivers testable, verifiable increments with strict exit criteria. No phase begins until the preceding phase's verification gates have passed.

```
+─────────────────────────────────────────────────────────────────────────+
| PHASE 0: Requirements, Architecture & Governance (Current - Planning)   |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
| PHASE 1: Repo Setup, PostgreSQL Schema, RLS & Shared Backend Foundation |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
| PHASE 2: Catalog Management, Media Storage & Multi-Platform Browsing   |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
| PHASE 3: Shopping Cart, Atomic Stock Reservation & Pickup Slots        |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
| PHASE 4: Mobile Phone OTP Authentication & Staff RBAC                   |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
| PHASE 5: Payment Integration (Razorpay Test Mode) & Cash at Pickup     |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
| PHASE 6: Admin Live Order Desk, Audio Chimes & Counter Handover (PIN/QR)|
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
| PHASE 7: Concurrency Stress Testing, Security Audit & E2E Validation   |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
| PHASE 8: Production Deployment, Razorpay Live Activation & Launch      |
+─────────────────────────────────────────────────────────────────────────+
```

---

## 2. Detailed Phase Breakdown & Deliverables

### Phase 0: Requirements, Architecture & Project Governance
- **Status:** **Active / In Progress**
- **Objective:** Establish authoritative documentation, threat models, database schemas, and architectural alignment prior to writing application code.
- **Deliverables:**
  - Complete 9 core Phase 0 architecture documents in `docs/phase-0/`.
  - Resolution of architectural trade-offs (Monorepo, Next.js API layer, Native Android).
  - Identification of pending business approvals from client.
- **Exit Criteria:** Client review and formal written approval of Phase 0 deliverables.

---

### Phase 1: Repository Foundation, Database Schema & Shared Backend
- **Prerequisites:** Phase 0 approval.
- **Objectives:** Establish the version-controlled monorepo, configure local Dockerized Supabase, and apply the core relational database schema.
- **Key Tasks:**
  1. Initialize Turborepo monorepo with workspaces:
     - `apps/customer-web` (Next.js)
     - `apps/admin-web` (Next.js)
     - `apps/android` (Android Studio Kotlin project)
     - `packages/shared-types` (TypeScript shared models)
  2. Configure Supabase local development environment (`supabase init`, `config.toml`).
  3. Write and apply idempotent PostgreSQL migrations:
     - Enums, Tables (`profiles`, `categories`, `products`, `inventory`, `orders`, `order_items`, `payments`, `audit_logs`).
     - Check constraints and foreign key relationships.
     - Row Level Security (RLS) policies for all tables.
  4. Implement `pgTAP` database test suites to verify RLS isolation and constraint enforcement.
  5. Set up GitHub Actions CI pipeline for linting, type-checking, and running DB tests.
- **Exit Criteria:** `supabase db reset` executes cleanly; all `pgTAP` RLS test suites pass; CI build succeeds.

---

### Phase 2: Catalog Management, Media Storage & Public Storefront
- **Prerequisites:** Phase 1 complete.
- **Objectives:** Implement product and category management on the admin portal, configure Supabase Storage for product images, and render the responsive public catalog on Web and Android.
- **Key Tasks:**
  1. Configure Supabase Storage bucket `product-images` with CDN caching and public read policies.
  2. **Admin Web:** Build category CRUD, product creation/editing forms with image upload and dietary tag selectors.
  3. **Customer Web:** Build responsive catalog homepage, category tabs, product detail modal/sheet, and real-time stock status badges.
  4. **Native Android:** Build Jetpack Compose catalog screen, Coil image loading with disk cache, and category filter chips.
- **Exit Criteria:** Admin can upload an image and publish a new cake; product appears immediately on Customer Web and Android app within 2 seconds.

---

### Phase 3: Cart Engine, Atomic Stock Reservation & Pickup Scheduling
- **Prerequisites:** Phase 2 complete.
- **Objectives:** Build the cart calculations, store scheduling engine, and atomic stock reservation procedure.
- **Key Tasks:**
  1. Implement shared pricing and tax calculation engine (`packages/shared-types`).
  2. Implement `rpc_reserve_order_stock` stored procedure in PostgreSQL with `FOR UPDATE` row locks.
  3. Implement automated reservation cleanup procedure (`rpc_release_expired_reservations`) scheduled to run every 60 seconds.
  4. Build pickup time slot selection engine (Immediate vs. Scheduled 15-minute windows) enforcing store operating hours and slot capacity.
  5. Wire cart UI and stock reservation flow on Web and Android.
- **Exit Criteria:** 10-minute countdown timer displays during checkout; if abandoned, stock returns to available inventory; overselling is rejected at DB level.

---

### Phase 4: Customer Phone OTP Authentication & Staff RBAC
- **Prerequisites:** Phase 3 complete.
- **Objectives:** Implement secure Indian mobile phone OTP authentication for customers and role-based login for store staff.
- **Key Tasks:**
  1. Configure Supabase Auth SMS provider / webhook with 60-second resend throttling and 5-minute expiry.
  2. **Customer Web & Android:** Build OTP input bottom sheet / modal with countdown timer, auto-focus, and profile name prompt for new users.
  3. **Admin Web:** Build secure staff login screen using email/password + session token handling.
  4. Implement RBAC middleware protecting `/admin/*` routes and verifying `staff_roles` in DB.
- **Exit Criteria:** Customer logs in via OTP without password; staff member accesses admin queue; unauthenticated or customer sessions attempting to access `/admin` receive 403 Forbidden.

---

### Phase 5: Payment Processing (Razorpay Test Mode) & Cash at Pickup
- **Prerequisites:** Phase 4 complete.
- **Objectives:** Integrate Razorpay Payment Gateway in test mode and build the cash-at-pickup commitment flow.
- **Key Tasks:**
  1. Implement `/api/v1/orders/checkout` endpoint to calculate totals and create Razorpay order.
  2. Integrate Razorpay Standard Web Checkout on Web and Razorpay Android Standard SDK on Android.
  3. Implement secure webhook endpoint `/api/v1/webhooks/razorpay` with HMAC-SHA256 signature verification and idempotency checks.
  4. Implement Cash-at-Pickup flow (orders marked `confirmed`, `payment_status = unpaid`, generating digital collection pass).
- **Exit Criteria:** Successful test card/UPI payment transitions order to `confirmed` via webhook; duplicate webhooks do not duplicate orders; cash orders generate collection passes immediately.

---

### Phase 6: Admin Live Order Desk & Counter Pickup Handover
- **Prerequisites:** Phase 5 complete.
- **Objectives:** Equip store staff with real-time order queue, audible alerts, and PIN/QR collection verification.
- **Key Tasks:**
  1. **Admin Web:** Build live Kanban order dispatch board connected to Supabase Realtime WebSocket channel.
  2. Implement Web Audio API alert sound when new orders arrive.
  3. Implement Counter Collection Modal:
     - Numerical keypad for manual 4-digit PIN entry.
     - Webcam / tablet camera scanner for QR code validation.
  4. Enforce cash collection checkbox for `cash_at_pickup` orders before unlocking "Complete Handover".
  5. Customer Web & Android live order tracking screen reflects state changes instantly.
- **Exit Criteria:** When an order is placed, admin portal chimes within 1 second; staff enters PIN, confirms cash receipt, and marks completed; customer tracking screen updates to "Completed" in real time.

---

### Phase 7: Concurrency Testing, Security Hardening & E2E Audit
- **Prerequisites:** Phase 6 complete.
- **Objectives:** Validate system resilience under heavy concurrent load and verify complete security posture.
- **Key Tasks:**
  1. Run k6 load test scripts simulating 10 concurrent users attempting to buy the last unit of stock (verify zero overselling).
  2. Run Playwright automated E2E tests for full web customer purchase journeys.
  3. Perform mobile penetration review: ensure Android APK contains zero secrets (`apktool` / reverse-engineering inspection).
  4. Test edge cases: network loss during payment, store emergency closure toggle, expired OTP handling.
- **Exit Criteria:** Zero overselling under load; 100% of critical edge-case scenarios in `TESTING_STRATEGY.md` pass.

---

### Phase 8: Production Deployment & Live Store Launch
- **Prerequisites:** Phase 7 complete and signed off.
- **Objectives:** Deploy to production cloud infrastructure, activate live Razorpay merchant credentials, and train store staff.
- **Key Tasks:**
  1. Provision Supabase Production project and run verified migrations.
  2. Configure production domains: `shop.moodyorange.com` and `admin.moodyorange.com` with Cloudflare SSL.
  3. Switch Razorpay from Test Mode to Live Mode using verified merchant credentials.
  4. Publish Android production build (AAB) to Google Play Console (Internal / Closed Testing track).
  5. In-store counter kiosk tablet setup and staff operational training.
  6. Day-1 on-site launch monitoring.
- **Exit Criteria:** First real customer places an order, pays live, and successfully collects fresh items at the physical counter.

---

## 3. Work Breakdown Structure (WBS) & Dependency Matrix

| Phase | Milestone Name | Dependencies | Estimated Complexity | Verification Gate |
| :---: | :--- | :--- | :---: | :--- |
| **0** | Requirements & Architecture | None | Medium | Client sign-off on 9 architecture documents |
| **1** | Monorepo, DB Schema & RLS | Phase 0 | High | `pgTAP` tests pass, CI build green |
| **2** | Catalog, Storage & Storefront | Phase 1 | Medium | Real-time catalog render on Web & Android |
| **3** | Cart, Stock Lock & Pickup Slots | Phase 2 | High | Atomic lock test passes, TTL auto-release works |
| **4** | Phone OTP Auth & Staff RBAC | Phase 3 | Medium | Rate limits enforced, session claims valid |
| **5** | Razorpay Test & Cash Flow | Phase 4 | High | Webhook HMAC verified, idempotency confirmed |
| **6** | Admin Live Desk & Counter PIN/QR | Phase 5 | High | Realtime chime < 1s, PIN verification works |
| **7** | Concurrency Load & Security Audit | Phase 6 | High | k6 stress test passes (0 oversell), 0 leaked keys |
| **8** | Production Launch & Staff Handoff | Phase 7 | Medium | Live payment confirmed, counter order collected |
