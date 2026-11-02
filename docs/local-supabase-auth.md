# Moody Orange — Local Supabase Auth & Phone OTP Guide
**Phase 5 Hardening & Architecture Reference**

---

## 1. Overview & Development Architecture

Moody Orange uses **Supabase Auth** with Indian mobile phone numbers (`+91`) and SMS One-Time Passwords (OTP) as the single shared identity system across:
- **Customer Web Application** (Next.js 15)
- **Customer Mobile Application** (Android Jetpack Compose)
- **Fastify Backend API** (Node.js & Supabase JWT validation)
- **PostgreSQL Database** (RLS & atomic stock reservation)

During local development and continuous integration, developers do not need paid third-party SMS gateway credits (such as Twilio or MSG91). Supabase CLI provides native mock test OTP fixtures configured in `supabase/config.toml`, intercepting authentication codes at zero cost.

---

## 2. Supabase Configuration (`supabase/config.toml`)

Local Supabase authentication settings are defined in `supabase/config.toml`:

```toml
[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://127.0.0.1:3000", "http://localhost:4000", "moodyorange://auth/callback"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10

[auth.sms]
enable_signup = true
enable_confirmations = true
template = "Your Moody Orange verification code is: {{ .Code }}"

# Fixed test OTP fixtures for deterministic local development and automated testing
[auth.sms.test_otp]
"+919876543210" = "123456"
"9876543210" = "123456"
"+919876500001" = "111111"
"+919876500002" = "222222"
```

### Supported Test Numbers
| Phone Number | Fixed OTP | Description |
| :--- | :--- | :--- |
| `+919876543210` / `9876543210` | `123456` | Primary developer test account (Customer A) |
| `+919876500001` | `111111` | Secondary developer test account |
| `+919876500002` | `222222` | Multi-user isolation test account (Customer B) |

When testing on Web or Android:
1. Enter `9876543210` or `+919876543210`.
2. Click **Send Verification Code**.
3. Enter OTP `123456`.
4. Authentication completes immediately with an authenticated Supabase JWT session.

---

## 3. Canonical Phone Normalization

Both the web client (`@orange/api-contracts`) and Android client (`PhoneNumberUtil.kt`) enforce identical Indian phone normalization rules:

1. **E.164 Format**: All numbers resolve to `+91XXXXXXXXXX`.
2. **Subscriber Length**: Exactly 10 digits (`subscriberDigits.length === 10`).
3. **Leading Mobile Range**: Indian mobile numbers must start with `6`, `7`, `8`, or `9`.
4. **Domestic Trunk 0**: Leading trunk zero is cleanly stripped (`09876543210` -> `+919876543210`).
5. **Formatted Input**: Spaces, hyphens, and parentheses are stripped (`+91 (98765) 43210` -> `+919876543210`).
6. **Strict Error Handling**:
   - Rejects non-Indian country codes (e.g. `+14155552671`).
   - Rejects duplicate country codes (e.g. `+91919876543210`).
   - Rejects invalid characters or duplicate plus signs.

### Code Locations
- **TypeScript / Shared Contract**: `packages/api-contracts/src/phone.ts`
- **Android Kotlin**: `apps/android/app/src/main/java/com/moodyorange/app/util/PhoneNumberUtil.kt`

---

## 4. Environment Separation & Security Matrix

| Parameter | Local Development | Staging / Preview | Production |
| :--- | :--- | :--- | :--- |
| **Supabase URL** | `http://localhost:54321` | Hosted Supabase Dev project | Hosted Supabase Prod project |
| **SMS Gateway** | `[auth.sms.test_otp]` (Free) | Twilio / MSG91 Sandbox | Twilio / MSG91 Production |
| **Fastify Base URL** | `http://localhost:4000/api/v1` | `https://api-staging.moodyorange.com/api/v1` | `https://api.moodyorange.com/api/v1` |
| **Android Manifest** | `usesCleartextTraffic="true"` in `src/debug` only | Strict HTTPS | Strict HTTPS (cleartext prohibited) |
| **Anon Key Expose** | Public in web client & app | Public in web client & app | Public in web client & app |
| **Service Role Key** | Backend `.env` only | Backend secret store only | Backend secret store only (**Never in APK/Web**) |

---

## 5. Security & Idempotency Rules

### A. Authoritative Customer Ownership
- The client-supplied body fields `customerId` or `customerPhone` in checkout requests are **never trusted** by the backend.
- Customer identity and verified phone are derived strictly from the server-verified JWT session:
  ```typescript
  const customerId = request.user.id;
  const customerPhone = request.user.phone;
  ```
- If a client attempts to pass a spoofed phone number in the checkout payload, the backend overrides it with the verified session phone.

### B. Mandatory Idempotency Keys
- Every `POST /orders/checkout` request **must** supply an `X-Idempotency-Key` or `Idempotency-Key` header.
- Length: 1 to 128 characters, matching `^[a-zA-Z0-9_-]+$`.
- Requests missing the header return `400 Bad Request` with `MISSING_IDEMPOTENCY_KEY`.
- Duplicate submissions with the same key and identical items return the existing order (`200 OK`) without re-reserving stock.
- Reusing an idempotency key with different items returns `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
- Reusing an idempotency key across different customers returns `403 Forbidden` (`IDEMPOTENCY_OWNERSHIP_MISMATCH`).

### C. Database Atomic Stock Reservation
- Implemented in `supabase/migrations/20261102180000_enforce_checkout_idempotency.sql`.
- Uses PostgreSQL transaction-level advisory locking on `order_idemp:<customer_id>:<idempotency_key>`.
- Prevents race conditions and inventory double-decrement during simultaneous checkout attempts.

---

## 6. Android Device Connectivity Guide

### Candidate Host Resolution in Debug Mode
When debugging on Android, `MoodyOrangeApiClient.kt` tests candidate base URLs automatically:
1. `192.168.29.197:4000` (Host PC Wi-Fi LAN IP)
2. `10.0.2.2:4000` (Standard Android Studio Emulator)
3. `127.0.0.1:4000` (USB cable with `adb reverse tcp:4000 tcp:4000`)

### Connecting via USB Reverse
To connect a physical Android device over USB:
```bash
adb reverse tcp:4000 tcp:4000
adb reverse tcp:54321 tcp:54321
```

### Network Security Configuration
- `apps/android/app/src/debug/AndroidManifest.xml`: allows cleartext HTTP for local emulator and LAN endpoints.
- `apps/android/app/src/main/AndroidManifest.xml`: production release manifest with standard HTTPS requirements.

---

## 7. Local Developer Quickstart

### 1. Start Local Supabase
```bash
npx supabase start
```

### 2. Run Database Migrations
```bash
npm run db:migrate
```

### 3. Start Backend API (Port 4000)
```bash
npm run dev --workspace=@orange/backend-api
```

### 4. Start Customer Web (Port 3000)
```bash
npm run dev --workspace=@orange/customer-web
```

### 5. Run Verification Suite
```bash
npm run contracts:lint
npm run typecheck
npm run test
```

### 6. Run Android Tests & Build
```bash
cd apps/android
.\gradlew.bat testDebugUnitTest
.\gradlew.bat assembleDebug
```

