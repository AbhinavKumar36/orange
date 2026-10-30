# Moody Orange — Project Brief & Product Specification

**Document Version:** 1.0.0  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Target Brand:** Moody Orange  
**Lead Architect:** Senior Software Architect & Technical Lead  

---

## 1. Executive Summary

**Moody Orange** is a specialized, boutique quick-commerce ordering platform designed to streamline retail purchases for a premier physical confectionery and beverage store. The store specializes in three curated product categories:
1. **Artisanal Cakes** (pre-prepared specialty cakes, celebration cakes, and daily fresh bakes)
2. **Fresh Cold-Pressed Juices** (made-to-order and fresh-bottled daily juices, fruit blends, and wellness shots)
3. **Gourmet Chocolates** (curated boxes, single-origin bars, and hand-crafted truffles)

The core operational model is **Online Pre-Order with Physical Counter Collection (Click & Collect)**. Customers browse real-time inventory, customize items where applicable, place orders online, and pick them up at the physical shop counter. By prioritizing in-store counter pickup for the initial release, Moody Orange eliminates the high logistics overhead, thermal packaging complications, and unpredictable delivery timelines associated with perishable goods like cakes and fresh juices.

This project will deliver a robust, production-grade retail platform engineered for high availability, zero stock overselling, verifiable physical pickup handovers, and secure payment processing.

---

## 2. Business Objectives & Success Metrics

### 2.1 Primary Business Objectives
- **Zero Counter Queuing:** Minimize physical customer waiting times during peak hours (evenings and festival seasons) by enabling advance ordering and scheduled collection slots.
- **Stock Accuracy:** Eliminate physical vs. digital stock discrepancies through atomic, real-time inventory management.
- **Higher Average Order Value (AOV):** Provide a rich, visual digital catalog across web and mobile that showcases product pairings (e.g., cake + juice combos, celebration chocolate add-ons).
- **Frictionless Omnichannel Experience:** Enable customers to order seamlessly via responsive web or a high-performance native Android application.
- **Operational Clarity:** Equip in-store staff and management with a real-time order dispatch board to orchestrate preparation, packing, and counter handovers without verbal chaos.

### 2.2 Key Performance Indicators (KPIs)
| KPI Metric | Target Goal | Measurement Mechanism |
| :--- | :--- | :--- |
| **Pickup Handover Time** | < 45 seconds from customer arrival | Timestamp difference between "Customer Check-in / PIN Entry" and "Order Completed" |
| **Overselling / Stockout Error Rate** | 0.00% | Database concurrency logs and failed reservation metrics |
| **Payment Drop-off Rate** | < 12% | Funnel analytics from "Initiate Checkout" to "Payment Captured / Order Confirmed" |
| **Platform Uptime (SLA)** | 99.9% during business operating hours | Cloud health checks and synthetic uptime monitors |
| **Realtime Queue Latency** | < 1.0 second | WebSocket latency for status updates between Customer and Admin interfaces |

---

## 3. Platform Scope & Target Ecosystem

Moody Orange consists of **three distinct user interfaces** powered by a single, authoritative backend architecture:

```
                  +----------------------------------------------+
                  |           MOODY ORANGE ECOSYSTEM             |
                  +----------------------------------------------+
                                         |
         +-------------------------------+-------------------------------+
         |                               |                               |
         v                               v                               v
+-------------------+           +-------------------+           +-------------------+
|   CUSTOMER WEB    |           |   ANDROID APP     |           |    ADMIN WEB      |
| Next.js / React   |           | Native Kotlin     |           | Next.js / React   |
| TypeScript        |           | Jetpack Compose   |           | TypeScript        |
| (Mobile/Desktop)  |           | (Modern Android)  |           | (Counter / Mgr)   |
+-------------------+           +-------------------+           +-------------------+
         |                               |                               |
         +-------------------------------+-------------------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |         SHARED AUTHORITATIVE BACKEND         |
                  |     - Supabase / PostgreSQL (ACID Engine)    |
                  |     - Server API & Transaction Layer         |
                  |     - Supabase Auth (Phone OTP & RBAC)       |
                  |     - Supabase Realtime & Storage            |
                  |     - Razorpay Gateway Integration           |
                  +----------------------------------------------+
```

### 3.1 Interface Specifications

#### A. Customer Website
- **Technology Stack:** Next.js (App Router), TypeScript, Tailwind CSS / Vanilla CSS design tokens.
- **Target Audience:** New and returning retail customers across mobile browsers, tablets, and desktop computers.
- **Core Functionality:** Visual product catalog, instant category filtering, real-time stock indicators, cart management, phone OTP authentication, immediate or scheduled pickup selection, Razorpay online payments, cash-at-pickup option, digital collection pass (PIN and QR code), and live order status tracker.

#### B. Native Android Application
- **Technology Stack:** 100% Native Kotlin, Android Studio, Jetpack Compose, Kotlin Coroutines & StateFlow, Material 3 Design System.
- **Target Audience:** Frequent local shoppers, loyal patrons, and mobile-first consumers seeking high performance, native haptics, and push notifications.
- **Core Functionality:** Mirroring all customer web business rules and checkout logic with native fluidity, offline-aware catalog caching, secure credential persistence via Android Keystore, and native biometric / PIN authentication.
- **Strict Architecture Constraint:** No hybrid frameworks, no React Native, no Expo, no Flutter, and no WebView wrappers.

#### C. Store Admin & Counter Website
- **Technology Stack:** Next.js (App Router), TypeScript, Protected Dashboard layouts, Real-time WebSocket subscriptions.
- **Target Audience:** Physical counter staff, barista/bakers, kitchen dispatchers, and store managers.
- **Core Functionality:** Live order queue (Kanban-style), high-contrast counter pickup verification (PIN input / QR scanner integration), audio/visual new-order chimes, instant stock overrides (emergency "mark out of stock"), category/product management, operational store hours toggle, and daily cash reconciliation.

---

## 4. Inclusions vs. Explicit Exclusions

To ensure rigorous project governance and prevent scope creep, boundaries are explicitly drawn:

### 4.1 In-Scope Deliverables (Phase 0 through Production Launch)
- Multi-platform shopping experience: Customer Web, Native Android App, and Admin Portal.
- Catalog with 3 primary categories: Cakes, Juices, and Chocolates (including dietary attributes like Eggless, Vegan, Sugar-Free).
- Mobile-number OTP authentication for customers (optimized for Indian mobile phone formats).
- Email/Password + Role-Based Access Control (RBAC) authentication for Admin and Counter Staff.
- Atomic stock reservation engine with Time-To-Live (TTL) auto-release to prevent race conditions during flash sales.
- Dual fulfillment timing:
  - **Immediate Pickup:** Ready within dynamic preparation estimate (e.g., 20–35 minutes).
  - **Scheduled Pickup:** Customer chooses a designated 15-minute collection window within store operating hours.
- Dual payment methods:
  - **Online Payment:** Razorpay Checkout (UPI, Credit/Debit Cards, NetBanking, Wallets).
  - **Cash at Pickup:** Counter cash payment collection upon physical arrival.
- Counter verification workflow via 4-digit Collection PIN and machine-readable QR Code.
- Server-side webhook verification, cryptographic signature validation, and idempotent transaction processing.
- Real-time order state progression notifications across all client interfaces.

### 4.2 Explicit Exclusions (Out of Scope for Initial Launch)
- **Home Delivery / Courier Shipping:** No delivery address capture, delivery fee calculation, driver dispatching, or integration with logistics partners (e.g., Dunzo, Shadowfax, Shiprocket).
- **Multi-Store / Franchise Topology:** The system is explicitly architected for a **single physical flagship location**. Multi-branch inventory routing and cross-store allocation are deferred to future phases.
- **Custom Cake 3D Builder / Complex Pre-ordering:** No multi-tier custom cake design tools or bespoke fondant modeling requests. Initial catalog sells stocked, standardized, or pre-configured cakes.
- **Subscription Services:** No recurring daily juice delivery or monthly chocolate subscription box billing.
- **Third-Party Marketplace Aggregators:** No two-way sync with Zomato or Swiggy merchant APIs.
- **Customer In-App Wallet / Store Credit Ledger:** No stored-value wallet accounts. Refunds return directly to the original payment source or cash register.

---

## 5. Physical Store Operations & Fulfillment Workflow

Understanding the in-store operational reality is critical for architectural design:

```
[Customer Places Order] 
       │
       ▼
[Stock Reserved Atomically] 
       │
       ├───────────────────────────────┐
       ▼                               ▼
[Online Payment (Razorpay)]    [Cash at Pickup]
       │                               │
       │ (Webhook Confirmed)           │ (Immediate Confirmation)
       ▼                               ▼
[Order Status: CONFIRMED] ─────────────┘
       │
       ▼
[Admin Live Queue Alert (Chime & Card)]
       │
       ▼
[Kitchen / Packaging: PREPARING]
       │
       ▼
[Order Packed & Shelved: READY FOR PICKUP]
       │ (SMS / In-App Notification Sent to Customer)
       ▼
[Customer Arrives at Counter]
       │
       ▼
[Staff Verifies 4-Digit PIN or Scans QR]
       │
       ├───────────────────────────────┐
       ▼                               ▼
[If Cash: Collect Cash & Check Box]   [If Online: Already Paid]
       │                               │
       └───────────────┬───────────────┘
                       │
                       ▼
            [Staff Clicks: COMPLETE]
                       │
                       ▼
          [Order Status: COMPLETED]
          [Stock Reservation Committed]
```

1. **Order Staging Area:** Physical orders are tagged with the 6-character order number (e.g., `MO-8492`) and placed in either the refrigerated cake cabinet, cold juice chiller, or ambient chocolate counter.
2. **Collection Handover:** Counter staff asks for the customer's 4-digit Collection PIN or scans the QR code directly from the customer’s phone screen.
3. **Cash Reconciliation:** If marked as "Cash at Pickup", the admin UI enforces a mandatory prompt: *"Confirm Cash of ₹X Received"* before the "Handover & Complete" button is unlocked.
4. **Uncollected / Abandoned Orders:** Orders not picked up within a configurable grace period (e.g., 90 minutes post-scheduled time) transition to an alert state for staff intervention.

---

## 6. Project Stakeholders & Operational Roles

| Role | Primary User / Persona | Core Responsibilities in Moody Orange |
| :--- | :--- | :--- |
| **Retail Customer** | General Public (Local patrons) | Discovers products, adds to cart, verifies phone number via OTP, selects pickup time, pays online or selects cash, tracks order, collects items at store. |
| **Counter Staff** | Front-of-House Cashiers & Baristas | Operates Admin Web at counter terminal; verifies customer collection PIN/QR; collects cash payments; hands over packaged items; updates status to Completed. |
| **Kitchen / Prep Staff** | Bakers & Juice Dispensers | Monitors queue for "Preparing" orders; checks preparation tickets; flags when items are packed and moved to the pickup shelf ("Ready for Pickup"). |
| **Store Manager / Admin** | Store Owner & Operations Lead | Manages menu prices and stock levels; triggers emergency stock freeze; modifies operating hours; reviews sales reports; executes authorized customer refunds. |
| **System Administrator** | Technical Lead / DevOps Lead | Oversees cloud infrastructure, Supabase database health, Razorpay API credentials, SMS gateway balances, error rates, and backup integrity. |
