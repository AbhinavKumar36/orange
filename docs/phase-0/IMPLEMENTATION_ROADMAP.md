# Moody Orange — Phased Implementation Roadmap & Engineering Plan

**Document Version:** 1.4.1 (Phase 0.4.1 Final Blocker Resolution)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Ready for Phase 0 Approval Review  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial 9-phase roadmap. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Formalized 6-step phase progression cycle. |
| **1.2.0** | 2026-10-30 | Lead Architect | Phase 0.2 Revision: Realigned into 10 dependency-driven phases. |
| **1.3.0** | 2026-10-30 | Lead Architect | Phase 0.3 Consistency Pass: Hardened Phase 2 and Phase 7 specifications. |
| **1.4.0** | 2026-10-30 | Lead Architect | Phase 0.4 Consistency Pass: Standardized 6-part acceptance gate structure for all phases. |
| **1.4.1** | 2026-10-30 | Lead Architect | **Phase 0.4.1 Final Blocker Resolution:**<br>• Incorporated protected inventory write-offs (`rpc_write_off_inventory`) into Phase 2 and Phase 6.<br>• Refined Phase 5 with separated Online (`draft`) vs. Cash (`confirmed`) lifecycles.<br>• Enhanced Phase 7 with partial refund concurrency and atomic late payment recovery decisions. |

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
1. **Foundation First (Phases 1–2):** The monorepo tooling, PostgreSQL schema, hardened RLS policies, input validation procedures, and language-neutral OpenAPI contracts in `packages/api-contracts` must exist before frontend applications write code.
2. **Read-Path Validation (Phases 3–4):** Building and verifying the catalog read-path on Customer Web and Android allows both frontend teams to validate API contracts, image loading, and caching against real data before introducing transactional checkout logic.
3. **Reservation & Cart Engine (Phase 5):** Establishes atomic, deterministic multi-product row-locking, duplicate cart item aggregation, customer-scoped idempotency, and distinct Online (`draft`, `pending`, TTL) vs. Cash (`confirmed`, `unpaid`, no TTL) checkout pipelines prior to payment integration.
4. **Admin Queue (Phase 6):** Equips store staff to observe and manage orders, handle cash receipt confirmation for `unpaid` cash orders, execute physical stock decrements upon counter handover, and perform protected inventory write-offs (`physical_stock >= reserved_stock`).
5. **Payments & Refunds (Phase 7):** Integrates Razorpay test mode, raw-body HMAC webhook verification, the automated late-webhook refund flow, and partial refund concurrency controls on top of a battle-tested order and inventory engine.
6. **Hardening & Acceptance (Phase 8):** Concurrency stress testing (k6), mobile penetration review, and full user journey verification across all 17 edge cases.
7. **Production (Phase 9):** Live keys, production hosting, custom domains, and staff training. Production deployment remains strictly blocked until Phase 8 acceptance testing is complete.

---

## 3. Detailed Phase Specifications & Acceptance Gates

### Phase 0: Architecture and Requirements Approval
- **Status:** **Active / Current Phase**
- **Prerequisites:** None.
- **Deliverables:**
  - Complete, mutually consistent Phase 0 architecture suite (9 documents in `docs/phase-0/` and root `README.md`).
- **Required Automated Tests:**
  - N/A for Phase 0 (pure documentation and design phase; automated test suites are specified for implementation in subsequent phases).
- **Required Manual Verification:**
  - Comprehensive cross-document consistency audit: verify that state transitions, inventory invariants (`available_stock = physical_stock - reserved_stock`), deterministic locking, separated cash/online lifecycles, and refund flows match identically across all documents.
- **Security or Operational Checks:**
  - Verification of STRIDE threat mitigations, Dual-Layer Security Model, service-role bypass gateway authorization, complete 10-table RLS matrix, and explicit function hardening (`search_path = public, pg_temp;`, revoked public execute).
- **Acceptance Criteria:**
  - Zero documentation contradictions; zero unapproved business assumptions; all open operational/financial decisions recorded in the Central Decision Register with recommended defaults; no application code or database migrations created.
- **Evidence Required for Approval:**
  - Signed-off Phase 0.4.1 Architecture Consistency & Security Report and client sign-off.

---

### Phase 1: Repository, Tooling & Backend Foundation
- **Prerequisites:** Phase 0 approval.
- **Deliverables:**
  - Turborepo monorepo configuration with `apps/backend-api`, `apps/customer-web`, `apps/admin-web`, `apps/android`, `packages/api-contracts`.
  - Local Dockerized Supabase CLI environment configured.
  - Standalone Backend API scaffold (Fastify/Express in Node.js/TS) with health check route and connection pooling.
  - Sanitized `.env.example` templates committed across all applications.
  - GitHub Actions CI workflows for linting, typechecking, and secret scanning.
- **Required Automated Tests:**
  - Unit tests for Backend API health check route.
  - Monorepo build and linting checks in CI (`turbo run lint test build`).
- **Required Manual Verification:**
  - Verify `supabase start` initializes database, auth, and storage cleanly on developer machine.
  - Verify Backend API boots on `localhost:4000` and connects to local PostgreSQL.
- **Security or Operational Checks:**
  - Automated Git secret scanning (`gitleaks`) to ensure zero real credentials or private keys are committed.
- **Acceptance Criteria:**
  - Monorepo installs dependencies cleanly; Backend API health route returns `HTTP 200 { "status": "ok" }`; CI pipeline passes green.
- **Evidence Required for Approval:**
  - CI build run logs and developer onboarding verification log.

---

### Phase 2: Database Schema, RLS & Backend Contracts
- **Prerequisites:** Phase 1 complete and approved.
- **Deliverables:**
  - Idempotent PostgreSQL SQL migration files in `supabase/migrations/` for all 10 tables, check constraints (`chk_stock_balance`, `chk_cash_no_online_expiry`).
  - Complete Row Level Security (RLS) policies for all 10 tables.
  - Hardened stored procedures: `rpc_reserve_order_stock`, `rpc_release_expired_reservations`, `rpc_reconcile_late_payment`, `rpc_complete_order_handover`, `rpc_cancel_order`, `rpc_write_off_inventory`, and `rpc_issue_refund`.
  - All `SECURITY DEFINER` functions configured with explicit `SET search_path = public, pg_temp;` and revoked public execute privileges.
  - Language-neutral OpenAPI 3.1 / JSON Schema definitions in `packages/api-contracts`.
  - TypeScript Zod schemas generated from OpenAPI contracts.
  - Native Kotlin data class models implementing contract parity.
- **Required Automated Tests:**
  - `pgTAP` test suite executing all RLS permission checks and stored procedure invariants.
  - Spectral OpenAPI linting and schema validation tests in CI.
- **Required Manual Verification:**
  - Verify that direct table queries using anon key are blocked by RLS as specified.
- **Security or Operational Checks:**
  - Verify all `SECURITY DEFINER` procedures enforce `SET search_path = public, pg_temp;` and revoke public execute.
- **Acceptance Criteria:**
  - `supabase db reset` executes cleanly with zero warnings; 100% of `pgTAP` tests pass; OpenAPI linter reports zero errors.
- **Evidence Required for Approval:**
  - `pgTAP` CI test run output and generated OpenAPI specification.

---

### Phase 3: Customer Web Catalogue & Product Discovery
- **Prerequisites:** Phase 2 complete and approved.
- **Deliverables:**
  - Next.js customer application catalog pages (`/catalog`, `/product/[id]`).
  - Search, category filter chips (Cakes, Juices, Chocolates), and real-time availability badges.
  - Supabase Storage image loader with responsive image sizing.
- **Required Automated Tests:**
  - Component unit tests (Vitest + React Testing Library) for catalog rendering and stock indicators.
  - API mock tests verifying contract compliance with Zod schemas.
- **Required Manual Verification:**
  - Visual review of catalog responsiveness across mobile, tablet, and desktop viewports.
- **Security or Operational Checks:**
  - Verify customer web bundle contains only public anon keys; zero service role keys exposed.
- **Acceptance Criteria:**
  - Catalog renders products with images; instant out-of-stock toggles update UI via Supabase Realtime; zero hydration errors.
- **Evidence Required for Approval:**
  - Cross-browser screenshot audit and green CI test results.

---

### Phase 4: Android Catalogue & Product Discovery
- **Prerequisites:** Phase 2 complete and approved.
- **Deliverables:**
  - 100% native Kotlin Jetpack Compose catalog screen, search bar, and category filter chips.
  - Retrofit HTTP client consuming `/api/v1/catalog/*`.
  - Coil image loading with disk and memory caching.
  - Room local database cache for offline product browsing.
- **Required Automated Tests:**
  - Kotlin serialization unit tests for all catalog DTOs.
  - Compose UI tests for catalog listing and search filtering.
- **Required Manual Verification:**
  - Run app on Android emulator and physical Android test device; verify smooth 120Hz scrolling and image caching.
- **Security or Operational Checks:**
  - Inspect decompiled APK using `apktool` / `jadx` to verify zero private keys are present.
- **Acceptance Criteria:**
  - Native app launches cleanly; fetches and caches catalog; renders availability badges; scrolls smoothly.
- **Evidence Required for Approval:**
  - Video recording of Android emulator execution and Gradle test report.

---

### Phase 5: Cart, Inventory Reservation & Checkout Engine
- **Prerequisites:** Phases 3 and 4 complete and approved.
- **Deliverables:**
  - Persistent shopping cart state on Web and Android.
  - Customer mobile phone OTP authentication flow.
  - Backend API endpoint `/api/v1/orders/checkout` invoking `rpc_reserve_order_stock` with separated lifecycles:
    - Online: `draft`, `pending`, `expires_at = NOW() + 10m`.
    - Cash: `confirmed`, `unpaid`, `expires_at = null`.
  - Customer-scoped idempotency key validation with SHA-256 payload hashing.
  - Background reservation expiration worker releasing unpaid online orders after TTL (`rpc_release_expired_reservations`).
  - Pickup timing selection (Immediate vs. Scheduled windows).
- **Required Automated Tests:**
  - Unit tests for cart math (subtotal, taxes, totals in integer paise).
  - Integration tests for Scenarios 1–7, 16 (duplicate cart aggregation, invalid quantities, customer-scoped idempotency, deterministic locking, atomic allocation, TTL cleanup, cash order immunity).
- **Required Manual Verification:**
  - Initiate checkout on Web and Android simultaneously for last remaining unit; verify only one customer succeeds.
- **Security or Operational Checks:**
  - Verify caller identity is strictly derived from `jwt.sub`; verify client prices are ignored.
- **Acceptance Criteria:**
  - Zero overselling under concurrent checkouts; zero deadlocks; cash orders accepted immediately without online TTL; expired online reservations restored.
- **Evidence Required for Approval:**
  - Concurrency integration test report and DB inventory audit trace.

---

### Phase 6: Admin Product, Inventory & Order Operations
- **Prerequisites:** Phase 5 complete and approved.
- **Deliverables:**
  - Admin Web dashboard with staff authentication and role verification.
  - Live Kanban order dispatch board with Supabase Realtime WebSocket listeners.
  - Counter collection verification modal (PIN entry and QR code scanning).
  - Handover completion workflow (`rpc_complete_order_handover`): enforces staff cash receipt confirmation for `unpaid` cash orders; verifies online capture; blocks double completion.
  - Protected inventory write-off interface (`rpc_write_off_inventory`) defending `physical_stock >= reserved_stock`.
- **Required Automated Tests:**
  - Integration tests for Scenarios 9 and 15 (cash order completion enforcement, write-off protection with active reservations).
  - Component tests for admin queue and handover verification modal.
- **Required Manual Verification:**
  - Place order on customer app; observe instant card appearance on admin board; complete handover with cash receipt check.
- **Security or Operational Checks:**
  - Verify counter staff cannot access manager-only price edit, write-off, or role management endpoints.
- **Acceptance Criteria:**
  - Admin dispatch board receives new orders within 1.0s; handover atomically decrements `physical_stock` and `reserved_stock`; write-off exceeding unreserved stock is blocked.
- **Evidence Required for Approval:**
  - Live dispatch board demonstration recording and audit log export.

---

### Phase 7: Payments, Webhooks & Evidence-Based Refund Lifecycle
- **Prerequisites:** Phase 6 complete and approved.
- **Deliverables:**
  - Razorpay standard checkout integration on Web and Android SDK.
  - Authoritative payment verification before database state transition.
  - Webhook endpoint `/api/v1/webhooks/razorpay` validating raw-body HMAC-SHA256 signatures and payment idempotency.
  - Late payment reconciliation procedure (`rpc_reconcile_late_payment`) with explicit atomic recovery decision tree.
  - Evidence-based partial/full refund pipeline (`rpc_issue_refund`): payment row locking, cumulative cap enforcement, stable refund idempotency keys.
- **Required Automated Tests:**
  - Integration tests for Scenarios 8, 10, 11, 13, 14, 17 (reservation retention on payment, late webhook refund, cumulative refund cap, network timeout idempotency, conflicting payment isolation, concurrent partial refund locking).
- **Required Manual Verification:**
  - Execute live test card and UPI sandbox payments; verify state transitions from draft to confirmed.
- **Security or Operational Checks:**
  - Verify raw request buffer is used for HMAC verification; verify service-role and Razorpay secret keys remain server-side.
- **Acceptance Criteria:**
  - Successful payment retains reserved stock; duplicate webhooks handled idempotently; late payment for sold-out order triggers automated refund; cumulative refunds capped at captured amount.
- **Evidence Required for Approval:**
  - Razorpay sandbox transaction logs and webhook delivery audit trail.

---

### Phase 8: End-to-End Testing, Security Hardening & Acceptance
- **Prerequisites:** Phase 7 complete and approved.
- **Deliverables:**
  - Automated Playwright E2E test suite covering complete user journeys across Web and Admin.
  - k6 concurrency load scripts simulating peak counter rush.
  - Penetration testing and security hardening review report.
  - User Acceptance Testing (UAT) sign-off document.
- **Required Automated Tests:**
  - 100% pass rate across all 17 critical edge-case integration scenarios in `TESTING_STRATEGY.md`.
  - Playwright E2E suite passes in headless CI.
  - k6 load test sustains target concurrency with 0.00% overselling.
- **Required Manual Verification:**
  - End-to-end walkthrough of all customer and staff journeys on physical devices.
- **Security or Operational Checks:**
  - Static application security testing (SAST), dependency vulnerability audit (`npm audit`), and APK secret scanning.
- **Acceptance Criteria:**
  - All test suites green; zero high/critical vulnerabilities; UAT accepted by client with zero blockers.
- **Evidence Required for Approval:**
  - Complete UAT sign-off document signed by technical lead and client.

---

### Phase 9: Production Deployment & Operational Handover
- **Prerequisites:** Phase 8 complete and signed off. **PRODUCTION DEPLOYMENT REMAINS BLOCKED UNTIL PHASE 8 IS FULLY APPROVED.**
- **Deliverables:**
  - Production Supabase project provisioned with final migrations and verified RLS.
  - Production Backend API deployed to cloud container platform with SSL termination.
  - Customer Web and Admin Web deployed to production CDN domains (`shop.moodyorange.com`, `admin.moodyorange.com`).
  - Native Android release AAB signed and published to Google Play Console internal track.
  - Production Razorpay live merchant keys activated and configured in backend environment.
  - Staff operational training manual and counter kiosk configuration.
- **Required Automated Tests:**
  - Production synthetic smoke tests verifying API health and catalog availability.
- **Required Manual Verification:**
  - Live end-to-end counter test: place a live ₹1.00 test order, verify staff board notification, verify live cash/UPI payment, and complete counter pickup handover.
- **Security or Operational Checks:**
  - Verify production secrets are set strictly via secure environment variables; verify debug flags and test mock routes are disabled.
- **Acceptance Criteria:**
  - All production endpoints healthy; first live retail customer order placed and collected successfully at the counter.
- **Evidence Required for Approval:**
  - Production deployment verification checklist and signed operational handover agreement.

---

## 4. Phase Completion Gate Summary

| Phase | Milestone Name | Dependencies | Estimated Complexity | Completion Gate |
| :---: | :--- | :--- | :---: | :--- |
| **0** | **Requirements & Architecture Approval** | None | Medium | Client sign-off on 9 architecture documents |
| **1** | **Repository & Backend Foundation** | Phase 0 | Medium | Local Supabase running, API health check green, CI passes |
| **2** | **DB Schema, RLS & Contracts** | Phase 1 | High | `pgTAP` tests pass 100%, OpenAPI contracts linted clean |
| **3** | **Customer Web Catalogue** | Phase 2 | Medium | Web catalog displays items, ISR caching verified |
| **4** | **Android App Catalogue** | Phase 2 | Medium | Native Compose catalog displays items, Coil cached |
| **5** | **Cart, Stock Lock & Checkout** | Phases 3, 4 | High | Deterministic lock verified, separated lifecycles, 0 overselling |
| **6** | **Admin Operations & Queue** | Phase 5 | High | Realtime dispatch chimes, PIN/QR handover, write-off protection |
| **7** | **Payments, Webhooks & Refunds** | Phase 6 | High | HMAC verified, idempotency works, auto-refund & partial cap verified |
| **8** | **E2E Testing & Hardening** | Phase 7 | High | All 17 edge cases pass, security audit clean, UAT signed |
| **9** | **Production Launch & Handover** | Phase 8 | Medium | Live payment confirmed, counter order collected |
