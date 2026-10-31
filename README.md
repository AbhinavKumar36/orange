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

## 🚀 Local Development Setup (Phase 1)

### 1. Prerequisites
- **Node.js**: `v20.x` or newer (LTS recommended; tested on `v24.x`)
- **Package Manager**: `npm` `10.x` or newer
- **Docker Desktop**: Required to run local Supabase services
- **Supabase CLI**: Required for local database development (`npm install -g supabase` or Scoop/Homebrew)
- **Android Studio & JDK 17**: Required for building `apps/android`

### 2. Dependency Installation
From the repository root, install dependencies cleanly:
```bash
# Clean install using committed lockfile
npm ci

# Alternatively, for fresh dependency resolution:
npm install
```

### 3. Environment Configuration
Copy environment templates to their local instances:
```bash
# Backend API
cp apps/backend-api/.env.example apps/backend-api/.env

# Customer Web
cp apps/customer-web/.env.example apps/customer-web/.env.local

# Admin Web
cp apps/admin-web/.env.example apps/admin-web/.env.local

# Android Application
cp apps/android/local.properties.example apps/android/local.properties
```

> [!NOTE]
> Local development allows mock/placeholder credentials when `ALLOW_MOCK_SERVICES=true` is set.
> In `NODE_ENV=production`, valid, non-placeholder `SUPABASE_SERVICE_ROLE_KEY` and HTTPS URLs are strictly required.

### 4. Running the Applications
```bash
# Start all workspace services in parallel via Turborepo
npm run dev

# Or start individual services:
npm run dev --filter=@orange/backend-api     # Backend API on http://localhost:4000
npm run dev --filter=@orange/customer-web    # Customer Web on http://localhost:3000
npm run dev --filter=@orange/admin-web       # Admin Web on http://localhost:3001
```

Health check verification:
```bash
curl http://localhost:4000/health
# Response: {"status":"ok"}

curl http://localhost:4000/api/v1/health
# Response: {"status":"ok"}
```

### 5. Automated Quality & Verification Commands
```bash
# 1. API Contract Validation (OpenAPI 3.1 schema linting via Redocly)
npm run contracts:lint

# 2. Workspace Linting (ESLint CLI across all workspaces)
npm run lint

# 3. TypeScript Typechecking (strict mode across all packages)
npm run typecheck

# 4. Unit Tests (Vitest suites for backend health, config validation, and error handling)
npm run test

# 5. Production Build (Next.js & Fastify artifacts)
npm run build

# 6. Repository Secret Scanning (Checks for unredacted live keys, credentials, and tokens)
npm run secret-scan
```

### 6. Local Supabase Setup
```bash
# Start local PostgreSQL, Auth, and Storage stack (Docker required)
supabase start

# Check service status
supabase status
# API Gateway:    http://localhost:54321
# PostgreSQL DB:  postgresql://postgres:postgres@localhost:54322/postgres
# Supabase Studio:http://localhost:54323
# Inbucket Mail:  http://localhost:54324

# Stop local Supabase
supabase stop
```

### 7. Known Environment Limitations
- **Docker in Sandbox / Cloud Environments**: If Docker is not installed or the Docker daemon is not active, `supabase start` cannot be run. In this environment, run `supabase start` on a local workstation once Docker Desktop is running.
- **Android SDK & Tooling**: `apps/android` requires Android Studio or an installed Android SDK with Java 17. The Android Studio project automatically sets `sdk.dir` in `local.properties`.
- **Windows Symlinks with npm**: On Windows systems without Developer Mode enabled, `npm ci` creating cross-package symlinks in workspaces may require elevated permissions.

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
