# Moody Orange — Phased Implementation Roadmap & Engineering Plan

**Document Version:** 1.2.0 (Phase 0.2 Final Consistency Review)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial 9-phase roadmap. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Formalized 6-step phase progression cycle. |
| **1.2.0** | 2026-10-30 | Lead Architect | **Phase 0.2 Final Consistency Review:**<br>• Realigned the roadmap into 10 dependency-driven phases.<br>• Separated Customer Web catalogue (Phase 3) and Android catalogue (Phase 4) to verify catalog discovery before transactional checkout.<br>• Placed Cart/Reservation (Phase 5) and Admin Operations (Phase 6) before Payment Integration (Phase 7).<br>• Enforced explicit completion gates and client approvals before advancing. |

---

## 1. Engineering Governance & Phase Progression Cycle

Every engineering phase follows a mandatory 6-step quality control lifecycle. No phase may advance without satisfying its explicit completion gate and receiving sign-off:

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

## 2. Dependency-Driven Phase Sequence & Rationale

```
[Phase 0: Requirements & Architecture Approval]
       │
       ▼
[Phase 1: Repository, Tooling & Backend Foundation]
       │
       ▼
[Phase 2: Database Schema, RLS & Backend Contracts]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[Phase 3: Customer Web Catalogue]   [Phase 4: Android App Catalogue]
       │                                 │
       └────────────────┬────────────────┘
                        ▼
[Phase 5: Cart, Inventory Reservation & Checkout Engine]
                        │
                        ▼
[Phase 6: Admin Product, Inventory & Order Operations]
                        │
                        ▼
[Phase 7: Payments, Webhooks & Evidence-Based Refund Lifecycle]
                        │
                        ▼
[Phase 8: End-to-End Testing, Security Hardening & Acceptance]
                        │
                        ▼
[Phase 9: Production Deployment & Operational Handover]
```

### Architectural Dependency Rationale:
1. **Foundation First (Phases 1–2):** The monorepo tooling, PostgreSQL schema, RLS policies, and language-neutral OpenAPI contracts in `packages/api-contracts` must exist before frontend applications write code.
2. **Read-Path Validation (Phases 3–4):** Building and verifying the catalog read-path on Customer Web and Android allows both frontend teams to validate API contracts, image loading, and caching against real data before introducing transactional checkout logic.
3. **Reservation & Cart Engine (Phase 5):** Establishes atomic, deterministic multi-product row-locking and stock reservation prior to payment integration.
4. **Admin Queue (Phase 6):** Equips store staff to observe and manage orders before live payments are connected.
5. **Payments & Refunds (Phase 7):** Integrates Razorpay test mode, HMAC webhook verification, and the automated late-webhook refund flow on top of a battle-tested order and inventory engine.
6. **Hardening & Acceptance (Phase 8):** Concurrency stress testing (k6), mobile penetration review, and full user journey verification.
7. **Production (Phase 9):** Live keys, production hosting, custom domains, and staff training.

---

## 3. Detailed Phase Breakdown

### Phase 0: Requirements & Architecture Approval
- **Status:** **Active / Current Phase**
- **Objective:** Establish authoritative documentation, threat models, database schemas, and architectural alignment prior to writing application code.
- **Deliverables:** Complete 9 core Phase 0 architecture documents in `docs/phase-0/`.
- **Completion Gate:** Client review and formal written approval of Phase 0 deliverables.

---

### Phase 1: Repository, Local Tooling & Backend Foundation
- **Prerequisites:** Phase 0 approval.
- **Objectives:** Establish the version-controlled monorepo, local Dockerized Supabase instance, Turborepo pipelines, and standalone Backend API scaffold.
- **Key Deliverables:**
  - Monorepo structure configured with Turborepo (`apps/backend-api`, `apps/customer-web`, `apps/admin-web`, `apps/android`).
  - Local Supabase CLI environment configured (`supabase start`).
  - Fastify / Express modular monolith scaffolded in `apps/backend-api` with health check and Supabase connection pool.
  - GitHub Actions CI workflows for linting and typechecking.
- **Completion Gate:** `supabase start` boots cleanly; `apps/backend-api` health check returns HTTP 200 OK; CI pipeline passes.

---

### Phase 2: Database Schema, RLS & Backend Contracts
- **Prerequisites:** Phase 1 complete and approved.
- **Objectives:** Apply PostgreSQL DDL migrations, configure Row Level Security (RLS) policies, author stored procedures, and define language-neutral API contracts.
- **Key Deliverables:**
  - Idempotent SQL migrations for tables (`profiles`, `staff_roles`, `categories`, `products`, `inventory`, `orders`, `order_items`, `payments`, `refunds`, `audit_logs`).
  - Strict RLS policies denying direct client table writes.
  - Stored procedures: `rpc_reserve_order_stock` and `rpc_reconcile_late_payment`.
  - Language-neutral OpenAPI 3.1 / JSON Schema definitions in `packages/api-contracts`.
  - Comprehensive `pgTAP` database test suites.
- **Completion Gate:** `supabase db reset` executes cleanly; 100% of `pgTAP` RLS tests pass in CI.

---

### Phase 3: Customer Web Catalogue & Product Discovery
- **Prerequisites:** Phase 2 complete and approved.
- **Objectives:** Build responsive product discovery, category navigation, real-time availability badges, and search on Customer Web.
- **Key Deliverables:**
  - Next.js App Router catalog pages with Incremental Static Regeneration (ISR).
  - Supabase Storage image CDN integration.
  - Zod schemas in Customer Web validating `/api/v1/catalog/*` responses.
  - Real-time stock status badge hydration via Supabase Realtime.
- **Completion Gate:** Customer Web loads active catalog, filters by category, and reflects instant out-of-stock toggles.

---

### Phase 4: Android Catalogue & Product Discovery
- **Prerequisites:** Phase 2 complete and approved.
- **Objectives:** Build native Kotlin Jetpack Compose catalog screen, category filter chips, search bar, and image caching.
- **Key Deliverables:**
  - Android Clean Architecture data layer consuming `/api/v1/catalog/*`.
  - Kotlin `data class` models mirroring API JSON contracts.
  - Coil image loading with memory and disk caching.
  - Room database offline catalog caching.
- **Completion Gate:** Native Android app displays catalog with smooth 120Hz scrolling and offline browsing capability.

---

### Phase 5: Cart, Inventory Reservation & Checkout Engine
- **Prerequisites:** Phases 3 and 4 complete and approved.
- **Objectives:** Implement cart calculations, deterministic multi-product row-locking, stock reservation procedure, and customer mobile OTP authentication.
- **Key Deliverables:**
  - Persistent cart state on Web and Android.
  - Customer mobile phone OTP authentication (SMS gateway integration).
  - Implementation of `/api/v1/orders/checkout` in Backend API executing `rpc_reserve_order_stock`.
  - 10-minute reservation TTL cleanup worker (`rpc_release_expired_reservations`).
  - Pickup timing selection (Immediate vs. Scheduled windows).
- **Completion Gate:** Concurrent checkout tests verify zero overselling; multi-product reservations lock deterministically without deadlocks; abandoned checkouts release stock after TTL.

---

### Phase 6: Admin Product, Inventory & Order Operations
- **Prerequisites:** Phase 5 complete and approved.
- **Objectives:** Build the staff counter portal, live dispatch queue, PIN/QR pickup verification modal, and inventory adjustment tools.
- **Key Deliverables:**
  - Admin Web protected dashboard with staff authentication and RBAC.
  - Live Kanban order dispatch board connected to Supabase Realtime WebSocket channel.
  - Counter collection verification modal (PIN entry and QR code scanning).
  - Physical stock adjustment screen with audit reason logging.
  - Emergency out-of-stock toggle.
- **Completion Gate:** New order creates card on admin queue within 1 second; staff completes handover, triggering physical stock deduction.

---

### Phase 7: Payments, Webhooks & Evidence-Based Refund Lifecycle
- **Prerequisites:** Phase 6 complete and approved.
- **Objectives:** Integrate Razorpay test mode, HMAC-SHA256 webhook verification, cash-at-pickup flow, and the automated late-webhook refund pipeline.
- **Key Deliverables:**
  - Razorpay standard checkout sheet integration on Web and Android SDK.
  - Webhook endpoint `/api/v1/webhooks/razorpay` with HMAC signature validation and idempotency checks.
  - Late payment reconciliation procedure (`rpc_reconcile_late_payment`).
  - Automated refund workflow: gateway acceptance transitions to `refund_processing`; webhook `refund.processed` authoritatively transitions to `refunded`.
  - Cash-at-pickup collection confirmation workflow.
- **Completion Gate:** Test card/UPI payment marks order `confirmed` and payment `captured`; delayed payment for expired/sold-out order triggers automated refund; cash order requires staff cash confirmation.

---

### Phase 8: End-to-End Testing, Security Hardening & Acceptance
- **Prerequisites:** Phase 7 complete and approved.
- **Objectives:** Validate all 10 critical edge cases, execute load tests, perform mobile penetration analysis, and conduct stakeholder user acceptance testing (UAT).
- **Key Deliverables:**
  - Automated Playwright E2E test suite covering full customer journeys.
  - k6 load scripts testing peak concurrent checkout throughput.
  - Mobile APK reverse-engineering inspection verifying zero hardcoded secrets.
  - Verification of all 10 critical edge-case scenarios in `TESTING_STRATEGY.md`.
- **Completion Gate:** All 10 edge-case scenarios pass; zero leaked secrets; formal written acceptance sign-off from technical lead and client.

---

### Phase 9: Production Deployment & Operational Handover
- **Prerequisites:** Phase 8 complete and signed off.
- **Objectives:** Deploy to production cloud hosting, switch Razorpay to live merchant credentials, setup counter kiosks, and train store staff.
- **Key Deliverables:**
  - Supabase Production project provisioned with verified migrations.
  - Custom domain SSL routing for `shop.moodyorange.com`, `admin.moodyorange.com`, and `api.moodyorange.com`.
  - Razorpay live merchant activation.
  - Android production release (AAB) uploaded to Google Play Console.
  - Counter kiosk tablet configuration and staff training.
  - Day-1 on-site launch monitoring.
- **Completion Gate:** First real retail customer places an order, pays live, and successfully collects fresh items at the physical counter.

---

## 4. Phase Completion Gate Summary

| Phase | Milestone Name | Dependencies | Estimated Complexity | Completion Gate |
| :---: | :--- | :--- | :---: | :--- |
| **0** | Requirements & Architecture | None | Medium | Client sign-off on 9 architecture documents |
| **1** | Repository & Backend Foundation | Phase 0 | Medium | Local Supabase running, API health check green |
| **2** | DB Schema, RLS & Contracts | Phase 1 | High | `pgTAP` tests pass 100%, OpenAPI contracts ready |
| **3** | Customer Web Catalogue | Phase 2 | Medium | Web catalog displays items, ISR caching verified |
| **4** | Android App Catalogue | Phase 2 | Medium | Native Compose catalog displays items, Coil cached |
| **5** | Cart, Stock Lock & Checkout | Phases 3, 4 | High | Deterministic lock verified, 0 overselling under load |
| **6** | Admin Operations & Queue | Phase 5 | High | Realtime dispatch chimes, PIN/QR handover works |
| **7** | Payments, Webhooks & Refunds | Phase 6 | High | HMAC verified, idempotency works, auto-refund verified |
| **8** | E2E Testing & Hardening | Phase 7 | High | All 10 edge cases pass, security audit clean |
| **9** | Production Launch & Handover | Phase 8 | Medium | Live payment confirmed, counter order collected |
