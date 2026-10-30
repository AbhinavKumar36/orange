# Moody Orange — Development Guidelines, Environment & Repository Standards

**Document Version:** 1.3.0 (Phase 0.3 Final Consistency Pass)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial development guidelines and repository conventions. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Decoupled `apps/backend-api` and corrected repository URL. |
| **1.2.0** | 2026-10-30 | Lead Architect | Phase 0.2 Revision: Standardized OpenAPI contracts and cross-platform contract parity. |
| **1.3.0** | 2026-10-30 | Lead Architect | **Phase 0.3 Final Consistency Pass:**<br>• Formalized customer-scoped checkout idempotency (`customer_id + key`) with payload hash verification in API contracts.<br>• Specified input validation contracts: duplicate aggregation, positive integer quantities, non-empty carts.<br>• Defined Cash-at-Pickup `unpaid` payment state and evidence-based refund progression in API responses.<br>• Reaffirmed strict Phase 0 documentation-only boundaries. |

---

## 1. Repository Structure & Workspace Topology

> [!IMPORTANT]
> **Phase 0 Scope Constraint:** The directories and packages below represent the authoritative target architecture for subsequent implementation phases. **Do not create these application directories or application code during Phase 0.** Phase 0 is strictly documentation and architecture planning.

```
moody-orange/
├── .github/
│   └── workflows/
│       ├── ci-backend.yml           # Lint, test & typecheck Backend API
│       ├── ci-web.yml               # Lint, test & typecheck Customer & Admin Web
│       ├── ci-android.yml           # Gradle unit tests & lint for Android
│       └── db-tests.yml             # pgTAP schema & RLS test execution
├── apps/
│   ├── backend-api/                 # Standalone Authoritative REST API (Node.js/TS)
│   │   ├── src/
│   │   │   ├── modules/             # Modular domains (catalog, orders, payments, staff)
│   │   │   ├── middleware/          # JWT auth, role authorization, rate limiting
│   │   │   └── server.ts            # Fastify / Express server entrypoint
│   │   ├── package.json
│   │   └── .env.example
│   ├── customer-web/                # Customer Storefront (Next.js App Router, TS)
│   │   ├── src/
│   │   │   ├── app/                 # Next.js App Router pages (/catalog, /cart, /orders)
│   │   │   └── components/          # React components
│   │   ├── package.json
│   │   └── .env.example
│   ├── admin-web/                   # Store Counter & Admin Dashboard (Next.js, TS)
│   │   ├── src/
│   │   │   ├── app/                 # Admin routes (/live-queue, /inventory, /reports)
│   │   │   └── components/          # Dispatch Kanban board, PIN/QR modal
│   │   ├── package.json
│   │   └── .env.example
│   └── android/                     # 100% Native Kotlin Android Application
│       ├── app/
│       │   ├── src/main/java/com/moodyorange/app/
│       │   │   ├── data/            # Retrofit API clients, Room DB
│       │   │   ├── domain/          # Kotlin use cases & domain models
│       │   │   └── ui/              # Jetpack Compose screens, ViewModels
│       │   └── build.gradle.kts
│       ├── settings.gradle.kts
│       └── local.properties.example
├── packages/
│   ├── api-contracts/               # Authoritative REST schemas (OpenAPI / JSON Schema)
│   │   ├── schemas/                 # Language-agnostic JSON Schema definitions
│   │   ├── src/                     # TypeScript Zod schemas generated for Web & Backend
│   │   └── package.json
│   ├── ui-tokens/                   # Shared CSS variables, color tokens & tailwind preset
│   └── tsconfig/                    # Shared TypeScript base configurations
├── supabase/
│   ├── migrations/                  # Sequential SQL migration files
│   ├── tests/                       # pgTAP database test suites
│   ├── seed.sql                     # Development seed data
│   └── config.toml                  # Supabase local CLI configuration
├── docs/
│   └── phase-0/                     # Authoritative Phase 0 architectural documentation
├── turbo.json                       # Turborepo task pipeline configuration
├── package.json                     # Monorepo root configuration
└── README.md                        # Project onboarding guide
```

---

## 2. Authoritative API Contracts & Conventions

To ensure the Customer Web, Admin Web, and Native Android App consume identical backend contracts without cross-language TypeScript-to-Kotlin illusions:

```
                      +────────────────────────────────────────+
                      |   AUTHORITATIVE API CONTRACT           |
                      |   packages/api-contracts/schemas/      |
                      |   (JSON Schema / OpenAPI 3.1 Spec)     |
                      +────────────────────────────────────────+
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                           ▼
+─────────────────────────────────+         +─────────────────────────────────+
|   TYPESCRIPT ECOSYSTEM          |         |   KOTLIN / ANDROID ECOSYSTEM    |
|   (Backend API, Web Frontends)  |         |   (Native Android App)          |
|                                 |         |                                 |
| • Evaluated via Zod schemas.    |         | • Kotlin `data class` models.   |
| • TypeScript types inferred     |         | • Serialized with               |
|   from Zod (`z.infer<T>`).      |         |   `kotlinx.serialization`.      |
| • Shared via local npm package. |         | • Authoritatively mirrored      |
|                                 |         |   from API JSON contracts.      |
+─────────────────────────────────+         +─────────────────────────────────+
```

> [!WARNING]
> **No Direct Cross-Language Code Sharing:** TypeScript packages (`packages/api-contracts`) **cannot** be imported directly by the Android Gradle build. Android models are native Kotlin data classes that implement the exact field names, types, and validation rules specified in the API JSON schemas.

### 2.1 API Conventions & Architectural Standards
- **Versioning:** All REST API routes are versioned under `/api/v1/*`.
- **Authentication:** Protected routes require a valid Supabase JWT passed via the `Authorization: Bearer <token>` header.
- **Authorization:** Customer routes extract identity strictly from `jwt.sub`. Staff routes verify the caller's role against server-controlled `staff_roles` records.
- **Customer-Scoped Idempotency:** State-mutating operations (checkout, refunds) accept an `X-Idempotency-Key: <UUID>` header. The Backend API scopes the key to `(jwt.sub, idempotency_key)` and computes a SHA-256 payload hash (`client_payload_hash`):
  - Retried requests with identical key and matching payload return the original draft order.
  - Reusing a key with a mismatched payload returns `HTTP 409 Conflict`.
- **Pagination Convention:** List endpoints accept `limit` (default: 20, max: 100) and `cursor` (opaque base64 cursor), returning:
  ```json
  {
    "data": [...],
    "pagination": {
      "has_more": true,
      "next_cursor": "eyJpZCI6...==",
      "total_count": 42
    }
  }
  ```

### 2.2 Standardized API Error Response Convention
All endpoints under `/api/v1/*` must adhere to a uniform error structure:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "The requested item 'Valencia Orange Juice' only has 1 unit remaining.",
    "details": {
      "product_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "available_quantity": 1
    },
    "timestamp": "2026-10-30T19:15:00Z"
  }
}
```

Standard HTTP Status Codes:
- `400 Bad Request`: Malformed syntax, empty cart, non-positive quantity, or missing required headers.
- `401 Unauthorized`: Missing or invalid Supabase JWT.
- `403 Forbidden`: Authenticated user lacks required role or attempts to access another customer's resource.
- `404 Not Found`: Resource does not exist.
- `409 Conflict`: Concurrency conflict, inventory reservation failure, or idempotency key payload mismatch.
- `422 Unprocessable Entity`: Business validation failed (e.g., cumulative refund exceeds captured amount).
- `429 Too Many Requests`: Rate limit exceeded (OTP cooldown or request flood).
- `500 Internal Server Error`: Unhandled server exception.

---

## 3. Environment Variables & Secret Configuration

> [!CAUTION]
> Never commit actual production secrets, private keys, or passwords to Git. All environments must commit `.env.example` templates with sanitized placeholders.

### 3.1 Standalone Backend API (`apps/backend-api/.env.example`)
Holds privileged server secrets. NEVER exposed to client browsers or mobile builds:

```bash
# Server Port & Host
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=http://localhost:54321
# Privileged Service Role Key - Authoritative DB Access (NEVER expose to clients)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_service_role_key

# Razorpay Privileged Configuration
RAZORPAY_KEY_ID=rzp_test_exampleKeyId1234
RAZORPAY_KEY_SECRET=exampleSecretKeyString1234567890
RAZORPAY_WEBHOOK_SECRET=whsec_exampleWebhookSecretString9876543210

# CORS Allowed Origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 3.2 Customer Web (`apps/customer-web/.env.example`)
Contains ONLY public, client-safe variables:

```bash
# Public Supabase Client (Protected by RLS)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_anon_key

# Authoritative Backend API Base URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1

# Razorpay Public Merchant ID
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_exampleKeyId1234

NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 3.3 Admin Web (`apps/admin-web/.env.example`)
Contains ONLY public variables and the admin API bridge:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_anon_key
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_ADMIN_APP_URL=http://localhost:3001
NODE_ENV=development
```

### 3.4 Android Native Application (`apps/android/local.properties.example`)

```properties
sdk.dir=/Users/username/Library/Android/sdk

# Backend API Endpoint (10.0.2.2 maps to host machine in Android Emulator)
API_BASE_URL=http://10.0.2.2:4000/api/v1/

# Supabase Public Keys
SUPABASE_URL=http://10.0.2.2:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_anon_key

# Razorpay Public Merchant ID (Secret key is NEVER present in Android)
RAZORPAY_KEY_ID=rzp_test_exampleKeyId1234
```

---

## 4. Git Workflow & Repository Conventions

### 4.1 Correct Repository URL
The official repository is:
**`https://github.com/AbhinavKumar36/orange`**

Clone command:
```bash
git clone https://github.com/AbhinavKumar36/orange.git
cd orange
```

### 4.2 Branching Model
- `main`: Production-ready code.
- `develop`: Primary integration and staging branch.
- `feat/<scope>-<description>`: Feature branches (e.g., `feat/backend-stock-reservation`).
- `fix/<scope>-<description>`: Bug fixes (e.g., `fix/webhook-signature-parsing`).
- `docs/<scope>-<description>`: Documentation changes (e.g., `docs/phase-0-3-database-security`).

### 4.3 Commit Standards (Conventional Commits)
All commit messages must adhere to: `<type>(<scope>): <subject>`  
*Examples:*
- `feat(api): scaffold standalone backend modular monolith`
- `fix(inventory): enforce physical_stock and deterministic row locks`
- `docs(phase-0): finalize Phase 0.3 database and security consistency pass`

---

## 5. Local Development Setup (For Future Implementation Phases)

```bash
# 1. Clone repository
git clone https://github.com/AbhinavKumar36/orange.git
cd orange

# 2. Install monorepo dependencies
npm install

# 3. Start local Supabase instance (Docker must be running)
supabase start

# 4. Apply database migrations and seeds
supabase db reset

# 5. Populate local environment files from templates
cp apps/backend-api/.env.example apps/backend-api/.env
cp apps/customer-web/.env.example apps/customer-web/.env.local
cp apps/admin-web/.env.example apps/admin-web/.env.local
cp apps/android/local.properties.example apps/android/local.properties

# 6. Start Web and Backend Services
npm run dev
# Backend API:    http://localhost:4000
# Customer Web:   http://localhost:3000
# Admin Web:      http://localhost:3001
# Supabase Studio:http://localhost:54323
```
