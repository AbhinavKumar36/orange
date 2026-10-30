# Moody Orange — Project Brief & Product Specification

**Document Version:** 1.1.0 (Phase 0.1 Revision)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target Brand:** Moody Orange  
**Lead Architect:** Senior Software Architect & Technical Lead  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial Phase 0 draft covering product scope, three platforms, and baseline architecture. |
| **1.1.0** | 2026-10-30 | Lead Architect | **Phase 0.1 Revision:**<br>• Decoupled Backend API into an independent modular monolith (`apps/backend-api`).<br>• Rigorously tagged all requirements (`[CONFIRMED]`, `[PROPOSED]`, `[ASSUMPTION]`, `[CLIENT DECISION REQUIRED]`).<br>• Defined late webhook reconciliation and refund lifecycle.<br>• Clarified performance metrics as planning benchmarks. |

---

## 1. Executive Summary

**Moody Orange** is a specialized retail ordering platform designed to streamline retail purchases for a premier physical confectionery and beverage store. The store specializes in three curated product categories:
1. **Artisanal Cakes** `[CONFIRMED]` (stocked specialty cakes, celebration cakes, and daily fresh bakes)
2. **Fresh Cold-Pressed Juices** `[CONFIRMED]` (made-to-order and fresh-bottled daily juices, fruit blends, and wellness shots)
3. **Gourmet Chocolates** `[CONFIRMED]` (curated boxes, single-origin bars, and hand-crafted truffles)

The core operational model is **Online Pre-Order with Physical Counter Collection (Click & Collect)** `[CONFIRMED]`. Customers browse real-time inventory, place orders online, and collect them at the physical shop counter.

`[CONFIRMED SCOPE BOUNDARY]` By prioritizing in-store counter pickup for the initial release, Moody Orange eliminates the high logistics overhead, thermal packaging complications, and unpredictable delivery timelines associated with perishable goods like fresh cream cakes and raw juices. **Home delivery is explicitly excluded from the initial release.**

---

## 2. Business Objectives & Planning Benchmarks

### 2.1 Primary Business Objectives
- **Zero Counter Queuing:** Minimize physical customer waiting times during peak store hours by enabling advance ordering and scheduled collection slots `[CONFIRMED]`.
- **Absolute Inventory Integrity:** Eliminate physical vs. digital stock discrepancies through atomic, real-time database transactions `[CONFIRMED]`.
- **Frictionless Omnichannel Ordering:** Enable customers to order seamlessly via responsive web or a high-performance native Android application `[CONFIRMED]`.
- **Operational Clarity:** Equip in-store counter staff and kitchen managers with a real-time order dispatch board to orchestrate packing and counter handovers `[CONFIRMED]`.

### 2.2 Planning Benchmarks & Target Indicators
*(Note: These are engineering design targets to guide sizing and optimization, not contractual performance guarantees prior to load testing in Phase 7).*

| Planning Metric | Target Design Benchmark | Classification | Verification Mechanism |
| :--- | :--- | :--- | :--- |
| **Counter Handover Latency** | < 45 seconds from customer arrival | `[PROPOSED]` | Difference between customer check-in and staff completion |
| **Overselling / Stockout Errors** | 0.00% under high concurrency | `[CONFIRMED]` | Automated concurrency load tests (k6) in Phase 7 |
| **Payment Drop-off Rate** | < 12% | `[PLANNING TARGET]` | Funnel analytics from checkout init to payment captured |
| **Store Hours Availability** | 99.9% during operational hours | `[PLANNING TARGET]` | Cloud health checks and synthetic uptime monitors |
| **Realtime Queue Latency** | < 1.0 second | `[PLANNING TARGET]` | WebSocket round-trip measurement between server and admin UI |

---

## 3. Platform Scope & Target Ecosystem

Moody Orange consists of **three distinct client interfaces** powered by **one authoritative, independently deployable backend service**:

```
                  +--------------------------------------------------+
                  |              MOODY ORANGE ECOSYSTEM              |
                  +--------------------------------------------------+
                                           |
         +---------------------------------+---------------------------------+
         |                                 |                                 |
         v                                 v                                 v
+-------------------+             +-------------------+             +-------------------+
|   CUSTOMER WEB    |             |   ANDROID APP     |             |    ADMIN WEB      |
| Next.js / React   |             | Native Kotlin     |             | Next.js / React   |
| TypeScript        |             | Jetpack Compose   |             | TypeScript        |
| (Mobile/Desktop)  |             | (Android Studio)  |             | (Counter / Mgr)   |
+-------------------+             +-------------------+             +-------------------+
         |                                 |                                 |
         +---------------------------------+---------------------------------+
                                           |
                                           v HTTPS / TLS 1.3
                  +--------------------------------------------------+
                  |         AUTHORITATIVE BACKEND REST API           |
                  |     - Standalone Modular Monolith (Node.js/TS)   |
                  |     - Versioned Endpoints (/api/v1/...)          |
                  |     - Razorpay Verification & Webhook Engine     |
                  |     - Inventory & Order Transaction Engine       |
                  +--------------------------------------------------+
                                           |
                                           v
                  +--------------------------------------------------+
                  |           SUPABASE MANAGED DATA LAYER            |
                  |     - PostgreSQL 15+ (ACID Engine & RPCs)        |
                  |     - Row Level Security (RLS) Isolation         |
                  |     - Supabase Auth (Phone OTP & Staff JWTs)     |
                  |     - Supabase Storage (Product Image CDN)       |
                  |     - Supabase Realtime (WebSockets)             |
                  +--------------------------------------------------+
```

### 3.1 Interface Specifications

#### A. Customer Website `[CONFIRMED]`
- **Framework:** Next.js (App Router), TypeScript, Vanilla CSS / design tokens.
- **Form Factors:** Fully responsive for mobile browsers, tablets, and desktop computers.
- **Core Features:** Product catalog browsing, search, real-time availability indicator, shopping cart, mobile OTP authentication, immediate and scheduled pickup selection, Razorpay online checkout, cash-at-pickup option, digital collection confirmation, and live order status tracker.

#### B. Native Android Application `[CONFIRMED]`
- **Technology:** 100% Native Kotlin, Android Studio, Jetpack Compose.
- **Strict Boundary:** No React Native, no Expo, no Flutter, and no WebView wrappers `[CONFIRMED]`.
- **Core Features:** Shares authoritative backend contracts and business logic identically with the web platform: catalog browsing, cart, checkout, pickup time selection, payment processing, and real-time order tracking.

#### C. Admin & Store Counter Website `[CONFIRMED]`
- **Framework:** Next.js (App Router), TypeScript.
- **Core Features:** Staff/manager authentication, live order dispatch queue, pickup confirmation workflow, cash collection recording, product and category management, price and availability toggles, inventory management, and basic operational/sales reporting.

#### D. Standalone Authoritative Backend API `[CONFIRMED ARCHITECTURE]`
- **Architecture:** Practical Modular Monolith (Node.js/TypeScript REST API in `apps/backend-api`).
- **Separation of Concerns:** Completely decoupled from customer and admin web applications. Deployable and scalable independently.
- **Role:** Sole authoritative engine executing business logic, price recalculations, stock reservations, payment gateway communications, and webhook verifications.

---

## 4. Inclusions vs. Explicit Exclusions

### 4.1 In-Scope Deliverables (Phased Development)
- `[CONFIRMED]` Multi-platform system: Customer Web, Native Android App, Admin Web, and Standalone Backend API.
- `[CONFIRMED]` Three primary categories: Cakes, Juices, and Chocolates.
- `[CONFIRMED]` Mobile-number OTP authentication for customers (Indian mobile standards).
- `[CONFIRMED]` Secure staff authentication with role-based access control (RBAC).
- `[CONFIRMED]` Atomic inventory reservation and deduction engine preventing race conditions and overselling.
- `[CONFIRMED]` Dual pickup fulfillment options: Immediate Pickup vs. Scheduled Pickup.
- `[CONFIRMED]` Dual payment options: Online Payment (Razorpay) and Cash at Pickup.
- `[CONFIRMED]` Server-side payment validation, HMAC webhook signature verification, and duplicate payment prevention.
- `[CONFIRMED]` Pickup confirmation workflow when goods are collected at the counter.
- `[CONFIRMED]` Real-time order state updates across all platforms.
- `[PROPOSED]` Visual collection token: 4-digit numeric PIN and QR code for rapid counter handover.
- `[PROPOSED]` Automated 10-minute Time-To-Live (TTL) on stock reservations for pending online payments.
- `[PROPOSED]` Automated reconciliation and refund pipeline if an online payment succeeds after reservation expiry.

### 4.2 Explicit Exclusions (Out of Scope for Initial Launch)
- `[CONFIRMED EXCLUSION]` **Home Delivery & Courier Shipping:** No delivery address capture, route planning, or logistics partner integrations (e.g., Dunzo, Shadowfax). Counter pickup only.
- `[CONFIRMED EXCLUSION]` **Multi-Store / Multi-Branch Topology:** Single physical store counter for initial release.
- `[CONFIRMED EXCLUSION]` **Bespoke 3D Custom Cake Modeler:** Standardized and stocked/pre-prepared items only.
- `[CONFIRMED EXCLUSION]` **Customer Stored-Value Wallets:** No in-app stored balances. Refunds return directly to original payment source.
- `[CONFIRMED EXCLUSION]` **Third-Party Marketplace Aggregators:** No integration with Zomato or Swiggy merchant APIs.

---

## 5. Physical Store Operations & Fulfillment Workflow

```
[Customer Places Order] 
       │
       ▼
[Stock Reserved Atomically via Database Procedure]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[Online Payment (Razorpay)]       [Cash at Pickup]
       │                                 │
       │ (Webhook Confirmed)             │ (Immediate Confirmation)
       ▼                                 ▼
[Order Status: CONFIRMED] ───────────────┘
       │
       ▼
[Admin Live Queue Notification]
       │
       ▼
[Store Preparation: PREPARING]
       │
       ▼
[Order Staged on Counter: READY FOR PICKUP]
       │
       ▼
[Customer Arrives at Shop Counter]
       │
       ▼
[Staff Verifies Order (PIN / QR / Order ID)]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[If Cash: Collect Cash & Confirm]    [If Online: Already Paid]
       │                                 │
       └────────────────┬────────────────┘
                        │
                        ▼
            [Staff Clicks: COMPLETE]
                        │
                        ▼
          [Order Status: COMPLETED]
          [Stock Reservation Committed to Physical Deduct]
```

---

## 6. Project Stakeholders & System Roles

| Role | Classification | Core Responsibilities in Moody Orange |
| :--- | :--- | :--- |
| **Retail Customer** | `[CONFIRMED]` | Browses catalog, adds items to cart, authenticates via mobile OTP, selects pickup time, pays online or selects cash at pickup, tracks order, collects items at shop counter. |
| **Counter Staff** | `[CONFIRMED]` | Front-of-house staff operating the counter interface; verifies customer collection token; collects physical cash for cash orders; hands over packages; marks orders completed. |
| **Store Manager** | `[CONFIRMED]` | Oversees daily operations, adjusts physical stock counts, triggers out-of-stock toggles, configures operating hours, reviews daily sales/cash reconciliation, and processes authorized refunds. |
| **System Administrator** | `[CONFIRMED]` | Technical administrator managing cloud hosting, database migrations, third-party API configurations (Razorpay, SMS gateways), and security audit logs. |
