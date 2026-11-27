# Production readiness review — 25 November 2026

**Recommendation: do not deploy with all features enabled yet.** The current websites and Android debug build compile, and the updated layouts work at the tested widths. Payment recovery, refunds, credentials, phone authentication, and release configuration still have blockers.

Scope: current working tree relative to `ba3a036`, including the new design/copy changes and the previous uncommitted QA fixes. Several findings concern existing backend behavior rather than regressions introduced by the latest design changes. This was a review; no application fixes or deployment were performed. Review reproductions use isolated responses and did not create hosted orders, charge payments, or issue real refunds.

## Confirmed code findings

### 1. P1 — Failed webhooks are acknowledged and then permanently deduplicated

Location: `apps/backend-api/src/routes/webhooks.ts:106`, `:185`, `:306`, `:328`.

The handler records an event before reconciliation, ignores unsuccessful reconciliation HTTP responses, and marks the event processed. The deduplication query checks only whether a row exists. A database error or a crash after recording an event can therefore prevent a later delivery from completing the payment.

Isolated reproduction: reconciliation returned 503; webhook returned 200 and persisted `processed`. Redelivery returned 200 with `deduplicated=true`; reconciliation was called only once.

Recommendation: durably store incoming events, atomically claim processing, distinguish pending/failed/processed states, and retry failed work. Acknowledge an event after successful processing or successful durable enqueue. Check every database response and make the reconciliation operation idempotent.

### 2. P1 — Payment verification reports confirmation when the database requires a refund

Location: `apps/backend-api/src/routes/payments.ts:354`, `:432`; `supabase/migrations/20261031180200_inventory_and_order_procedures.sql:543`.

The reconciliation RPC returns an action and authoritative order/payment states. The API discards that result and always returns `confirmed/captured`. A late payment whose stock has been claimed by another order can therefore show a successful pickup reservation even though the database records `cancelled_inventory_depleted/refund_pending`.

Isolated reproduction returned exactly that mismatch. Both customer clients consume the false confirmation. The RPC's `TRIGGER_REFUND` actions are also not dispatched to a durable refund worker. The staff refund path selects only `captured` payment records, while these late-payment records have `refund_pending` status (`admin.ts:2086`), so the manual path is not a complete recovery mechanism either.

Recommendation: return the RPC's real states, render the refund outcome in both clients, and durably schedule its refund actions. Confirm gateway capture/amount/currency through authoritative gateway state or a captured webhook before describing a payment as captured.

### 3. P1 — Refund retries can submit the same refund to the gateway twice

Location: `apps/backend-api/src/routes/admin.ts:2137`, `:2144`; `apps/backend-api/src/services/razorpay.ts:208`.

The database RPC correctly replays an existing refund record, but the API calls the gateway again without checking the replay's status or existing provider refund ID. There is no stable gateway idempotency identifier in that call.

Isolated reproduction: two identical partial-refund requests with the same client key returned 200 and made two gateway calls for the same database refund record. A customer may be refunded twice if sufficient refundable balance remains; the second provider ID can overwrite the first.

Recommendation: atomically claim one refund job, replay the stored outcome, use the gateway's supported idempotency/reconciliation mechanism, and recover uncertain gateway responses before submitting another refund.

### 4. P1 — Refund completion is recorded before provider confirmation

Location: `apps/backend-api/src/routes/admin.ts:2152`, `:2172`, `:2204`; `apps/backend-api/src/routes/webhooks.ts:262`, `:293`.

The API writes `refunded` whenever refund creation returns successfully, even when the provider result is `pending`. Gateway errors are caught, but the response can still describe the order as refunded. Production `refund.processed` and `refund.failed` events perform no refund reconciliation because the corresponding branches only update mock stores.

Isolated reproduction: provider returned `pending`; database writes used `refunded`. A valid signed `refund.processed` event returned 200 with zero refund-record updates.

Recommendation: preserve pending/processing states, update completion or failure from provider confirmation, return the actual persisted state, and alert on overdue refund jobs. Include partial refunds in the order payment-status calculation.

### 5. P1 — Closing and reopening online checkout loses the existing reservation

Location: `apps/customer-web/src/components/CartDrawer.tsx:34`, `:258`; `apps/customer-web/src/components/CheckoutModal.tsx:270`.

Keeping pending state inside `CheckoutModal` does not preserve it when `CartDrawer` stops rendering its children. Closing checkout unmounts the modal; reopening creates a new modal with a new checkout key.

Browser reproduction: initiate an online order, fail gateway initialization, close checkout, reopen and submit again. Two draft orders were created with different keys while the first reservation remained unexpired.

Recommendation: keep reservation/retry state in a stable customer-scoped store or keep the checkout mounted independently of the drawer. Resume the existing order and clear it only after confirmation, explicit cancellation, or expiry. Add close/reopen and page-reload recovery coverage.

### 6. P2 — Database failure is displayed as zero inventory

Location: `apps/backend-api/src/routes/admin.ts:85`, `:1680`.

The REST helper returns `null` on failure; inventory assembly substitutes an empty map and zero stock. The new website error/retry UI cannot detect this because the API returns 200.

Isolated reproduction: inventory query returned 503; `/admin/inventory` returned 200 with physical and available stock both zero.

Recommendation: fail with a clear 503 for unavailable inventory, preserve previously loaded data as stale, and keep a genuine missing inventory record distinct from a failed query. Apply the same review to dashboard/product-list fallbacks.

### 7. P2 — Staff refresh tokens are discarded when the access token expires

Location: `apps/admin-web/src/lib/auth.ts:41`, `:218`.

`refreshStaffSession()` reads through `getStoredAdminSession()`, which clears expired sessions, including the still usable refresh token. The intended expired-session refresh cannot run.

Isolated reproduction: an expired access token with a refresh token caused zero refresh requests and removed the session.

Recommendation: retain the refresh credential while renewing an expired access token, schedule renewal before expiry, and clear the session after refresh rejection or explicit logout. Test a complete staff shift across token expiry.

### 8. P2 — Android token storage falls back to reversible encoding

Location: `apps/android/app/src/main/java/com/moodyorange/app/data/auth/SecureSessionStore.kt:52`, `:66`.

The Base64 fallback described as a JVM-test fallback is present in the production class and is not restricted to tests. If obtaining the Android Keystore key fails, the bearer token is persisted without encryption.

Recommendation: inject a test storage implementation for JVM tests. On real devices, fail closed or retain a temporary session in memory instead of persisting an unencrypted token. Review backup exclusions for authentication preferences.

### 9. P2 — New Android dark-mode button colors have insufficient text contrast

Location: `apps/android/app/src/main/java/com/moodyorange/app/ui/theme/Theme.kt:88`; `ui/components/CheckoutBottomSheet.kt:477`.

The new primary color `#3CA374` with white text has a contrast ratio of **3.14:1**. Checkout uses 15 sp bold text, below the large-text threshold, so it needs 4.5:1 for WCAG AA. This finding concerns the new theme change.

Recommendation: use a dark foreground for that bright dark-mode primary surface, or select a darker button background. Audit enabled, disabled, focus, stock-status, and error states across both themes.

### 10. P2 — Non-cake products can advertise immediate pickup despite configured preparation time

Location: `apps/customer-web/src/app/product/[id]/page.tsx:345`; `supabase/migrations/20261102180000_enforce_checkout_idempotency.sql:205`.

The new display logic shows preparation time only for cake slugs/categories and only above ten minutes. The checkout procedure uses preparation time for every product. A snack configured for 25 minutes will show “Immediate (In-Store Ready)” in its details while checkout schedules preparation time.

Recommendation: display the configured preparation time consistently for every category, or introduce an explicit ready-stock/instant-handover field instead of inferring readiness from a category name.

## Confirmed configuration and deployment gaps

| Gap | Evidence | Required before full launch |
| --- | --- | --- |
| Previously exposed service-role key remains active in local backend configuration | Compared current configuration against the earlier committed privileged JWT privately; they match. No credential was printed. | Rotate/revoke it, update trusted backend secrets, and address retained history/old archives. Removing source literals did not revoke the key. |
| Phone authentication disabled | Read-only hosted `/auth/v1/settings` returned 200 with `external.phone=false`. | Configure the SMS provider, provider billing/limits, and hosted test numbers; test real sign-in and onboarding on website and Android. |
| Gateway configuration contains placeholders | Presence checks found keys, but placeholder validation also matched. | Configure valid Razorpay test credentials/webhook secret, prove the complete test-mode lifecycle, then set live credentials and live webhook configuration. |
| Android production configuration missing | `validateReleaseConfig` failed for `PROD_API_BASE_URL`, `PROD_SUPABASE_URL`, and `PROD_SUPABASE_ANON_KEY`. | Supply real HTTPS endpoints/public key and build/test the signed, minified release AAB. |
| Expiry scheduler not wired in repository | `rpc_release_expired_reservations` exists at SQL line 290; production callers/scheduling are absent. | Provision and verify a periodic scheduler. Unless scheduled externally, abandoned online orders retain reserved stock indefinitely. Monitor expiry lag. |
| Dedicated database tests absent | Concurrency command reports `BLOCKED`; test URL is not configured. | Apply migrations to isolated staging and run pgTAP plus real multi-session concurrency tests. Verify the production migration history separately. |
| Dependency audit is not clean | `npm audit --omit=dev` reported three affected package entries: Next.js (moderate), PostCSS (high), Zod (high); no critical entries. | Review the linked advisories, upgrade to patched supported versions, and retest. Zod's reported fix is a major upgrade and requires contract/API migration work; avoid blindly forcing updates. |

Audit references: [Next.js advisory](https://github.com/advisories/GHSA-7qx7-33qx-rqx2), [PostCSS advisory](https://github.com/advisories/GHSA-6g55-p6wh-862q), [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). The audit identifies affected packages; feature-specific exploitability depends on the final hosting configuration and request paths.

## Validation and design inspection

| Check | Current result |
| --- | --- |
| Project tests | 154 passed across 17 files. |
| Lint / OpenAPI validation | Passed. |
| Type checking | Passed. |
| Production web/backend builds | Passed. |
| Maintained Chrome browser suite | 13 passed, 1 failed. |
| Android debug unit tests | 46 passed. |
| Android debug lint / APK | Passed; zero lint errors, 28 warnings. |
| Android release configuration | Failed: three production values missing. |
| Source secret scan | Passed; this does not prove earlier exposed credentials have been revoked. |
| Database concurrency | Blocked: no dedicated test database. |
| Connected Android device | No ADB device connected during this review; physical-device retest not performed. |

The browser failure is an outdated assertion at `e2e/runtime-smoke.spec.ts:159`: it expects “Failed to update profile,” while the improved API helper now shows the isolated server message “QA profile unavailable.” The modal remains open as intended. Update that expectation, then rerun the retry portion; do not report the current full browser run as passing.

Customer home was checked at 320, 390, 640, 960, 1280, and 1440 px. Staff overview, inventory, and products were checked at 390, 768, and 1440 px with isolated staff data. No document overflow was measured in those cases. The hero's four images loaded successfully after allowing CDN access. Staff tables require horizontal scrolling on small screens; a visible scroll hint or sticky product column would help counter staff.

The coordinated forest/ivory palette and revised retail language are consistent across the inspected screens. Before launch, replace Android's system placeholder launcher icon, source featured Android prices/dietary labels from the real catalog, and keep displayed tax/preparation details consistent with backend values. Android's hardcoded cake highlight is still ₹450 (`ProductShowcaseSection.kt:57`), whereas the currently tested catalog cake is ₹650.

Review evidence is under `test-results/production-review/`: `backend-reproductions.json`, `browser-inspection.json`, `browser-visual-inspection.json`, desktop/mobile screenshots, and the scripts that produced them. Auth/gateway/database mutations in those scripts are intercepted. No real payment transaction was tested.

## Suggested domain deployment

Use a separate origin for each interface:

| Origin | Service | Practical hosting choice |
| --- | --- | --- |
| `www.<your-domain>` (redirect apex to it) | Customer Next.js app | Vercel or another managed Next.js host |
| `admin.<your-domain>` | Staff Next.js app | A separate project on the same web host |
| `api.<your-domain>` | Fastify API | Render/Railway or a managed container service |
| Hosted Supabase project | Database, auth, storage | Separate staging and production projects |
| Scheduled worker | Expiry, refund jobs, webhook retries | Managed scheduler/worker with durable database jobs |

Keep the service-role key and gateway secrets exclusively in backend/worker secret storage. Each website needs its production `NEXT_PUBLIC_API_BASE_URL`, hosted Supabase URL, and public client key **at build time**. Android release should use the same production API. Set `NODE_ENV=production`, `ALLOW_MOCK_SERVICES=false`, and the exact HTTPS customer/admin origins in `ALLOWED_ORIGINS`.

Before publishing, configure DNS/TLS, Supabase auth settings, storage policies, gateway capture/webhook settings, and database migrations. Add rate limits, upstream request deadlines, readiness checks, error/queue monitoring, database backups with a tested restore, and appropriate security headers/CSP for the actual font/image/payment hosts. Require staff MFA or equivalent stronger account protection for refund/inventory privileges.

Add browser tests and a release-build check to CI; the current quality workflow does not run the maintained browser suite, and database CI can skip when its secret is missing. Require staging financial/database gates before a production promotion. Use reproducible CI artifacts instead of a manually maintained committed `orange.zip`.

## Recommended completion order

1. Rotate the exposed credential; provision isolated staging and working SMS/gateway test configuration.
2. Fix webhook durability, authoritative payment states, refund idempotency/completion, and checkout reservation recovery.
3. Wire expiry/refund/retry workers; fix staff session refresh, inventory error handling, Android storage, and the new display/contrast issues.
4. Upgrade affected dependencies; update stale browser assertions and add meaningful financial/expiry/restart regression tests.
5. Run a signed Android release and both websites against staging: OTP/profile, cash and online checkout, failed/cancelled payment, late capture, duplicate webhook, partial/full refund, expiry, stock adjustment, and handover. Run real database concurrency tests.
6. Promote reviewed artifacts with production secrets/domain configuration; verify health, an agreed controlled live transaction/refund, monitoring, backups, and rollback behavior.
