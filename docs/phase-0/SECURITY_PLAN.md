# Moody Orange — System Security, Threat Model & Compliance Plan

**Document Version:** 1.0.0  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  

---

## 1. Threat Modeling & Attack Surface Analysis

Using the **STRIDE** methodology, we identify key vulnerabilities in a quick-commerce retail platform and mandate specific defensive controls:

| STRIDE Category | Threat Scenario | Impact | Mandatory Defensive Mitigation |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates a legitimate customer to view or collect their cake/chocolates at the counter. | Unauthorized order pickup, theft of goods. | High-entropy 4-digit Collection PIN + cryptographically hashed QR code required for counter pickup. Customer identity bound to verified mobile phone via OTP. |
| **Tampering** | Malicious customer manipulates request payload to order a ₹1,200 cake for ₹1.00. | Financial loss. | **Zero-trust client prices.** Server recalculates all sub-totals, taxes, and packaging fees from database tables. Client-provided prices are completely discarded. |
| **Repudiation** | Customer claims they never authorized or collected an order; or staff claims cash was never received. | Chargeback disputes, internal cash theft. | Mandatory audit trail in `payments`, `audit_logs`, and `inventory_logs`. Staff must explicitly confirm physical cash receipt in register before completing handover. |
| **Information Disclosure** | Competitor scrapes customer phone numbers, names, or addresses by iterating sequential order IDs. | Privacy violation, regulatory breach. | Non-sequential UUIDv4/UUIDv7 primary keys. Database Row Level Security (RLS) ensures customers can only query rows where `customer_id = auth.uid()`. |
| **Denial of Service** | Bot script drains SMS credits via OTP flooding or floods checkout to lock up inventory without paying. | Financial drain (SMS costs), legitimate customers blocked by fake stockouts. | Strict IP and phone-number rate limiting on OTP endpoints. 10-minute TTL on stock reservations with automated cleanup. Maximum 3 pending orders per customer. |
| **Elevation of Privilege** | Counter staff attempts to access store profit analytics or change product prices. | Unauthorized commercial tampering. | Database-enforced Role-Based Access Control (`staff_role_enum`). Admin API endpoints verify role claim before executing mutations. |

---

## 2. Authentication Security Architecture

### 2.1 Customer Mobile Number & OTP Verification
The customer authentication flow relies on Indian mobile phone numbers (+91) with 6-digit OTP delivery. To prevent financial drain and abuse, the following controls are mandatory:

```
[Customer Submits Phone]
          │
          ▼
   [IP Rate Limit Check] ───(> 10 requests / 10 min)───► [HTTP 429 Too Many Requests]
          │
          ▼
 [Phone Cooldown Check] ───(< 60 seconds since last)───► [HTTP 429 "Wait 60s to resend"]
          │
          ▼
 [Daily Phone Quota Check] ───(> 5 OTPs / day)─────────► [HTTP 429 "Daily limit reached"]
          │
          ▼
 [Generate Cryptographic 6-Digit OTP & Hash]
          │
          ▼
[Dispatch SMS via Gateway with DLT Template]
```

- **OTP Expiration:** OTP is valid for exactly 5 minutes (300 seconds).
- **Verification Throttling:** Maximum 5 failed verification attempts per OTP session. Upon the 5th failed attempt, the OTP is permanently invalidated, and the phone number enters a 15-minute lockout.
- **Development/Test Bypass:** Test phone numbers (e.g., `+91 99999 99999`) with static OTPs are restricted strictly to `local` and `staging` environments and disabled via environment configuration in production.

### 2.2 Store Staff & Admin Authentication
- Staff members authenticate using corporate email and high-entropy passwords (minimum 12 characters, requiring uppercase, lowercase, numbers, and special characters).
- Enforced Session Timeouts: Counter staff sessions auto-expire after 12 hours of inactivity to prevent unattended terminal misuse at the physical shop counter.
- Role checks are performed at both the API layer (JWT decoding) and the Database layer (via `public.get_staff_role()` inside RLS policies).

---

## 3. Payment Security & Integrity

### 3.1 Zero-Trust Client Callbacks
Client-side callbacks from the Razorpay Web Checkout SDK or Android SDK (`onPaymentSuccess(paymentId)`) are treated strictly as **UX cues**, NEVER as authoritative proof of payment.

```
       [Customer Device]                [Razorpay Gateway]             [Moody Orange Server]
              │                                  │                                │
              ├────── Initiates Payment ────────►│                                │
              │                                  ├────── Webhook Event ──────────►│
              │                                  │   (payment.captured + HMAC)    │
              │                                  │                                │
              │                                  │                     [1. Verify HMAC Signature]
              │                                  │                     [2. Check Idempotency Key]
              │                                  │                     [3. Commit Order in DB]
              │                                  │                                │
  (UX Only)   │◄── Displays Success Screen ──────┤                                │
              │                                                                   │
              ├────── Polling / Realtime Check ──────────────────────────────────►│
              │◄───── Returns Authoritative Status ('confirmed') ─────────────────┤
```

### 3.2 Webhook Signature Verification
Every incoming Razorpay webhook must be validated against `RAZORPAY_WEBHOOK_SECRET` using HMAC-SHA256:

```typescript
// Pseudocode for Webhook Handler Security
import crypto from 'crypto';

export async function verifyRazorpaySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader, 'utf8'),
    Buffer.from(expectedSignature, 'utf8')
  );
}
```

### 3.3 Idempotency & Double-Spend Protection
- Each webhook payload contains `payload.payment.entity.id` (e.g., `pay_Hdf73kd82`).
- The server records this in the `payments` table with a `UNIQUE` constraint on `provider_payment_id`.
- If Razorpay retries webhook delivery due to network latency, subsequent requests match the unique constraint, return `200 OK` immediately, and avoid redundant state changes or double deductions.

---

## 4. Secret Management & Credential Isolation

### 4.1 Strict Credential Boundary Rules
Under NO circumstances may privileged keys be embedded in client-side code bundles:

| Credential | Scope | Where Stored / Exposed | Prohibited Locations |
| :--- | :--- | :--- | :--- |
| **Supabase Anon Key** | Public Read / Auth Init | Public Client Code (Next.js public env, Android `BuildConfig`) | Safe for public exposure (guarded by RLS) |
| **Supabase Service Role Key** | Full DB Superuser Access | **Server Runtime ONLY** (Next.js server env, secure container) | **STRICTLY FORBIDDEN** in Web client bundles, Android APK, Git |
| **Razorpay Key ID** | Public Merchant Identifier | Client Checkout UI & Server | Publicly visible (safe) |
| **Razorpay Key Secret** | Financial Capture & Refund | **Server Runtime ONLY** | **STRICTLY FORBIDDEN** in Web client bundles, Android APK, Git |
| **Razorpay Webhook Secret** | Webhook HMAC Verification | **Server Runtime ONLY** | **STRICTLY FORBIDDEN** in Web client bundles, Android APK, Git |
| **SMS Gateway API Key** | OTP Dispatch | **Server Runtime ONLY** (or Supabase Auth provider dashboard) | **STRICTLY FORBIDDEN** in Web client bundles, Android APK, Git |

### 4.2 Native Android App Hardening
- **Android Keystore:** User authentication tokens (JWT and refresh tokens) are encrypted using keys generated inside the hardware-backed Android Keystore system.
- **R8 / ProGuard Obfuscation:** Release builds must enable code shrinking, obfuscation, and optimization to hinder reverse-engineering.
- **Root Detection / Safety:** Basic integrity checks to prevent running administrative counter functions on compromised or rooted devices.

---

## 5. Network & Operational Security

### 5.1 Content Security Policy (CSP) & Web Headers
All web interfaces (Customer & Admin) must serve hardened HTTP headers:
- `Content-Security-Policy`: Restricts script execution to self, Razorpay checkout domains (`checkout.razorpay.com`), and Supabase API origins.
- `Strict-Transport-Security`: Enforces TLS 1.3 with `max-age=31536000; includeSubDomains`.
- `X-Frame-Options: DENY`: Prevents clickjacking attacks.
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.

### 5.2 API Rate Limiting
- Public Endpoints (`/api/v1/catalog/*`): 120 requests / minute / IP.
- Auth Endpoints (`/api/v1/auth/otp/*`): 5 requests / 10 minutes / IP & Phone.
- Checkout Endpoints (`/api/v1/orders/checkout`): 10 requests / minute / Customer ID.

### 5.3 Audit Logging for Sensitive Admin Operations
Any manual change to product base prices, manual inventory adjustments, or cancellation of confirmed orders must trigger an insert into `public.audit_logs`:
- Captures: `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `old_values` (JSONB), `new_values` (JSONB), `ip_address`, and UTC timestamp.
- Audit logs are append-only. No user, including `admin` role, has `DELETE` permissions on `public.audit_logs`.

### 5.4 Database Backups & Disaster Recovery
- **Daily Automated Backups:** Maintained by Supabase managed service with 7-day retention for development/staging, and 30-day retention with Point-in-Time Recovery (PITR) for production.
- **RTO (Recovery Time Objective):** < 1 hour in case of catastrophic instance failure.
- **RPO (Recovery Point Objective):** < 5 minutes using continuous Write-Ahead Log (WAL) archiving.
