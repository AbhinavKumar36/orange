# Moody Orange

> Boutique quick-commerce ordering platform for artisanal cakes, fresh cold-pressed juices, and gourmet chocolates with in-store counter pickup.

---

## 📌 Project Overview

**Moody Orange** is a specialized retail platform supporting online ordering with physical counter collection (Click & Collect).
The system encompasses three client interfaces powered by a single, authoritative backend:
- **Customer Website:** Built with Next.js & TypeScript (Responsive for mobile, tablet, desktop)
- **Native Android App:** Built with Kotlin & Jetpack Compose (100% native, no web wrappers)
- **Admin & Counter Portal:** Built with Next.js & TypeScript (Live Kanban dispatch queue, audio alerts, collection PIN/QR verification)
- **Authoritative Backend:** Supabase (PostgreSQL 15+, Row Level Security, Realtime, Storage) + Authoritative REST API & Transaction Engine (Razorpay integration & cash-at-pickup)

---

## 📚 Phase 0: Requirements & Architecture Documentation

All initial specifications, threat models, database schemas, and engineering roadmaps are available in [`docs/phase-0/`](./docs/phase-0/):

1. [**Project Brief**](./docs/phase-0/PROJECT_BRIEF.md) — Product vision, platform scope, operational workflow, and stakeholder roles.
2. [**Functional Requirements**](./docs/phase-0/FUNCTIONAL_REQUIREMENTS.md) — User roles, module specifications, and non-functional requirements (NFRs).
3. [**System Architecture**](./docs/phase-0/SYSTEM_ARCHITECTURE.md) — Architectural evaluation, topology diagrams, data flows, and subsystem designs.
4. [**Database Design**](./docs/phase-0/DATABASE_DESIGN.md) — PostgreSQL ERD, DDL tables, check constraints, RLS policies, and stored procedures.
5. [**Security Plan**](./docs/phase-0/SECURITY_PLAN.md) — STRIDE threat modeling, OTP abuse defense, zero-trust payment verification, and secret isolation.
6. [**Testing Strategy**](./docs/phase-0/TESTING_STRATEGY.md) — Testing pyramid, 8 critical edge-case scenarios (flash-sale concurrency, TTL cleanup, webhook idempotency), and automated test tooling.
7. [**Implementation Roadmap**](./docs/phase-0/IMPLEMENTATION_ROADMAP.md) — 9-phase engineering roadmap with WBS and verification gates.
8. [**Decisions & Open Questions**](./docs/phase-0/DECISIONS_AND_OPEN_QUESTIONS.md) — Architectural Decision Records (ADRs) and business decisions requiring client approval.
9. [**Development Guidelines**](./docs/phase-0/DEVELOPMENT_GUIDELINES.md) — Monorepo layout, environment variable templates, Git conventions, and local dev setup.

---

## 🛡️ License & Confidentiality

Proprietary and confidential. Developed for Moody Orange.
