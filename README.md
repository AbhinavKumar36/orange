# Moody Orange

> Boutique quick-commerce ordering platform for artisanal cakes, fresh cold-pressed juices, and gourmet chocolates with in-store counter pickup.

---

## 📌 Project Overview

**Moody Orange** is a specialized retail platform supporting online ordering with physical counter collection (Click & Collect).
The system encompasses three client interfaces powered by a single, authoritative, independently deployable backend service:
- **Customer Website:** Built with Next.js & TypeScript (`apps/customer-web` — responsive for mobile, tablet, desktop)
- **Native Android App:** Built with Kotlin & Jetpack Compose (`apps/android` — 100% native, no web wrappers)
- **Admin & Counter Portal:** Built with Next.js & TypeScript (`apps/admin-web` — live Kanban dispatch queue, audio alerts, collection verification)
- **Authoritative Backend API:** Standalone modular monolith in Node.js/TypeScript (`apps/backend-api` — versioned REST API `/api/v1/...`, inventory transaction engine, Razorpay checkout, webhook verification, and refund automation)
- **Managed Data Layer:** Supabase PostgreSQL 15+ with Row Level Security, Storage CDN, and Realtime WebSockets

---

## 📚 Phase 0.2: Authoritative Architecture & Requirements Documentation

All specifications, threat models, database schemas, and engineering roadmaps are maintained in [`docs/phase-0/`](./docs/phase-0/):

1. [**Project Brief**](./docs/phase-0/PROJECT_BRIEF.md) — Product vision, platform scope, operational counter workflow, requirement classifications, and stakeholder roles.
2. [**Functional Requirements**](./docs/phase-0/FUNCTIONAL_REQUIREMENTS.md) — Comprehensive user roles, module specifications tagged with confirmation status, and planning benchmarks.
3. [**System Architecture**](./docs/phase-0/SYSTEM_ARCHITECTURE.md) — Architectural evaluation (modular monolith vs. alternatives), topology diagrams, detailed data flows (multi-product reservation, late payment webhook reconciliation), and subsystem designs.
4. [**Database Design**](./docs/phase-0/DATABASE_DESIGN.md) — PostgreSQL ERD, authoritative inventory definitions (`physical_stock`, `reserved_stock`, `available_stock`), DDL tables, check constraints, RLS policies, and deterministic stored procedures.
5. [**Security Plan**](./docs/phase-0/SECURITY_PLAN.md) — STRIDE threat modeling, server-side authorization architecture, OTP abuse defense, zero-trust payment verification, and credential isolation.
6. [**Testing Strategy**](./docs/phase-0/TESTING_STRATEGY.md) — Quality pyramid, 10 critical edge-case scenarios (deadlock prevention, all-or-nothing rollback, TTL cleanup, duplicate webhook idempotency, evidence-based refunds), and automated test tooling.
7. [**Implementation Roadmap**](./docs/phase-0/IMPLEMENTATION_ROADMAP.md) — 10-phase dependency-driven engineering roadmap with strict progression cycle (`Plan → Implement → Code Review → Test → Approve → Next Phase`), WBS, and verification gates.
8. [**Decisions & Open Questions**](./docs/phase-0/DECISIONS_AND_OPEN_QUESTIONS.md) — Architectural Decision Records (ADRs 001–007), cross-platform API contract parity, and categorized business decisions awaiting client approval.
9. [**Development Guidelines**](./docs/phase-0/DEVELOPMENT_GUIDELINES.md) — Practical monorepo layout, environment variable templates, cross-platform contract parity (TypeScript Zod & Kotlin `data class`), Git conventions, and local dev setup.

---

## 🛡️ License & Confidentiality

Proprietary and confidential. Developed for Moody Orange.  
Repository: [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)
