# Moody Orange — Development Guidelines, Environment & Repository Standards

**Document Version:** 1.0.0  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target System:** Moody Orange Unified Ordering Platform  

---

## 1. Repository Structure & Workspace Topology

To ensure seamless coordination between the Customer Web, Admin Web, Android Native Application, and the Shared Supabase Backend, Moody Orange adopts a **Turborepo Monorepo** layout.

```
moody-orange/
├── .github/
│   └── workflows/
│       ├── ci-web.yml               # Lint, typecheck & test web apps
│       ├── ci-android.yml           # Gradle unit tests & lint for Android
│       └── db-tests.yml             # pgTAP schema & RLS test execution
├── apps/
│   ├── customer-web/                # Customer Storefront (Next.js App Router, TS)
│   │   ├── src/
│   │   │   ├── app/                 # Next.js App Router routes & /api/v1/
│   │   │   ├── components/          # React components (Cart, Catalog, Tracking)
│   │   │   ├── hooks/               # Custom React hooks (useCart, useRealtimeOrder)
│   │   │   └── lib/                 # Supabase client, Razorpay client utilities
│   │   ├── public/                  # Static assets & brand media
│   │   ├── package.json
│   │   └── .env.example
│   ├── admin-web/                   # Store Counter & Admin Dashboard (Next.js, TS)
│   │   ├── src/
│   │   │   ├── app/                 # Admin dashboard routes (/live-queue, /inventory)
│   │   │   ├── components/          # Kanban board, audio alert, QR/PIN modal
│   │   │   └── lib/                 # Admin Supabase client with RBAC checks
│   │   ├── package.json
│   │   └── .env.example
│   └── android/                     # 100% Native Kotlin Android Application
│       ├── app/
│       │   ├── src/
│       │   │   ├── main/
│       │   │   │   ├── java/com/moodyorange/app/
│       │   │   │   │   ├── data/    # Repositories, Room DB, Retrofit API
│       │   │   │   │   ├── domain/  # Use cases, domain models
│       │   │   │   │   └── ui/      # Jetpack Compose screens, ViewModels, Theme
│       │   │   │   └── AndroidManifest.xml
│       │   │   └── test/            # JUnit 5 & MockK unit tests
│       │   ├── build.gradle.kts
│       │   └── proguard-rules.pro
│       ├── build.gradle.kts
│       ├── settings.gradle.kts
│       └── local.properties.example
├── packages/
│   ├── shared-types/                # Shared TypeScript DTOs, Zod schemas & types
│   │   ├── src/
│   │   │   ├── order.ts
│   │   │   ├── catalog.ts
│   │   │   └── payment.ts
│   │   └── package.json
│   ├── ui-tokens/                   # Shared CSS variables, color tokens & tailwind preset
│   └── tsconfig/                    # Shared TypeScript configurations
├── supabase/
│   ├── migrations/                  # Sequential SQL migration files
│   │   ├── 20261030000001_initial_schema.sql
│   │   ├── 20261030000002_rls_policies.sql
│   │   └── 20261030000003_stored_procedures.sql
│   ├── tests/                       # pgTAP database test suites
│   ├── seed.sql                     # Development seed data (Categories, Sample Cakes)
│   └── config.toml                  # Supabase CLI local configuration
├── docs/
│   └── phase-0/                     # Authoritative Phase 0 architectural documentation
├── turbo.json                       # Turborepo task pipeline configuration
├── package.json                     # Monorepo root package.json
└── README.md                        # Project onboarding guide
```

---

## 2. Environment Variables & Secret Configuration

> [!CAUTION]
> Never commit actual secret keys, passwords, or production credentials to Git. All repositories must strictly commit `.env.example` templates with sanitized placeholders.

### 2.1 Customer Web (`apps/customer-web/.env.example`)

```bash
# ==============================================================================
# Moody Orange — Customer Web Environment Configuration Template
# ==============================================================================

# Supabase Public Configuration (Safe for client exposure)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_anon_key

# Supabase Privileged Configuration (Server Runtime ONLY - NEVER leak to browser)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_service_role_key

# Razorpay Configuration
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_exampleKeyId1234
RAZORPAY_KEY_SECRET=exampleSecretKeyString1234567890
RAZORPAY_WEBHOOK_SECRET=whsec_exampleWebhookSecretString9876543210

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000/api/v1

# Node Environment
NODE_ENV=development
```

---

### 2.2 Admin Web (`apps/admin-web/.env.example`)

```bash
# ==============================================================================
# Moody Orange — Store Admin Web Environment Configuration Template
# ==============================================================================

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_anon_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_service_role_key

# Application URLs
NEXT_PUBLIC_ADMIN_APP_URL=http://localhost:3001
NEXT_PUBLIC_CUSTOMER_API_URL=http://localhost:3000/api/v1

# Node Environment
NODE_ENV=development
```

---

### 2.3 Android Native Application (`apps/android/local.properties.example`)

In Android, credentials and endpoints are injected at build time via `local.properties` and exposed securely via `BuildConfig`:

```properties
## ==============================================================================
## Moody Orange — Android Local Properties Template
## ==============================================================================

# Android SDK Path
sdk.dir=/Users/username/Library/Android/sdk

# Backend API Base URL (10.0.2.2 maps to host localhost on standard Android Emulator)
API_BASE_URL=http://10.0.2.2:3000/api/v1/

# Supabase Public Keys (Read-only / Auth Client)
SUPABASE_URL=http://10.0.2.2:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_anon_key

# Razorpay Client ID (Public Merchant ID only; Key Secret is NEVER in Android)
RAZORPAY_KEY_ID=rzp_test_exampleKeyId1234
```

---

## 3. Git Workflow & Branching Conventions

### 3.1 Branching Strategy
We adhere to a Trunk-Based Development variant with feature branches and protected integration branches:

- `main`: Production-ready code. Directly deployed to production environments upon tag release.
- `develop`: Primary staging and integration branch.
- `feat/<scope>-<description>`: Feature work (e.g., `feat/cart-stock-reservation`, `feat/android-otp-login`).
- `fix/<scope>-<description>`: Bug fixes (e.g., `fix/webhook-signature-padding`).
- `docs/<scope>-<description>`: Documentation changes (e.g., `docs/phase-0-requirements`).
- `chore/<scope>-<description>`: Tooling, dependencies, or CI updates.

### 3.2 Commit Message Standards (Conventional Commits)
All commit messages must follow the standard: `<type>(<scope>): <subject>`

*Examples:*
- `feat(order): implement rpc_reserve_order_stock stored procedure`
- `fix(payment): prevent duplicate webhook processing with unique payment id`
- `docs(phase-0): add database schema and security threat model`
- `test(inventory): add concurrency test for zero overselling`

### 3.3 Pull Request (PR) Requirements
1. **Branch Protection:** No direct pushes to `main` or `develop`.
2. **Automated CI Checks:** Every PR must pass:
   - TypeScript compilation (`tsc --noEmit`).
   - Linting (`eslint .` and `ktlint`).
   - Unit tests (`vitest run` and `./gradlew testDebugUnitTest`).
   - Database migration and `pgTAP` RLS test execution.
3. **Peer Review:** Minimum 1 approving review from a senior architect or technical lead.

---

## 4. Local Development Environment Setup

### 4.1 Prerequisites
- **Node.js:** v20.x LTS or higher
- **Package Manager:** `pnpm` (recommended for Turborepo) or `npm` (v10+)
- **Docker Desktop:** Running (required for Supabase CLI local database)
- **Supabase CLI:** Installed (`npm install -g supabase` or `brew install supabase/tap/supabase`)
- **Android Development:**
  - Android Studio (Ladybug 2024.2+ or Koala)
  - JDK 17 (OpenJDK 17)
  - Android SDK (API 26 minimum, API 34 target)

### 4.2 Initial Setup Commands
```bash
# 1. Clone repository
git clone https://github.com/moodyorange/moody-orange.git
cd moody-orange

# 2. Install workspace dependencies
npm install

# 3. Start local Supabase instance (Postgres, Auth, Storage, Realtime)
supabase start

# 4. Apply database migrations and seeds
supabase db reset

# 5. Populate local environment files
cp apps/customer-web/.env.example apps/customer-web/.env.local
cp apps/admin-web/.env.example apps/admin-web/.env.local
cp apps/android/local.properties.example apps/android/local.properties

# 6. Start Web Applications in Development Mode
npm run dev
# Customer Web accessible at: http://localhost:3000
# Admin Web accessible at:    http://localhost:3001
# Supabase Studio:            http://localhost:54323
```

### 4.3 Android Studio Setup
1. Launch Android Studio and open directory `apps/android`.
2. Ensure Gradle JDK is configured to JDK 17 (`Settings -> Build, Execution, Deployment -> Build Tools -> Gradle`).
3. Sync Gradle project with files.
4. Launch Android Emulator (Pixel 8 recommended with API 34).
5. Verify emulator network connectivity to host local API via `http://10.0.2.2:3000/api/v1/health`.

---

## 5. Coding & Architecture Standards

### 5.1 TypeScript & Next.js Standards
- **Strict Mode:** `strict: true`, `noImplicitAny: true`, and `strictNullChecks: true` are enforced across all `tsconfig.json` files.
- **Runtime Validation:** All external inputs (REST payloads, query parameters, webhook bodies) must be validated via **Zod schemas** before entering business logic functions.
- **Server Component First:** Favor React Server Components (RSC) for data-fetching pages. Use `'use client'` only on interactive leaf components (e.g., Cart drawer, PIN input pad).

### 5.2 Kotlin & Jetpack Compose Standards
- **Clean Architecture:** Strict boundary separation: UI (Compose + ViewModels) -> Domain (UseCases) -> Data (Repositories).
- **Coroutines & Reactive State:** Expose immutable `StateFlow` from ViewModels to Compose screens. Never expose mutable `MutableStateFlow` outside the ViewModel.
- **Compose Best Practices:**
  - Mark immutable UI state models with `@Immutable` or `@Stable`.
  - Pass lambda callbacks rather than passing ViewModels directly into reusable leaf Composables.
  - Avoid heavy computations inside the composition phase; hoist state appropriately.

---

## 6. Implementation Status & Verification Tracking Conventions

To ensure absolute transparency between the engineering team and stakeholders, all documentation, PR descriptions, and milestone reports must strictly distinguish work status:

| Status Badge | Formal Definition | Permissible Usage |
| :--- | :--- | :--- |
| **`[CODE WRITTEN]`** | Source code or configuration has been committed to a branch. | Files exist in repo; does not imply functionality works. |
| **`[CODE INSPECTED]`** | Code has been reviewed by a peer or senior architect for security and standards compliance. | Static analysis and manual code review passed. |
| **`[TESTS PASSED]`** | Automated unit, integration, or database test suites have executed and passed in CI. | Explicit green test run with recorded test log. |
| **`[MANUALLY VERIFIED]`** | The feature has been executed by a human engineer on an emulator, device, or browser, and observed to behave as specified. | Documented with steps and screen recording/logs. |
| **`[UNVERIFIED]`** | Code or feature exists in whole or in part, but has NOT undergone full automated or manual validation. | Must remain tagged as unverified until proof exists. |

> [!IMPORTANT]
> In Phase 0, **ZERO** application code has been written. All functional components remain in the planning and specification stage.
