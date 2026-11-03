# Moody Orange

> Boutique quick-commerce ordering platform for artisanal cakes, fresh cold-pressed juices, and gourmet chocolates with in-store counter pickup.

---

## 📌 Project Overview

**Moody Orange** is a specialized retail platform supporting online ordering with physical counter collection (Click & Collect).
The system encompasses three client interfaces powered by a single, authoritative, independently deployable backend service:
- **Customer Website:** Built with Next.js & TypeScript (`apps/customer-web` — responsive for mobile, tablet, desktop)
- **Native Android App:** Built with Kotlin & Jetpack Compose (`apps/android` — 100% native, no web wrappers)
- **Admin & Counter Portal:** Built with Next.js & TypeScript (`apps/admin-web` — live Kanban dispatch queue, audio alerts, collection verification)
- **Authoritative Backend API:** Standalone modular monolith in Node.js/Fastify/TypeScript (`apps/backend-api` — versioned REST API `/api/v1/...`, inventory transaction engine, Razorpay checkout, webhook verification, and refund automation)
- **Managed Data Layer:** Supabase PostgreSQL 15+ with Row Level Security, Storage CDN, and Realtime WebSockets
- **API Contracts:** Authoritative OpenAPI 3.1 specification (`packages/api-contracts` — linted via Redocly)

---

## 🚀 Development & Testing Setup (Online-Only Workflow)

### 1. Development Environment Principles
Moody Orange follows a strictly **online-managed development workflow** backed by hosted Supabase projects:
- **No Local Database Requirement**: Developers do **not** run `supabase start`, do not require local PostgreSQL, and do not need Docker Desktop.
- **Hosted Supabase Project**: All database tables, check constraints, row-level security (RLS) policies, and stored procedures operate on hosted Supabase instances.
- **Hermetic Unit & Integration Tests**: All unit tests, contract linting, typechecking, and build validation execute completely without requiring local database daemons.
- **Environment Isolation**: Development, Staging, and Production environments remain strictly decoupled through isolated environment variables and credentials.

### 2. Prerequisites
- **Node.js**: `v20.x` or newer (`v24.x` verified)
- **Package Manager**: `npm` `10.x` or newer
- **Android Studio & JDK 17**: Required for building `apps/android` (Android SDK 35, minSdk 26)
- **Hosted Supabase Account / Projects**: Remote project instances for Development, Staging, and Production.

### 3. Dependency Installation
From the repository root, install dependencies cleanly:
```bash
# Clean install using committed package-lock.json
npm ci

# Alternatively:
npm install
```

### 4. Environment Configuration Architecture

Environment variables must be kept in local untracked files or GitHub Actions secrets. Never commit secrets to Git.

| Environment | Purpose | Supabase Project Target | Backend API Endpoint |
| :--- | :--- | :--- | :--- |
| **Development** | Feature development & local debugging | Hosted Dev Supabase Project (`DEV_SUPABASE_URL` / `SUPABASE_URL`) | `http://localhost:4000/api/v1` |
| **Staging** | Automated QA & pre-release validation | Dedicated Hosted Staging Supabase Project (`STAGING_SUPABASE_URL`) | `https://staging-api.moodyorange.com/api/v1` |
| **Production** | Live transactional storefront | Authoritative Live Production Supabase Project (`PROD_SUPABASE_URL`) | `https://api.moodyorange.com/api/v1` |

Copy the template configuration files to get started:
```bash
# Backend API (.env)
cp apps/backend-api/.env.example apps/backend-api/.env

# Customer Web (.env.local)
cp apps/customer-web/.env.example apps/customer-web/.env.local

# Admin Web (.env.local)
cp apps/admin-web/.env.example apps/admin-web/.env.local

# Android Application (local.properties)
cp apps/android/local.properties.example apps/android/local.properties
```

> [!IMPORTANT]
> - In `NODE_ENV=development`, local development allows mock fallbacks when `ALLOW_MOCK_SERVICES=true` is set.
> - In `NODE_ENV=production`, valid, non-placeholder `SUPABASE_SERVICE_ROLE_KEY` and HTTPS URLs are strictly required.
> - Never place a Supabase `service_role` key in `apps/customer-web`, `apps/admin-web`, or `apps/android`.

### 5. Running the Applications
```bash
# Start all web and backend services in parallel via Turborepo
npm run dev

# Or start individual services:
npm run dev:backend     # Backend API on http://localhost:4000
npm run dev:customer    # Customer Web on http://localhost:3000
npm run dev:admin       # Admin Web on http://localhost:3001
```

Health check verification:
```bash
curl http://localhost:4000/health
# Response: {"status":"ok"}

curl http://localhost:4000/api/v1/health
# Response: {"status":"ok"}
```

---

## 🗄️ Hosted Supabase & Remote Database Workflow

### 1. Remote Migration Workflow
All database schema changes, check constraints, RLS policies, and stored procedures are version-controlled in `supabase/migrations/`:
- `20261031180000_core_schema.sql` — Authoritative 10 tables, check constraints, foreign keys, and availability view.
- `20261031180100_row_level_security.sql` — Comprehensive RLS policies and table grants.
- `20261031180200_inventory_and_order_procedures.sql` — Security definer procedures with search_path hardening.
- `20261102180000_enforce_checkout_idempotency.sql` — Customer-scoped checkout idempotency enforcement.
- `20261102190000_inventory_concurrency_procedures.sql` — Strict inventory reservation validation, row-level locking, and atomic handover.

To deploy migrations to a hosted development or staging Supabase project:
```bash
# Apply pending migrations to the hosted target database using direct connection:
npx supabase db push --db-url "$SUPABASE_DB_URL"

# Or execute via the Supabase Dashboard SQL Editor for the target project.
```

> [!CAUTION]
> - Never execute `supabase db reset`, `DROP SCHEMA`, or truncate commands against hosted databases.
> - Destructive migrations are strictly prohibited. Always preserve existing data.

### 2. Safe Hosted Database Testing (pgTAP) & Real Concurrency Testing
Database integrity tests are defined in `supabase/tests/database/database.test.sql` (76 assertions).
- All tests execute inside an isolated transaction (`BEGIN ... ROLLBACK`) so existing data is preserved and zero side-effects persist.
- **Dedicated Test Environment**: Run pgTAP tests against a dedicated hosted development or staging Supabase project using `pg_prove`:
  ```bash
  pg_prove --dbname "$TEST_SUPABASE_DB_URL" supabase/tests/database/database.test.sql
  ```
- **Real Multi-Session PostgreSQL Concurrency Tests**:
  Real database concurrency tests execute separate simultaneous database sessions (`pg.Client`) to test row-level locking, race conditions, and atomic rollbacks:
  ```bash
  npm run test:db:concurrency
  # Or:
  node scripts/test-database-concurrency.mjs
  ```
- **Safeguard against Production Pollution**: If a separate hosted test connection string (`TEST_SUPABASE_DB_URL`) is not configured in the test runner environment, both pgTAP and concurrency test suites safely report the missing remote configuration as **BLOCKED** rather than silently executing against production. Connection strings referencing production (`prod`, `production`, `live`) are strictly rejected.

### 3. Inventory Reservation Invariants & Strict Handover Validation
The stored procedure `public.rpc_complete_order_handover` enforces strict stock validation:
1. **Row-Level Order Lock**: Acquires `FOR UPDATE` on `public.orders` to prevent concurrent duplicate handovers.
2. **Staff Authorization**: Validates active staff role (`counter_staff`, `manager`, `admin`).
3. **Status Check**: Verifies linear state (`ready_for_pickup` only); already completed orders are rejected.
4. **Deterministic Inventory Locking**: Locks all relevant `inventory` rows in ascending `product_id` order to prevent deadlocks under concurrency.
5. **Strict Pre-Validation (No Silent Clamping)**:
   - Verifies each order item has an existing inventory record (`MISSING_INVENTORY_ROW`).
   - Verifies physical stock is sufficient (`INSUFFICIENT_PHYSICAL_STOCK`).
   - Verifies reserved stock is at least the ordered quantity (`INSUFFICIENT_RESERVED_STOCK`).
   - **Rejects entire operation** and rolls back immediately if any item fails validation.
6. **Atomic Modification**: Decrements `physical_stock = physical_stock - total_quantity` and `reserved_stock = reserved_stock - total_quantity` with strict non-negative invariants.

---

## 🔐 Authentication, Authorization & Production Asset Hygiene

### 1. Staff Authentication & Server-Enforced RBAC
- Staff authenticate via Supabase Auth email/password credentials.
- After receiving a Supabase access token, client applications query `/api/v1/admin/me`. The backend authoritatively queries `public.staff_roles` to verify:
  - User exists in `public.staff_roles`.
  - `is_active` is `true`.
  - Role is one of `counter_staff`, `manager`, or `admin`.
- **Customer Segregation**: Authenticated customers who do not possess an active staff role are immediately rejected (`403 FORBIDDEN_NOT_STAFF`).
- **Backend Authorization Enforcement**: Privileged operations (inventory write-offs, stock adjustments, order cancellations) require verified `manager` or `admin` roles on the server. Frontend role checks are purely for UI ergonomics and are never relied upon for security.

### 2. Production Asset & Bundle Hygiene
- **Zero Demo Credentials in Production**: Quick-login buttons, demo credentials (`password123`), and seeded email addresses are strictly compiled out of production bundles via compile-time dead-code elimination (`process.env.NODE_ENV === 'development'`).
- **Client Bundle Scanning**: Automated tests inspect both the server-rendered HTML and generated production JavaScript assets (`.next/static/**/*.js`) to verify that no demo credentials or quick-login code exist in client artifacts.

### 3. Safe Online Staff Provisioning Utility
The script `scripts/provision-admin.mjs` manages staff role assignments without manual database tampering:
- **Explicit Target Environment**: Requires `--env <development|staging|production>`.
- **Production Safeguards**: Targeting production strictly requires `--confirm-production` and `PROD_SUPABASE_URL`.
- **Credential Protection**: Never prints passwords, access tokens, or service-role keys to terminal output.
- **SQL Fallback**: When direct service-role API credentials are not detected in the environment, it outputs a safe, transactional, idempotent SQL block (`BEGIN ... COMMIT`) for execution in the Supabase Dashboard SQL Editor by an authorized database administrator.

```bash
# Provisioning examples:
node scripts/provision-admin.mjs --env development --email staff@company.com --role counter_staff
node scripts/provision-admin.mjs --env staging --email manager@staging.moodyorange.com --role manager
node scripts/provision-admin.mjs --env production --email authorized-admin@company.com --role admin --confirm-production
```

---

## 📱 Native Android Application (`apps/android`)

### 1. Target Device Networking Setup
- **Supabase Authentication & Data**: Always connects directly to the remote hosted Supabase project via HTTPS (`DEV_SUPABASE_URL` in debug, `PROD_SUPABASE_URL` in release). Local Supabase ports (54321) are strictly prohibited.
- **Backend API Networking (When Running API Server Locally)**:
  - **Android Emulator**: Uses `API_BASE_URL=http://10.0.2.2:4000/api/v1/`.
  - **Physical Device via USB Reverse Tethering**: Run `npm run adb:reverse` (`adb reverse tcp:4000 tcp:4000`). The client connects to `http://127.0.0.1:4000/api/v1/`.
  - **Physical Device over Local Wi-Fi**: Set `DEV_LAN_IP=<YOUR_PC_LAN_IP>` or `API_BASE_URL` in `apps/android/local.properties`.

### 2. Production Release Configuration (Fail-Closed)
Release builds (`assembleRelease`, `bundleRelease`, `packageRelease`) enforce strict compile-time and runtime validation:
- Requires explicit `PROD_API_BASE_URL`, `PROD_SUPABASE_URL`, and `PROD_SUPABASE_ANON_KEY`.
- Rejects non-HTTPS URLs, local development hostnames (`localhost`, `127.0.0.1`, `10.0.2.2`), `.local` domains, and private RFC-1918 LAN IPs.
- **Strict Service-Role Key Prohibition**: Supabase `service_role` keys bypass Row Level Security and must **never** be included in the Android application. Both Gradle and runtime `AuthManager` validate JWT payloads and immediately abort if a `service_role` key is detected.

To validate configurations without building an APK:
```bash
cd apps/android
./gradlew validateDevConfig       # Validates hosted dev configuration
./gradlew validateReleaseConfig   # Validates production release configuration
```

---

## ✅ Phase 6 Quality & Verification Results

All available project checks and validation suites have been independently executed:

| Verification Suite | Target / Command | Result | Notes |
| :--- | :--- | :---: | :--- |
| **API Contracts Linting** | `npm run contracts:lint` | **PASS** | OpenAPI 3.1 specification validated via Redocly (zero duplicate keys or schema errors). |
| **Workspace Linting** | `npm run lint` | **PASS** | ESLint passed across all 5 workspace packages. |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | Strict TypeScript check passed across all packages (`tsc --noEmit`). |
| **Unit & Integration Tests** | `npm run test` | **PASS** | 13 test files passed (109 tests passed in Vitest). |
| **Production Build** | `npm run build` | **PASS** | Next.js and Fastify production artifacts compiled successfully. |
| **Repository Secret Scan** | `npm run secret-scan` | **PASS** | 180 files checked; zero unredacted live secrets or private keys detected. |
| **Admin Production Bundle Scan** | `admin-login-page.test.tsx` | **PASS** | Production HTML and `.next/static` assets verified free of demo credentials. |
| **Android Gradle Configuration** | `./gradlew tasks --dry-run` | **PASS** | Build scripts and plugins validated cleanly. |
| **Android Dev Config Validation** | `./gradlew validateDevConfig` | **PASS** | Hosted development Supabase configuration validated (local Supabase/54321 rejected). |
| **Android Debug Build** | `./gradlew assembleDebug` | **PASS** | Debug APK built successfully with Compose and BuildConfig. |
| **Android Unit Tests** | `./gradlew testDebugUnitTest` | **PASS** | Endpoint selection, LAN IP candidates, service-role prohibition, and hosted URL validation tests passed. |
| **Android Release Validation** | `./gradlew validateReleaseConfig` | **PASS** | Fail-closed validation correctly rejects missing/invalid production configuration. |
| **Remote Database Tests** | `database.test.sql` (pgTAP) | **BLOCKED** | Test suite updated to plan(76). Execution requires dedicated hosted test project connection string (`TEST_SUPABASE_DB_URL`). Production database protected from test pollution. |
| **Database Concurrency Tests** | `npm run test:db:concurrency` | **BLOCKED** | Real multi-session PostgreSQL test suite verified. Execution requires dedicated hosted test project (`TEST_SUPABASE_DB_URL`). Production database protected from test pollution. |

---

## 📚 Phase 0: Authoritative Architecture & Requirements Documentation

All specifications, threat models, database schemas, and engineering roadmaps are maintained in [`docs/phase-0/`](./docs/phase-0/):

1. [**Project Brief**](./docs/phase-0/PROJECT_BRIEF.md) — Product vision, platform scope, separated Online vs. Cash operational counter workflows, requirement classifications, and stakeholder roles.
2. [**Functional Requirements**](./docs/phase-0/FUNCTIONAL_REQUIREMENTS.md) — Comprehensive user roles, module specifications tagged with confirmation status, separated checkout lifecycles, and protected inventory write-off rules.
3. [**System Architecture**](./docs/phase-0/SYSTEM_ARCHITECTURE.md) — Architectural evaluation (modular monolith vs. alternatives), topology diagrams, detailed data flows, race condition resolution matrix, and state transitions.
4. [**Database Design**](./docs/phase-0/DATABASE_DESIGN.md) — PostgreSQL ERD, authoritative inventory definitions (`physical_stock`, `reserved_stock`, `available_stock`), DDL tables, check constraints, complete RLS policies across all 10 tables, and hardened deterministic stored procedures.
5. [**Security Plan**](./docs/phase-0/SECURITY_PLAN.md) — STRIDE threat modeling, Dual-Layer Security Model, server-side authorization architecture, OTP abuse defense, zero-trust payment verification, refund timeout recovery, action-level role separation, and credential isolation.
6. [**Testing Strategy**](./docs/phase-0/TESTING_STRATEGY.md) — Quality pyramid, 17 critical edge-case scenarios, and contract drift checks.
7. [**Implementation Roadmap**](./docs/phase-0/IMPLEMENTATION_ROADMAP.md) — 10-phase dependency-driven engineering roadmap with standardized 6-part acceptance gate structure.
8. [**Decisions & Open Questions**](./docs/phase-0/DECISIONS_AND_OPEN_QUESTIONS.md) — Architectural Decision Records (ADRs 001–008), cross-platform API contract parity, and Central Decision Register of open business decisions awaiting client approval with recommended defaults.
9. [**Development Guidelines**](./docs/phase-0/DEVELOPMENT_GUIDELINES.md) — Practical monorepo layout, environment variable templates, cross-platform contract data conventions, Git conventions, and CI drift verification.

---

## 🛡️ License & Confidentiality

Proprietary and confidential. Developed for Moody Orange.  
Repository: [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)
