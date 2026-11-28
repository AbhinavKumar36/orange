# Production Readiness Report — Mangala Enterprises (Moody Orange Monorepo)

**Date:** 28 November 2026  
**Prepared For:** Client Delivery & Pre-Launch Sign-Off  
**Codebase Readiness Verdict:** **CODEBASE READY FOR STAGING / PRODUCTION DEPLOYMENT** *(External hosting/provider provisioning checklist in Section 5 required before live customer traffic)*

---

## 1. Executive Summary

The **Mangala Enterprises** platform (Backend API, Customer Website, Admin Operations Control Center, Android Customer App, and Supabase PostgreSQL schema) has completed all code-level P1 and P2 production hardening fixes, replaced all hardcoded placeholder media with dynamic backend catalog imagery + coherent neutral fallbacks, and added auto-advancing homepage carousels on both Customer Web and Android.

All **code-level blockers** have been resolved and verified. Before routing live customer traffic and real-money payments, the deployment team must complete the **external infrastructure provisioning steps** listed in Section 5.

---

## 2. Verification & Test Results (Executed 28 November 2026)

| Component | Command / Check | Result | Scope & Notes |
| :--- | :--- | :--- | :--- |
| **Monorepo Automated Tests** | `npm test` | **PASS** (17 files, 154 tests) | Backend routes, RBAC, order concurrency, stock deduction, catalog, payments, config validation, customer cart/auth, admin login hygiene. |
| **Secret Hygiene** | `npm run secret-scan` | **PASS** (544 files checked) | Zero committed secrets detected in tracked source files. |
| **Backend API (`@orange/backend-api`)** | `lint`, `typecheck`, `build` | **PASS** | ESLint, TypeScript `tsc --noEmit`, and `tsc` production build succeeded with 0 errors. |
| **Customer Web (`@orange/customer-web`)** | `lint`, `typecheck`, `build` | **PASS** | ESLint, TypeScript, and Next.js 15 production build (6 routes) succeeded with 0 errors. |
| **Admin Portal (`@orange/admin-web`)** | `lint`, `typecheck`, `build` | **PASS** | ESLint, TypeScript, and Next.js 15 production build (4 routes) succeeded with 0 errors; `.next/static` verified free of demo credentials. |
| **Android App (`apps/android`)** | `gradlew.bat testDebugUnitTest` | **PASS** | Kotlin debug compilation and JVM unit tests passed (`BUILD SUCCESSFUL`). Release AAB requires `PROD_*` env vars & keystore. |
| **Live Staging DB / pgTAP** | `npm run test:db:concurrency` | **NOT RUN** | Requires `TEST_SUPABASE_DB_URL` pointing to a live staging Postgres instance. |

---

## 3. Code-Level P1 & P2 Fixes Completed

### P1 Reliability & Payment Integrity
1. **Webhook Retry & State Tracking (`apps/backend-api/src/routes/webhooks.ts`):** Only deduplicates events whose persisted status is `processed`; failed or interrupted events are re-claimed (`processing`), RPC failures throw and mark `failed` with `503` so Razorpay retries, and `refund.processed` / `refund.failed` now reconcile real Supabase `refunds` and `orders` rows.
2. **Authoritative Payment Verification (`apps/backend-api/src/routes/payments.ts`, `CheckoutModal.tsx`):** `POST /api/v1/payments/verify` now returns the authoritative `orderStatus` and `paymentStatus` from `rpc_reconcile_late_payment` (including `cancelled_inventory_depleted` / `refund_pending`), and `CheckoutModal` displays a refund-pending notice instead of a false confirmation. Staff refund routes also accept `refund_pending` payments.
3. **Idempotent Refund Gateway Calls (`apps/backend-api/src/routes/admin.ts`):** Replays existing `provider_refund_id` records without issuing duplicate Razorpay refund requests, persists real provider status (`refund_processing` / `refunded` / `refund_failed`), and marks failed gateway calls accurately.
4. **Checkout Reservation Persistence (`apps/customer-web/src/components/CheckoutModal.tsx`):** Active online reservations and idempotency keys are persisted in `sessionStorage` across `CartDrawer` close/reopen until confirmed, expired, or cleared.

### P2 Operational, Security & UX Hardening
1. **Inventory 503 Handling (`apps/backend-api/src/routes/admin.ts`):** `/api/v1/admin/inventory` now returns `503 DATABASE_UNAVAILABLE` if Supabase queries return `null`, instead of masking outages as `0` stock.
2. **Admin Refresh Token Preservation (`apps/admin-web/src/lib/auth.ts`):** `refreshStaffSession()` reads the raw stored session so an expired access token does not erase the usable `refreshToken` before renewal.
3. **Android Secure Token Storage (`apps/android/.../SecureSessionStore.kt`):** Removed reversible Base64 disk persistence fallback; if Keystore is unavailable, tokens remain strictly in-memory and are never written unencrypted to `SharedPreferences`.
4. **Android Dark-Mode WCAG Contrast (`apps/android/.../ui/theme/Color.kt`):** Updated `ForestGreenDarkModePrimary` to `#1F6A4A` (> 6.3:1 contrast with white button text, meeting WCAG AA/AAA).
5. **Consistent Prep Time Display (`apps/customer-web/src/app/product/[id]/page.tsx`):** Displays configured `prepTimeMinutes` consistently across all product categories rather than only cakes.

### Dynamic Media & Homepage Auto-Carousel
- Removed all hardcoded `images.unsplash.com` URLs from `apps/customer-web` (`Hero.tsx`, `FeaturedCollections.tsx`) and `apps/android` (`HomeScreen.kt`, `ProductShowcaseSection.kt`).
- Added an auto-advancing product carousel on the **Customer Web** homepage (`Hero.tsx`, 4.5s interval, pause-on-hover, prev/next controls, dot indicators, `prefers-reduced-motion` support) and on the **Android** homepage (`HomeScreen.kt`, `HorizontalPager` with 4s auto-advance and indicator dots) driven by real backend catalog data with neutral placeholders when `imageUrl` is absent.

---

## 4. Production Environment & Deployment Checklist (External Provisioning Required)

Before routing live customer traffic, complete these hosting/provider steps:

- [ ] **Supabase Production Project & Migrations:** Apply all 7 SQL migrations in `supabase/migrations/` in chronological order and run `npm run test:db:concurrency` against staging.
- [ ] **Rotate Keys & Disable Mock Mode:** Configure `NODE_ENV=production`, `ALLOW_MOCK_SERVICES=false`, HTTPS `SUPABASE_URL`, and freshly rotated `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **Configure SMS OTP Provider:** Enable Phone Auth (`external.phone=true`) in Supabase with Twilio/MSG91.
- [ ] **Configure Live Razorpay & Webhooks:** Set real `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`, and register `/api/v1/webhooks/razorpay` in the Razorpay Dashboard.
- [ ] **Provision Production Staff Safely:** Run `node scripts/provision-admin.mjs --env production` for authorized staff/managers/admins.
- [ ] **Schedule Reservation Expiry Job:** Wire a periodic cron/Edge Function calling `rpc_release_expired_reservations` so abandoned online orders release reserved stock automatically.
- [ ] **Android Signed Release Build:** Supply `PROD_API_BASE_URL` (HTTPS), `PROD_SUPABASE_URL` (HTTPS), `PROD_SUPABASE_ANON_KEY`, and release signing keystore to build `bundleRelease` / `assembleRelease`.
- [ ] **Hosting & Repository Hygiene:** Configure `ALLOWED_ORIGINS` on `backend-api` for production web domains and clean temporary archive files (`orange.zip`) before tagging the release.
