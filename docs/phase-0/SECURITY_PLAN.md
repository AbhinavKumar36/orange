# Moody Orange — System Security, Threat Model & Compliance Plan

**Document Version:** 1.1.0 (Phase 0.1 Revision)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial threat model and security specifications. |
| **1.1.0** | 2026-10-30 | Lead Architect | **Phase 0.1 Revision:**<br>• Enforced strict credential isolation: service-role keys confined strictly to `apps/backend-api`.<br>• Explicitly established that no customer or staff client holds direct privileged database access.<br>• Formalized server-controlled staff roles and privilege escalation defenses.<br>• Classified security measures (`[CONFIRMED]`, `[PROPOSED]`, `[CLIENT DECISION REQUIRED]`). |

---

## 1. Threat Modeling & STRIDE Matrix

| STRIDE Category | Threat Scenario | Impact | Mandatory Defensive Mitigation | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates a legitimate customer to collect perishable food at the counter. | Unauthorized order pickup, theft of goods. | Counter staff must verify customer collection token (PIN / QR / Order ID) and phone number. | `[CONFIRMED]` |
| **Tampering** | Customer manipulates request payload to purchase an expensive cake for ₹1.00. | Commercial financial loss. | **Zero-trust client prices.** Server recalculates all subtotals, taxes, and packaging fees from database tables. Client prices are completely discarded. | `[CONFIRMED]` |
| **Repudiation** | Staff claims cash was not collected, or customer denies receiving order. | Internal cash theft or customer dispute. | Staff must explicitly check a mandatory "Cash Received" confirmation before closing an order. Comprehensive event logging in `payments` and `audit_logs`. | `[CONFIRMED]` |
| **Information Disclosure** | Scraping customer phone numbers, names, or addresses by enumerating sequential order IDs. | Customer privacy violation, regulatory exposure. | Use non-sequential UUIDs for database IDs. Enforce PostgreSQL Row Level Security (RLS) so customers query strictly where `customer_id = auth.uid()`. | `[CONFIRMED]` |
| **Denial of Service** | Script floods OTP endpoints to exhaust SMS credits, or locks up stock without paying. | Financial drain (SMS costs), legitimate customers blocked by fake stockouts. | Strict IP and phone-number rate limiting on OTP endpoints. 10-minute reservation TTL with automated cleanup. Max 3 pending orders per customer. | `[CONFIRMED]` |
| **Elevation of Privilege** | Counter staff or customer attempts to access store financial reports or modify product prices. | Commercial tampering. | Database-enforced Role-Based Access Control (`staff_role_enum`). Admin API endpoints verify role claim before executing mutations. | `[CONFIRMED]` |

---

## 2. Authentication & Authorization Security

### 2.1 Customer Mobile Number & OTP Verification `[CONFIRMED]`
The customer authentication flow relies on Indian mobile phone numbers (+91) with 6-digit OTP delivery. To prevent financial drain and abuse:

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
 [Generate Cryptographic 6-Digit OTP]
          │
          ▼
[Dispatch SMS via Gateway with DLT Template]
```

- **OTP Expiration:** OTP is valid for exactly 5 minutes (300 seconds) `[PROPOSED]`.
- **Verification Throttling:** Maximum 5 failed verification attempts per OTP session. Upon the 5th failed attempt, the OTP is permanently invalidated `[CONFIRMED]`.
- **Test Mode Bypass:** Test phone numbers (e.g., `+91 99999 99999`) with static OTPs are restricted strictly to local and staging environments and disabled via environment configuration in production `[CONFIRMED]`.

### 2.2 Store Staff & Admin Authentication `[CONFIRMED]`
- Staff members authenticate using corporate email and high-entropy passwords (minimum 12 characters).
- Enforced Session Timeouts: Counter staff sessions auto-expire after 12 hours of inactivity to prevent unattended terminal misuse at the physical shop counter.

### 2.3 Server-Controlled Staff Roles & Privilege Escalation Defense `[CONFIRMED]`
- Staff roles (`counter_staff`, `manager`, `admin`) are stored in `public.staff_roles` in PostgreSQL.
- **Strict Lockdown:** The `public.staff_roles` table has RLS enabled with direct client mutations denied (`INSERT`, `UPDATE`, `DELETE` blocked for `authenticated` role).
- Role assignments and promotions can only be executed via the Backend API by an authenticated `admin` user.
- Customers have zero access to the `staff_roles` table. Attempts by customers to pass role claims in API headers are rejected during JWT signature validation.

---

## 3. Strict Credential Isolation & Access Boundaries

> [!CAUTION]
> **No customer, counter staff, or store manager client ever receives direct privileged database access or server secrets.**

| Credential | Scope | Where Stored / Exposed | Prohibited Locations |
| :--- | :--- | :--- | :--- |
| **Supabase Anon Key** | Public Read / Auth Init | Public Client Code (Next.js public env, Android `BuildConfig`) | Safe for public exposure (guarded by RLS) |
| **Supabase Service Role Key** | Database Superuser Access | **Standalone Backend API ONLY (`apps/backend-api/.env`)** | **STRICTLY FORBIDDEN** in Customer Web, Admin Web, Android APK, Git |
| **Razorpay Key ID** | Public Merchant ID | Client Checkout UI & Backend API | Publicly visible (safe) |
| **Razorpay Key Secret** | Financial Capture & Refunds | **Standalone Backend API ONLY (`apps/backend-api/.env`)** | **STRICTLY FORBIDDEN** in Web client bundles, Android APK, Git |
| **Razorpay Webhook Secret** | Webhook HMAC Verification | **Standalone Backend API ONLY (`apps/backend-api/.env`)** | **STRICTLY FORBIDDEN** in Web client bundles, Android APK, Git |
| **SMS Gateway API Key** | OTP Dispatch | **Standalone Backend API ONLY** (or Supabase Auth dashboard) | **STRICTLY FORBIDDEN** in Web client bundles, Android APK, Git |

---

## 4. Payment Security & Verification Protocol

### 4.1 Zero-Trust Client Callbacks `[CONFIRMED]`
Client-side callbacks from Razorpay Web Checkout or Android SDK are treated strictly as **UX cues**, NEVER as proof of payment.

```
       [Customer Device]                [Razorpay Gateway]            [Backend API (backend-api)]
              │                                  │                                │
              ├────── Initiates Payment ────────►│                                │
              │                                  ├────── Webhook Event ──────────►│
              │                                  │   (payment.captured + HMAC)    │
              │                                  │                                │
              │                                  │                     [1. Verify HMAC Signature]
              │                                  │                     [2. Check Idempotency Key]
              │                                  │                     [3. Commit Order via DB RPC]
              │                                  │                                │
  (UX Only)   │◄── Displays Success Screen ──────┤                                │
              │                                                                   │
              ├────── Polls Order Status ────────────────────────────────────────►│
              │◄───── Returns Authoritative Status ('confirmed') ─────────────────┤
```

### 4.2 Webhook Signature Verification `[CONFIRMED]`
Incoming webhooks from Razorpay must be validated against `RAZORPAY_WEBHOOK_SECRET` using HMAC-SHA256 with constant-time equality check to prevent timing attacks.

### 4.3 Idempotency & Double-Spend Protection `[CONFIRMED]`
Every payment event is recorded with a unique constraint on `provider_payment_id`. Repeated webhook deliveries match the unique constraint, return HTTP 200 OK immediately, and avoid redundant state changes or double deductions.

---

## 5. Audit Logging & Operational Accountability

### 5.1 Sensitive Admin Operations Audit `[CONFIRMED]`
The following actions must generate an append-only entry in `public.audit_logs`:
- Any manual modification to product base prices or tax rates.
- Any manual physical stock count adjustment or spoilage write-off.
- Any staff role creation, promotion, or deactivation.
- Any customer order cancellation and refund issuance.
- Any manual store emergency closure toggle.

The `public.audit_logs` table is strictly append-only. No user role, including `admin`, possesses `DELETE` or `UPDATE` permissions on audit records.

### 5.2 Database Backups & Disaster Recovery `[CONFIRMED]`
- **Automated Daily Backups:** Managed by Supabase with 7-day retention in staging and 30-day retention with Point-in-Time Recovery (PITR) in production.
- **Continuous WAL Archiving:** Enables restoration to any point in time within minutes of an incident.
