# Project QA — 23 November 2026

Checked the customer website, staff website, backend API, shared contracts, database test setup, and native Android app. Fixed the reproducible issues below. Local builds and automated checks pass; hosted SMS configuration currently prevents a complete authenticated test on the phone.

## Bugs fixed

| Area | Reproduction / previous behavior | Result |
| --- | --- | --- |
| Both websites | Run a production build while the development server is running; storefront JavaScript/CSS return 404. | Development uses `.next-dev`, separate from production output. |
| Customer website | Open at 390 px; content grows to 606 px and header actions leave the screen. | Header fits; checked at 320, 390, 640, 960, 1280, and 1440 px. |
| Catalog / backend | Hosted database lacks `food_classification`; an explicit column query fails with SQL 42703. | Catalog supports both schemas and uses the existing `is_veg` fallback; seven real products load. |
| Customer website | Product labels say GST is included, while checkout adds tax. | Cards and details show the applicable additional GST rate. |
| Customer website | Edit the account name; header keeps the previous name. | Successful profile saves update the stored session and header. |
| Customer website | Name onboarding fails to save but closes without reporting failure. | Name entry stays open, reports failure, and allows retry. |
| Customer website | Malformed saved cart values cause invalid state or a rendering failure. | Stored products and quantities are validated; invalid entries are ignored. |
| Customer website | Test numbers appear when development login is disabled; the second number shows the wrong OTP. | Hints follow the explicit development flag and show the correct codes. |
| Staff website | Enter zero prep time, stock, or low-stock threshold; a default replaces it. | Zero is preserved in the submitted product payload. |
| Staff website | Section requests fail; the page looks empty without an error. | A visible error and retry button recover the section. |
| Backend authentication | Submit a forged development customer token with mock services disabled. | Returns 401; development token support requires explicit mock mode. |
| Backend payments/refunds | Missing gateway credentials produce fabricated successful gateway results. | Real mode rejects missing/placeholder credentials; production rejects mock mode. |
| Android payments | Online checkout submits fabricated payment IDs/signatures. | Uses the Razorpay SDK and verifies the real gateway callback through the backend. Failed payments retry the reserved order. |
| Android checkout | Cart validation expects field names the backend never returns. | Parses real item names, prices, availability, subtotal, GST, packaging, and totals; regression cases cover the real response. |
| Android checkout | Submit fulfillment `counter_pickup`, which the request contract rejects. | Sends `immediate` or `scheduled`. |
| Both checkout clients | Retry after editing details with the previous idempotency key; backend returns a payload conflict. | Identical requests reuse the key; changed requests receive a new key. Android preserves its scheduled time across retries. |
| Both checkout clients | An expired online reservation leaves payment retry unusable. | Clears the expired reservation and permits reviewing/reserving again. Website close/reopen preserves an unexpired pending order. |
| Android account state | An in-flight profile/order response can arrive after logout and restore stale data. | Session updates check the session generation under a lock; stale order and checkout responses are discarded. |
| Credential handling | Privileged Supabase JWTs are embedded in a script, tests, and the old project archive. | Source uses environment configuration or synthetic test data. Scanner detects service-role JWTs independently of assignment formatting. The project archive is regenerated without environment files. |

## Verification

| Check | Result |
| --- | --- |
| `npm.cmd test` | 154 tests passed across 17 files. |
| `npm.cmd run test:e2e` | 14 Chrome browser tests passed. |
| `npm.cmd run lint` | Passed, including OpenAPI validation. |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run build` | Customer, staff, backend, and shared contract builds passed. |
| Android `testDebugUnitTest lintDebug assembleDebug` | 46 tests passed; APK built; lint has zero errors and 28 warnings. |
| Source secret scan | Passed; no detected privileged credentials in scanned source. |
| Database concurrency / pgTAP | Not verified: a dedicated test database is required. |

The browser suite covers real backend health, catalog, filtering, cart totals, and authorization. It also exercises customer search/sort/theme, product details, bag persistence, responsive navigation, error recovery, profile/onboarding, checkout retry behavior, and staff inventory/product forms. Authenticated mutations and online payment cases use isolated responses; they do not create hosted orders or charge a payment method. Historical browser suites with obsolete copy/selectors were not included in this passing result.

## Connected Android device

Tested on an Infinix X663C running Android 16, serial `0882131261032410`, over USB with `adb reverse tcp:4000 tcp:4000`. Installed the final debug APK using `adb install -r`.

Observed home/shop navigation, hosted product loading and dietary indicators, retry after catalog failure, product/cart operations, a quantity of two with subtotal ₹1,300, persistence through force-stop and APK replacement, and signed-out order/authentication prompts. No `AndroidRuntime` fatal exception was observed during these checks. JDK 17 was used because the installed Java 25 runtime caused Android lint to crash.

Evidence lives in `test-results/`: `android-latest-shop.png`, `android-latest-cart.xml`, `android-cart-persisted.xml`, `android-auth-online-result.xml`, `android-auth-provider-error.png`, `website-mobile-fixed.png`, and browser screenshots under `browser/`. The APK is `apps/android/app/build/outputs/apk/debug/app-debug.apk`.

## Remaining external requirements

1. **Hosted phone authentication:** after Wi-Fi was connected, requesting the supplied test number returned **“Unsupported phone provider.”** Configure the Supabase SMS provider or hosted test-phone setup. Authenticated profile/history/checkout/logout on the real phone remain unverified; OTP entry could not be reached through the normal UI.
2. **Real payments/refunds:** valid gateway credentials and a configured gateway test account are required for an actual transaction. SDK build/integration and isolated browser/backend payment behavior were checked; no real charge or refund was performed.
3. **Database verification:** provide `TEST_SUPABASE_DB_URL` for a dedicated database before concurrency/pgTAP runs. Do not point destructive database tests at the active store. The hosted schema also lacks the food-classification column; apply the intended migration through the normal database release process.
4. **Credential rotation:** rotate/revoke the previously exposed Supabase service-role key. Removing it from working files and replacing `orange.zip` does not revoke the old key or remove it from Git history or previously shared archives.

Changes remain in the working tree for review; no deployment or Git commit was made.
