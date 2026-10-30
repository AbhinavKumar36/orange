# Moody Orange — Project Brief & Product Specification

**Document Version:** 1.2.0 (Phase 0.2 Final Consistency Review)  
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
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Decoupled Backend API into standalone modular monolith (`apps/backend-api`); added requirement tagging. |
| **1.2.0** | 2026-10-30 | Lead Architect | **Phase 0.2 Final Consistency Review:**<br>• Enforced authoritative inventory naming (`physical_stock`, `reserved_stock`, `available_stock`) and lifecycle across all sections.<br>• Realigned 10-phase engineering roadmap with dependency-based progression.<br>• Re-audited all requirement tags: marked slot durations, PIN/QR, timeouts, cash limits, and uncollected policies strictly as `[PROPOSED / CLIENT DECISION REQUIRED]`. |

---

## 1. Executive Summary

**Moody Orange** is a specialized retail ordering platform designed to streamline retail purchases for a physical boutique confectionery and beverage store. The store specializes in three curated product categories:
1. **Artisanal Cakes** `[CONFIRMED]` (stocked specialty cakes, celebration cakes, and daily fresh bakes)
2. **Fresh Cold-Pressed Juices** `[CONFIRMED]` (made-to-order and fresh-bottled daily juices, fruit blends, and wellness shots)
3. **Gourmet Chocolates** `[CONFIRMED]` (curated boxes, single-origin bars, and hand-crafted truffles)

The core operational model is **Online Pre-Order with Physical Counter Collection (Click & Collect)** `[CONFIRMED]`. Customers browse real-time inventory, place orders online, and collect them at the physical shop counter.

`[CONFIRMED SCOPE BOUNDARY]` By prioritizing in-store counter pickup for the initial release, Moody Orange eliminates the high logistics overhead, thermal packaging complications, and unpredictable delivery timelines associated with perishable goods like fresh cream cakes and raw juices. **Home delivery is explicitly excluded from the initial release.**

---

## 2. Business Objectives & Planning Benchmarks

### 2.1 Primary Business Objectives
- **Zero Counter Queuing:** Minimize physical customer waiting times during peak store hours by enabling advance ordering and scheduled collection slots `[CONFIRMED]`.
- **Absolute Inventory Integrity:** Eliminate physical vs. digital stock discrepancies through atomic, row-locked database transactions `[CONFIRMED]`.
- **Frictionless Omnichannel Ordering:** Enable customers to order seamlessly via responsive web or a high-performance native Android application `[CONFIRMED]`.
- **Operational Clarity:** Equip in-store counter staff and kitchen managers with a real-time order dispatch board to orchestrate packing and counter handovers `[CONFIRMED]`.

### 2.2 Planning Benchmarks & Design Targets
*(Note: These are engineering design targets to guide sizing and optimization, not contractual performance guarantees prior to load testing).*

| Planning Metric | Target Design Benchmark | Classification | Verification Mechanism |
| :--- | :--- | :--- | :--- |
| **Counter Handover Latency** | < 45 seconds from customer arrival | `[PROPOSED]` | Difference between customer check-in and staff completion |
| **Overselling / Stockout Errors** | 0.00% under high concurrency | `[CONFIRMED]` | Automated concurrency load tests (k6) |
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
                  |     - Deterministic Multi-Product Stock Engine   |
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
- **Role:** Sole authoritative engine executing business logic, price recalculations, deterministic multi-product stock reservations, payment gateway communications, and webhook verifications.

---

## 4. Inclusions vs. Explicit Exclusions

### 4.1 In-Scope Deliverables
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
- `[PROPOSED / CLIENT DECISION REQUIRED]` Visual collection token: 4-digit numeric PIN and QR code for rapid counter handover.
- `[PROPOSED / CLIENT DECISION REQUIRED]` 10-minute Time-To-Live (TTL) on stock reservations for pending online payments.
- `[PROPOSED / CLIENT DECISION REQUIRED]` Scheduled pickup time slots in 15-minute intervals.
- `[PROPOSED / CLIENT DECISION REQUIRED]` Cash at pickup maximum order total cap (e.g., ₹1,000).
- `[PROPOSED / CLIENT DECISION REQUIRED]` Uncollected order grace period and end-of-day food disposal policy.

### 4.2 Explicit Exclusions (Out of Scope for Initial Launch)
- `[CONFIRMED EXCLUSION]` **Home Delivery & Courier Shipping:** No delivery address capture, route planning, or logistics partner integrations. Counter pickup only.
- `[CONFIRMED EXCLUSION]` **Multi-Store / Multi-Branch Topology:** Single physical store counter for initial release.
- `[CONFIRMED EXCLUSION]` **Bespoke 3D Custom Cake Modeler:** Standardized and stocked/pre-prepared items only.
- `[CONFIRMED EXCLUSION]` **Customer Stored-Value Wallets:** No in-app stored balances. Refunds return directly to original payment source.
- `[CONFIRMED EXCLUSION]` **Third-Party Marketplace Aggregators:** No integration with Zomato or Swiggy merchant APIs.

---

## 5. Authoritative Inventory Accounting Rules

All components adhere to the following strict stock accounting definitions:
- **`physical_stock`:** Total physical sellable units currently present in the shop.
- **`reserved_stock`:** Units allocated to pending checkout reservations AND confirmed orders awaiting collection.
- **`available_stock`:** Defined as `physical_stock - reserved_stock`.

### 5.1 Authoritative Stock Accounting Example

| Operational Event | `physical_stock` | `reserved_stock` | `available_stock` | Note |
| :--- | :---: | :---: | :---: | :--- |
| **Initial Stock** | 10 | 0 | 10 | 10 sellable units in display/chiller |
| **Customer Reserves 2 Units** | 10 | 2 | 8 | Reserved during checkout |
| **Payment Succeeds** | 10 | 2 | 8 | **Reservation NOT released!** Confirmed order holds reserved stock |
| **Customer Collects 2 Units** | 8 | 0 | 8 | **Physical stock decreases on counter handover!** Reserved stock drops to 0 |
| **Another Checkout Reserves 1**| 8 | 1 | 7 | New pending checkout |
| **Reservation Expires** | 8 | 0 | 8 | Unpaid checkout timed out; reserved stock drops to 0 |

---

## 6. Physical Store Operations & Fulfillment Workflow

```
[Customer Places Order] 
       │
       ▼
[Stock Reserved Atomically (Deterministic Row Lock)]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[Online Payment (Razorpay)]       [Cash at Pickup]
       │                                 │
       │ (Webhook Confirmed)             │ (Immediate Confirmation)
       ▼                                 ▼
[Order Status: CONFIRMED] ───────────────┘
  (Stock remains reserved)
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
[Staff Verifies Order]
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
          [physical_stock -= qty, reserved_stock -= qty]
```

---

## 7. Project Stakeholders & System Roles

| Role | Classification | Core Responsibilities in Moody Orange |
| :--- | :--- | :--- |
| **Retail Customer** | `[CONFIRMED]` | Browses catalog, adds items to cart, authenticates via mobile OTP, selects pickup time, pays online or selects cash at pickup, tracks order, collects items at shop counter. |
| **Counter Staff** | `[CONFIRMED]` | Front-of-house staff operating the counter interface; verifies customer collection token; collects physical cash for cash orders; hands over packages; marks orders completed. |
| **Store Manager** | `[CONFIRMED]` | Oversees daily operations, adjusts physical stock counts, triggers out-of-stock toggles, configures operating hours, reviews daily sales/cash reconciliation, and processes authorized refunds. |
| **System Administrator** | `[CONFIRMED]` | Technical administrator managing cloud hosting, database migrations, third-party API configurations (Razorpay, SMS gateways), and security audit logs. |
