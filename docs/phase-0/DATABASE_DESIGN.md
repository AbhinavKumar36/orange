# Moody Orange — Database Architecture & Schema Specification

**Document Version:** 1.4.1 (Phase 0.4.1 Final Blocker Resolution)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Ready for Phase 0 Approval Review  
**Database Engine:** PostgreSQL 15+ (Hosted on Supabase)  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial schema definitions, tables, and RLS policies. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Decoupled Backend API and added initial late webhook handling. |
| **1.2.0** | 2026-10-30 | Lead Architect | Phase 0.2 Revision: Standardized `physical_stock` and multi-product deterministic row locks. |
| **1.3.0** | 2026-10-30 | Lead Architect | Phase 0.3 Revision: Added duplicate aggregation, customer-scoped idempotency, and cash unpaid state. |
| **1.4.0** | 2026-10-30 | Lead Architect | Phase 0.4 Consistency Pass: Dual-layer security, raw-body HMAC, and evidence-based refunds. |
| **1.4.1** | 2026-10-30 | Lead Architect | **Phase 0.4.1 Final Blocker Resolution:**<br>• Fully separated Cash-at-Pickup (`confirmed`, `unpaid`, `expires_at = NULL`) from Online Checkout (`draft`, `pending`, `expires_at = NOW() + 10min`).<br>• Hardened `rpc_release_expired_reservations` to strictly target online checkouts, ensuring cash orders cannot be accidentally expired by the reservation worker.<br>• Authored `rpc_write_off_inventory` protecting `physical_stock >= reserved_stock`: prevents blind write-offs when stock is reserved, requiring explicit order cancellation and customer refund.<br>• Enhanced `rpc_reconcile_late_payment` with an explicit atomic recovery decision tree, order locking, and automated refund trigger.<br>• Hardened `rpc_complete_order_handover` with duplicate handover prevention, mandatory cash receipt assertion, and online capture verification.<br>• Authored `rpc_issue_refund` with payment row locking, partial refund ledger accounting, and cumulative cap verification.<br>• Added DB constraint `chk_cash_no_online_expiry CHECK (payment_method != 'cash_at_pickup' OR expires_at IS NULL)`. |

---

## 1. Authoritative Inventory Accounting Model

To eliminate any ambiguity in stock accounting, the platform enforces three exact stock definitions across the entire database:

```
+───────────────────────────────────────────────────────────────────────────────+
| DEFINITION 1: physical_stock (INTEGER)                                        |
| The total physical count of finished sellable units currently present in the  |
| physical shop (on display shelves, in the cake refrigerator, or juice chiller)|
+───────────────────────────────────────────────────────────────────────────────+
| DEFINITION 2: reserved_stock (INTEGER)                                        |
| The count of units committed to active transactions:                          |
| 1. Active online checkout sessions awaiting payment (under reservation TTL).  |
| 2. Confirmed orders (paid online or confirmed cash) awaiting customer pickup. |
+───────────────────────────────────────────────────────────────────────────────+
| DEFINITION 3: available_stock (COMPUTED FORMULA)                              |
| available_stock = physical_stock - reserved_stock                             |
| The net units available for new customers to add to cart and purchase.        |
+───────────────────────────────────────────────────────────────────────────────+
```

### 1.1 Authoritative Stock Accounting Lifecycle

| Operational Event | `physical_stock` | `reserved_stock` | `available_stock` | Rule & Lifecycle Invariant |
| :--- | :---: | :---: | :---: | :--- |
| **Initial Stock** | 10 | 0 | 10 | 10 sellable units present in store |
| **Customer Reserves 2 Units (Online or Cash)** | 10 | 2 | 8 | Reserved during checkout transaction |
| **Online Payment Captured Successfully** | 10 | 2 | 8 | **Reservation NOT released!** Confirmed order holds reserved stock |
| **Customer Collects 2 Units (Online or Cash)** | 8 | 0 | 8 | **Physical stock decreases on counter handover!** Reserved stock drops to 0 |
| **Another Checkout Reserves 1**| 8 | 1 | 7 | New pending checkout |
| **Online Reservation Expires** | 8 | 0 | 8 | Unpaid checkout timed out; reserved stock drops to 0 exactly once |
| **Order Cancelled Before Prep** | 8 | 0 | 8 | Reserved stock released exactly once; physical stock unchanged |
| **Damaged / Spoilage Deduction** (1 unit unreserved) | 7 | 0 | 7 | Physical write-off decrements `physical_stock` via audit log |

### 1.2 Table-Level Invariants & Check Constraints
```sql
CONSTRAINT chk_stock_balance CHECK (physical_stock >= reserved_stock),
CONSTRAINT chk_reserved_non_negative CHECK (reserved_stock >= 0),
CONSTRAINT chk_physical_non_negative CHECK (physical_stock >= 0)
```

### 1.3 Inventory Write-Offs, Spoilage, and Damage Invariant Protection
When store staff reports damaged, spoiled, or dropped items (e.g. a dropped cake or fermented juice), the database constraint `physical_stock >= reserved_stock` is actively defended:

1. **Damage $\le$ Unreserved Stock (`p_damaged_qty <= (physical_stock - reserved_stock)`):**
   - The loss is completely absorbed by available, unreserved stock.
   - `physical_stock` is decremented by `p_damaged_qty`.
   - `reserved_stock` is untouched.
   - An immutable audit log entry is recorded with reason and actor ID.
   - Active customer reservations remain 100% valid.
2. **Damage $>$ Unreserved Stock (`p_damaged_qty > (physical_stock - reserved_stock)`):**
   - The physical items damaged are committed to active customer orders!
   - Blindly reducing `physical_stock` would violate `chk_stock_balance` (causing an abort) or create a phantom order with no physical product.
   - The system **MUST NOT** silently invalidate customer reservations.
   - **Resolution Protocol:** `rpc_write_off_inventory` explicitly blocks direct write-offs when reserved units are impacted. A store manager must review the dispatch queue and explicitly cancel the impacted order(s) via `rpc_cancel_order` with reason `'cancelled_damaged_stock'`. This cancellation atomically decrements `reserved_stock`, marks online orders for automated gateway refund, and notifies the customer. Once `reserved_stock` is reduced, the physical damage write-off succeeds safely.

---

## 2. Order & Payment Lifecycle State Machines

Order status and payment status are **strictly separated** in the database to prevent conflating operational fulfillment with financial settlement. Furthermore, **Online Checkout** and **Cash-at-Pickup Checkout** follow two distinct lifecycles:

### 2.1 Distinct Checkout Lifecycles

```
================================================================================
A. ONLINE PAYMENT CHECKOUT LIFECYCLE (Razorpay)
================================================================================
[Customer Checkout] 
       │
       ▼
  order_status = 'draft'
  payment_status = 'pending'
  expires_at = NOW() + 10 min [PROPOSED TTL]
  reserved_stock += qty
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       │ (Payment Success within TTL)    │ (TTL Expires without Payment)   │ (User Aborts / Fails)
       ▼                                 ▼                                 ▼
  order_status = 'confirmed'        order_status = 'cancelled_expired' order_status = 'draft'
  payment_status = 'captured'       payment_status = 'expired'         payment_status = 'failed'
  expires_at = NULL                 reserved_stock -= qty              (Customer can retry)
  (Reservation REMAINS HELD)        (Released exactly once)
       │
       ▼ (Store Kitchen Operations)
  order_status = 'preparing'
       │
       ▼ (Counter Staging)
  order_status = 'ready_for_pickup'
       │
       ▼ (Counter Handover: Customer verified)
  order_status = 'completed'
  payment_status = 'captured' (already captured)
  physical_stock -= qty, reserved_stock -= qty atomically!

================================================================================
B. CASH-AT-PICKUP CHECKOUT LIFECYCLE
================================================================================
[Customer Checkout]
       │
       ▼
  order_status = 'confirmed' (ACCEPTED IMMEDIATELY)
  payment_status = 'unpaid'
  expires_at = NULL (NO ONLINE TTL APPLIES!)
  reserved_stock += qty
       │
       ▼ (Store Kitchen Operations)
  order_status = 'preparing'
       │
       ▼ (Counter Staging)
  order_status = 'ready_for_pickup'
       │
       ▼ (At Shop Counter)
  [Staff Verifies Collection Token]
  [Staff Collects Physical Cash & Checks Confirmation Box]
  CALL rpc_complete_order_handover(order_id, staff_id, cash_collected=true)
       │
       ▼
  order_status = 'completed'
  payment_status = 'captured' (CASH PAYMENT RECORDED)
  physical_stock -= qty, reserved_stock -= qty atomically!
```

### 2.2 State Definitions & Transition Rules

1. **`order_status_enum`:**
   - `draft`: Online order awaiting gateway payment initiation and capture. Stock is temporarily reserved under a TTL.
   - `confirmed`: Order accepted and scheduled for fulfillment. Holds active `reserved_stock`. (Online orders reach this on payment capture; cash orders reach this immediately upon placement).
   - `preparing`: Kitchen/staff actively assembling, baking, or packing items. Customer cancellation is blocked.
   - `ready_for_pickup`: Order packaged and staged on pickup counter shelf. Customer notified.
   - `completed`: Order handed over at counter. Physical stock and reserved stock decremented atomically.
   - `cancelled_expired`: Online reservation TTL lapsed without payment capture. Reserved stock released.
   - `cancelled_by_customer`: Customer cancelled prior to kitchen preparation. Reserved stock released.
   - `cancelled_by_staff`: Staff cancelled order (e.g. ingredient outage). Reserved stock released; refund triggered if paid.
   - `cancelled_damaged_stock`: Staff manager cancelled order due to physical item damage. Reserved stock released; refund triggered.
   - `cancelled_inventory_depleted`: Late payment arrived for an expired order whose stock was already claimed. Automated refund triggered.
   - `cancelled_uncollected`: Cash customer failed to collect order past operational closing or grace period `[CLIENT DECISION REQUIRED]`. Stock written off or discarded.

2. **`payment_status_enum`:**
   - `unpaid`: Specific to Cash-at-Pickup orders prior to physical counter cash collection.
   - `pending`: Initial state when an online payment session is created with Razorpay.
   - `authorized`: Gateway authorized funds; pending capture.
   - `captured`: Verified payment confirmed (online via webhook `payment.captured`, cash via staff confirmation).
   - `failed`: Payment declined or customer aborted gateway sheet.
   - `refund_pending`: Server initiated a refund request. Recorded in `refunds` table.
   - `refund_processing`: Gateway accepted refund request (`HTTP 200` from Razorpay Refunds API). Funds in transit.
   - `partially_refunded`: Partial amount refunded. (Multiple refund records supported; cumulative cap enforced).
   - `refunded`: Authoritatively confirmed via Razorpay webhook `refund.processed`.
   - `refund_failed`: Gateway reported refund failure via webhook `refund.failed`. Alerts store manager for manual intervention.

---

## 3. Database Schema Definitions (DDL)

```sql
-- Enumerated Types
CREATE TYPE order_status_enum AS ENUM (
    'draft',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'completed',
    'cancelled_expired',
    'cancelled_by_customer',
    'cancelled_by_staff',
    'cancelled_damaged_stock',
    'cancelled_inventory_depleted',
    'cancelled_uncollected'
);

CREATE TYPE payment_status_enum AS ENUM (
    'unpaid',             -- Cash at Pickup prior to counter collection
    'pending',            -- Online payment awaiting capture
    'authorized',
    'captured',
    'failed',
    'refund_pending',
    'refund_processing',
    'partially_refunded',
    'refunded',
    'refund_failed'
);

CREATE TYPE payment_method_enum AS ENUM (
    'online_razorpay',
    'cash_at_pickup'
);

CREATE TYPE staff_role_enum AS ENUM (
    'counter_staff',
    'manager',
    'admin'
);

CREATE TYPE refund_status_enum AS ENUM (
    'refund_pending',
    'refund_processing',
    'refunded',
    'refund_failed'
);

-- 1. PROFILES (Customer Profile bound to Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(100),
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 2. STAFF ROLES (Server-governed permissions)
CREATE TABLE public.staff_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role staff_role_enum NOT NULL DEFAULT 'counter_staff',
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 3. CATEGORIES
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL UNIQUE,
    slug VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 4. PRODUCTS
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL UNIQUE,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
    tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CHECK (tax_rate_pct >= 0),
    is_veg BOOLEAN NOT NULL DEFAULT true,
    allergens TEXT[] DEFAULT '{}',
    prep_time_minutes INT NOT NULL DEFAULT 15 CHECK (prep_time_minutes >= 0),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 5. INVENTORY (Authoritative Physical & Reserved Stock)
CREATE TABLE public.inventory (
    product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE RESTRICT,
    physical_stock INT NOT NULL DEFAULT 0 CHECK (physical_stock >= 0),
    reserved_stock INT NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
    low_stock_threshold INT NOT NULL DEFAULT 3 CHECK (low_stock_threshold >= 0),
    last_restocked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    -- Invariants: reserved stock cannot exceed physical stock; physical stock cannot be negative
    CONSTRAINT chk_stock_balance CHECK (physical_stock >= reserved_stock)
);

-- 6. ORDERS
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(30) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    customer_phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    fulfillment_type VARCHAR(20) NOT NULL DEFAULT 'immediate',
    scheduled_pickup_at TIMESTAMPTZ,
    estimated_pickup_at TIMESTAMPTZ NOT NULL,
    order_status order_status_enum NOT NULL DEFAULT 'draft',
    payment_status payment_status_enum NOT NULL DEFAULT 'pending',
    payment_method payment_method_enum NOT NULL,
    subtotal_amount NUMERIC(10, 2) NOT NULL CHECK (subtotal_amount >= 0),
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    packaging_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (packaging_amount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    provider_order_id VARCHAR(100),
    collection_pin VARCHAR(6),
    collection_qr_hash VARCHAR(64),
    client_idempotency_key VARCHAR(100),
    client_payload_hash VARCHAR(64),
    special_notes TEXT,
    cancellation_reason TEXT,
    expires_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ,
    collected_by_staff_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Idempotency scoped strictly to the customer
    CONSTRAINT uq_customer_idempotency UNIQUE (customer_id, client_idempotency_key),
    -- Cash orders must have payment_status 'unpaid' or 'captured'/'failed'
    CONSTRAINT chk_cash_order_state CHECK (
        payment_method != 'cash_at_pickup' OR payment_status IN ('unpaid', 'captured', 'failed')
    ),
    -- Cash orders must NOT have an online payment reservation expiration timestamp
    CONSTRAINT chk_cash_no_online_expiry CHECK (
        payment_method != 'cash_at_pickup' OR expires_at IS NULL
    )
);

CREATE INDEX idx_orders_customer ON public.orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_status ON public.orders(order_status, scheduled_pickup_at);
CREATE INDEX idx_orders_expires_at ON public.orders(expires_at) WHERE order_status = 'draft';

-- 7. ORDER ITEMS (Immutable Financial Snapshot)
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(120) NOT NULL,
    unit_price_snapshot NUMERIC(10, 2) NOT NULL CHECK (unit_price_snapshot >= 0),
    tax_rate_snapshot NUMERIC(5, 2) NOT NULL CHECK (tax_rate_snapshot >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 8. PAYMENTS (Gateway & Cash Audit Records)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    provider VARCHAR(30) NOT NULL, -- 'razorpay' or 'cash_register'
    provider_order_id VARCHAR(100),
    provider_payment_id VARCHAR(100) UNIQUE,
    provider_signature VARCHAR(255),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status payment_status_enum NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_payments_provider_id ON public.payments(provider_payment_id);

-- 9. REFUNDS (Evidence-Based Refund Ledger)
CREATE TABLE public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    provider_refund_id VARCHAR(100) UNIQUE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status refund_status_enum NOT NULL DEFAULT 'refund_pending',
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 10. AUDIT LOGS (Immutable Security Ledger)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    actor_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);
```

---

## 4. Complete Row Level Security (RLS) Policy Specifications

Row Level Security is enabled on every table.

> [!IMPORTANT]
> **No client application receives direct privileged database access.**  
> • Public catalog read access uses the Supabase Anon Key guarded by RLS.  
> • All mutations to `orders`, `inventory`, `payments`, and `refunds` are blocked from direct client execution and must route through `apps/backend-api`, which connects using the isolated Service Role key to execute secured stored procedures.

```sql
-- Role helper function with explicit search_path
CREATE OR REPLACE FUNCTION public.get_staff_role()
RETURNS staff_role_enum 
LANGUAGE sql 
SECURITY DEFINER 
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.staff_roles 
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- 1. PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Staff can view customer profiles" ON public.profiles FOR SELECT TO authenticated USING (public.get_staff_role() IS NOT NULL);

-- 2. STAFF ROLES
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view their own role" ON public.staff_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all staff roles" ON public.staff_roles FOR SELECT TO authenticated USING (public.get_staff_role() = 'admin');
CREATE POLICY "Admins can manage staff roles" ON public.staff_roles FOR ALL TO authenticated USING (public.get_staff_role() = 'admin');

-- 3. CATEGORIES
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public categories are viewable" ON public.categories FOR SELECT USING (is_active = true);
CREATE POLICY "Staff can view all categories" ON public.categories FOR SELECT TO authenticated USING (public.get_staff_role() IS NOT NULL);
CREATE POLICY "Managers can manage categories" ON public.categories FOR ALL TO authenticated USING (public.get_staff_role() IN ('manager', 'admin'));

-- 4. PRODUCTS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public products are viewable" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Staff can view all products" ON public.products FOR SELECT TO authenticated USING (public.get_staff_role() IS NOT NULL);
CREATE POLICY "Managers can manage products" ON public.products FOR ALL TO authenticated USING (public.get_staff_role() IN ('manager', 'admin'));

-- 5. INVENTORY
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Managers can update inventory" ON public.inventory FOR UPDATE TO authenticated USING (public.get_staff_role() IN ('manager', 'admin'));
CREATE POLICY "Deny direct client inventory insert/delete" ON public.inventory FOR INSERT WITH CHECK (false);

-- 6. ORDERS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own orders" ON public.orders FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Staff view all orders" ON public.orders FOR SELECT TO authenticated USING (public.get_staff_role() IS NOT NULL);
CREATE POLICY "Deny direct client order creation" ON public.orders FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct client order updates" ON public.orders FOR UPDATE USING (false);
CREATE POLICY "Deny direct client order deletion" ON public.orders FOR DELETE USING (false);

-- 7. ORDER ITEMS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own order items" ON public.order_items FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid()));
CREATE POLICY "Staff view all order items" ON public.order_items FOR SELECT TO authenticated USING (public.get_staff_role() IS NOT NULL);
CREATE POLICY "Deny direct client order items write" ON public.order_items FOR ALL WITH CHECK (false);

-- 8. PAYMENTS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own payments" ON public.payments FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND orders.customer_id = auth.uid()));
CREATE POLICY "Staff view all payments" ON public.payments FOR SELECT TO authenticated USING (public.get_staff_role() IS NOT NULL);
CREATE POLICY "Deny direct client payments write" ON public.payments FOR ALL WITH CHECK (false);

-- 9. REFUNDS
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own refunds" ON public.refunds FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = refunds.order_id AND orders.customer_id = auth.uid()));
CREATE POLICY "Staff view all refunds" ON public.refunds FOR SELECT TO authenticated USING (public.get_staff_role() IS NOT NULL);
CREATE POLICY "Deny direct client refunds write" ON public.refunds FOR ALL WITH CHECK (false);

-- 10. AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.get_staff_role() = 'admin');
CREATE POLICY "Deny client audit logs write" ON public.audit_logs FOR ALL WITH CHECK (false);
```

---

## 5. Critical Database Stored Procedures (Hardened & Scoped)

### 5.1 Multi-Product Deterministic Stock Reservation (`rpc_reserve_order_stock`)

```sql
CREATE OR REPLACE FUNCTION public.rpc_reserve_order_stock(
    p_customer_id UUID,
    p_customer_phone VARCHAR,
    p_customer_name VARCHAR,
    p_items JSONB, -- Array of {"product_id": "UUID", "quantity": INT}
    p_fulfillment VARCHAR,
    p_scheduled_pickup TIMESTAMPTZ,
    p_payment_method payment_method_enum,
    p_idempotency_key VARCHAR,
    p_payload_hash VARCHAR,
    p_special_notes TEXT
)
RETURNS TABLE (
    out_order_id UUID,
    out_order_number VARCHAR,
    out_total_amount NUMERIC,
    out_expires_at TIMESTAMPTZ,
    out_order_status order_status_enum,
    out_payment_status payment_status_enum
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_order RECORD;
    v_item RECORD;
    v_inv RECORD;
    v_product RECORD;
    v_order_id UUID;
    v_order_number VARCHAR;
    v_subtotal NUMERIC(10, 2) := 0;
    v_tax_total NUMERIC(10, 2) := 0;
    v_packaging NUMERIC(10, 2) := 0;
    v_grand_total NUMERIC(10, 2) := 0;
    v_max_prep_time INT := 15;
    v_estimated_pickup TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
    v_order_status order_status_enum;
    v_payment_status payment_status_enum;
BEGIN
    -- 1. Input Validation: Reject empty carts
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cart cannot be empty.';
    END IF;

    -- 2. Customer-Scoped Idempotency Check with Payload Hash Verification
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, order_number, total_amount, expires_at, client_payload_hash, order_status, payment_status
        INTO v_existing_order 
        FROM public.orders 
        WHERE customer_id = p_customer_id AND client_idempotency_key = p_idempotency_key;
        
        IF FOUND THEN
            -- Check if payload matches original
            IF p_payload_hash IS NOT NULL AND v_existing_order.client_payload_hash != p_payload_hash THEN
                RAISE EXCEPTION 'Idempotency key reused with mismatched order payload.';
            END IF;

            out_order_id := v_existing_order.id;
            out_order_number := v_existing_order.order_number;
            out_total_amount := v_existing_order.total_amount;
            out_expires_at := v_existing_order.expires_at;
            out_order_status := v_existing_order.order_status;
            out_payment_status := v_existing_order.payment_status;
            RETURN NEXT;
            RETURN;
        END IF;
    END IF;

    -- 3. Safely Aggregate Duplicate Product IDs & Validate Positive Quantities
    -- Locks rows deterministically in ascending product_id order
    FOR v_item IN 
        SELECT (x->>'product_id')::UUID AS product_id, SUM((x->>'quantity')::INT)::INT AS quantity
        FROM jsonb_array_elements(p_items) AS x
        GROUP BY (x->>'product_id')::UUID
        ORDER BY (x->>'product_id')::UUID ASC
    LOOP
        -- Enforce positive integer quantity
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Product quantity must be greater than zero. Received % for %', v_item.quantity, v_item.product_id;
        END IF;

        -- Check that product exists and is active
        SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;
        IF NOT FOUND OR v_product.is_active = false THEN
            RAISE EXCEPTION 'Product % is invalid or inactive.', v_item.product_id;
        END IF;

        -- Lock inventory row in deterministic ascending order
        SELECT physical_stock, reserved_stock INTO v_inv
        FROM public.inventory
        WHERE product_id = v_item.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % does not have an active inventory record.', v_item.product_id;
        END IF;

        -- Pre-validation: ensure availability for ALL items before allocating ANY stock
        IF (v_inv.physical_stock - v_inv.reserved_stock) < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product "%". Requested: %, Available: %', 
                v_product.name, v_item.quantity, (v_inv.physical_stock - v_inv.reserved_stock);
        END IF;
    END LOOP;

    -- 4. Atomic All-or-Nothing Allocation: All items verified; now reserve stock
    FOR v_item IN 
        SELECT (x->>'product_id')::UUID AS product_id, SUM((x->>'quantity')::INT)::INT AS quantity
        FROM jsonb_array_elements(p_items) AS x
        GROUP BY (x->>'product_id')::UUID
        ORDER BY (x->>'product_id')::UUID ASC
    LOOP
        UPDATE public.inventory
        SET reserved_stock = reserved_stock + v_item.quantity,
            updated_at = TIMEZONE('utc', NOW())
        WHERE product_id = v_item.product_id;

        SELECT name, base_price, tax_rate_pct, prep_time_minutes INTO v_product
        FROM public.products WHERE id = v_item.product_id;

        v_subtotal := v_subtotal + (v_product.base_price * v_item.quantity);
        v_tax_total := v_tax_total + ROUND((v_product.base_price * v_item.quantity * (v_product.tax_rate_pct / 100.0)), 2);
        
        IF v_product.prep_time_minutes > v_max_prep_time THEN
            v_max_prep_time := v_product.prep_time_minutes;
        END IF;
    END LOOP;

    v_grand_total := v_subtotal + v_tax_total + v_packaging;

    IF p_fulfillment = 'immediate' THEN
        v_estimated_pickup := TIMEZONE('utc', NOW()) + (v_max_prep_time || ' minutes')::INTERVAL;
    ELSE
        v_estimated_pickup := p_scheduled_pickup;
    END IF;

    -- 5. Delineate Lifecycles Based on Payment Method
    IF p_payment_method = 'cash_at_pickup' THEN
        -- Cash orders are accepted and confirmed immediately. No online gateway TTL applies!
        v_order_status := 'confirmed';
        v_payment_status := 'unpaid';
        v_expires_at := NULL;
    ELSE
        -- Online orders start in draft awaiting payment within the reservation window
        v_order_status := 'draft';
        v_payment_status := 'pending';
        v_expires_at := TIMEZONE('utc', NOW()) + INTERVAL '10 minutes'; -- [PROPOSED TTL]
    END IF;

    v_order_number := 'MO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- 6. Insert Order Record
    INSERT INTO public.orders (
        order_number, customer_id, customer_phone, customer_name,
        fulfillment_type, scheduled_pickup_at, estimated_pickup_at,
        order_status, payment_status, payment_method,
        subtotal_amount, tax_amount, packaging_amount, total_amount,
        client_idempotency_key, client_payload_hash, special_notes, expires_at
    ) VALUES (
        v_order_number, p_customer_id, p_customer_phone, p_customer_name,
        p_fulfillment, p_scheduled_pickup, v_estimated_pickup,
        v_order_status, v_payment_status, p_payment_method,
        v_subtotal, v_tax_total, v_packaging, v_grand_total,
        p_idempotency_key, p_payload_hash, p_special_notes, v_expires_at
    ) RETURNING id INTO v_order_id;

    -- 7. Insert Snapshot Order Items (Aggregated)
    FOR v_item IN 
        SELECT (x->>'product_id')::UUID AS product_id, SUM((x->>'quantity')::INT)::INT AS quantity
        FROM jsonb_array_elements(p_items) AS x
        GROUP BY (x->>'product_id')::UUID
        ORDER BY (x->>'product_id')::UUID ASC
    LOOP
        SELECT name, base_price, tax_rate_pct INTO v_product FROM public.products WHERE id = v_item.product_id;

        INSERT INTO public.order_items (
            order_id, product_id, product_name_snapshot,
            unit_price_snapshot, tax_rate_snapshot, quantity, line_total
        ) VALUES (
            v_order_id, v_item.product_id, v_product.name,
            v_product.base_price, v_product.tax_rate_pct, v_item.quantity,
            ROUND(v_product.base_price * v_item.quantity, 2)
        );
    END LOOP;

    out_order_id := v_order_id;
    out_order_number := v_order_number;
    out_total_amount := v_grand_total;
    out_expires_at := v_expires_at;
    out_order_status := v_order_status;
    out_payment_status := v_payment_status;
    RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_reserve_order_stock FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reserve_order_stock TO service_role;
```

---

### 5.2 Safe Expiration Worker for Online Reservations (`rpc_release_expired_reservations`)

```sql
CREATE OR REPLACE FUNCTION public.rpc_release_expired_reservations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_count INT := 0;
BEGIN
    -- Select ONLY online draft orders where the reservation TTL has expired
    -- Cash orders have payment_method = 'cash_at_pickup' and expires_at IS NULL, so they are never touched!
    FOR v_order IN 
        SELECT id FROM public.orders 
        WHERE order_status = 'draft' 
          AND payment_method = 'online_razorpay'
          AND expires_at IS NOT NULL 
          AND expires_at < TIMEZONE('utc', NOW())
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Release reserved stock in deterministic ascending order
        FOR v_item IN 
            SELECT product_id, quantity 
            FROM public.order_items 
            WHERE order_id = v_order.id 
            ORDER BY product_id ASC
        LOOP
            UPDATE public.inventory
            SET reserved_stock = GREATEST(0, reserved_stock - v_item.quantity),
                updated_at = TIMEZONE('utc', NOW())
            WHERE product_id = v_item.product_id;
        END LOOP;

        UPDATE public.orders
        SET order_status = 'cancelled_expired',
            payment_status = 'expired',
            cancellation_reason = 'Online checkout reservation TTL expired before payment capture.',
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_order.id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_release_expired_reservations FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_release_expired_reservations TO service_role;
```

---

### 5.3 Deterministic Late Payment Reconciliation (`rpc_reconcile_late_payment`)

```sql
CREATE OR REPLACE FUNCTION public.rpc_reconcile_late_payment(
    p_order_id UUID,
    p_provider_payment_id VARCHAR,
    p_provider_order_id VARCHAR,
    p_amount NUMERIC,
    p_raw_payload JSONB
)
RETURNS TABLE (
    out_action VARCHAR,
    out_order_status order_status_enum,
    out_payment_status payment_status_enum
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_inv RECORD;
    v_can_allocate BOOLEAN := true;
BEGIN
    -- Lock order row FOR UPDATE
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Authoritative Payment Verification
    IF p_amount <> v_order.total_amount THEN
        RAISE EXCEPTION 'Payment amount mismatch. Expected %, received %', v_order.total_amount, p_amount;
    END IF;

    IF v_order.provider_order_id IS NOT NULL AND p_provider_order_id <> v_order.provider_order_id THEN
        RAISE EXCEPTION 'Provider order ID mismatch. Expected %, received %', v_order.provider_order_id, p_provider_order_id;
    END IF;

    -- If order is already confirmed or completed, deduplicate payment idempotently
    IF v_order.order_status IN ('confirmed', 'preparing', 'ready_for_pickup', 'completed') THEN
        INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, status, raw_payload)
        VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'captured', p_raw_payload)
        ON CONFLICT (provider_payment_id) DO NOTHING;

        out_action := 'ALREADY_CAPTURED';
        out_order_status := v_order.order_status;
        out_payment_status := v_order.payment_status;
        RETURN NEXT;
        RETURN;
    END IF;

    -- If order was explicitly cancelled by customer or staff, DO NOT revive even if stock is available
    IF v_order.order_status IN ('cancelled_by_customer', 'cancelled_by_staff', 'cancelled_damaged_stock') THEN
        INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, status, raw_payload)
        VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'refund_pending', p_raw_payload)
        ON CONFLICT (provider_payment_id) DO NOTHING;

        UPDATE public.orders 
        SET payment_status = 'refund_pending', updated_at = NOW() 
        WHERE id = p_order_id;

        out_action := 'TRIGGER_REFUND_MANUAL_CANCEL';
        out_order_status := v_order.order_status;
        out_payment_status := 'refund_pending';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Late payment path: Only orders with order_status = 'cancelled_expired' reach here
    -- Evaluate atomic recovery decision: lock inventory rows deterministically
    FOR v_item IN 
        SELECT product_id, quantity 
        FROM public.order_items 
        WHERE order_id = p_order_id 
        ORDER BY product_id ASC
    LOOP
        SELECT physical_stock, reserved_stock INTO v_inv
        FROM public.inventory 
        WHERE product_id = v_item.product_id 
        FOR UPDATE;
        
        IF (v_inv.physical_stock - v_inv.reserved_stock) < v_item.quantity THEN
            v_can_allocate := false;
            EXIT;
        END IF;
    END LOOP;

    -- Branch: Perform valid explicit recovery transition OR route to evidence-based refund
    IF v_can_allocate THEN
        -- Re-reserve stock atomically
        FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id ASC
        LOOP
            UPDATE public.inventory 
            SET reserved_stock = reserved_stock + v_item.quantity,
                updated_at = TIMEZONE('utc', NOW())
            WHERE product_id = v_item.product_id;
        END LOOP;

        INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, status, raw_payload)
        VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'captured', p_raw_payload)
        ON CONFLICT (provider_payment_id) DO NOTHING;

        UPDATE public.orders 
        SET order_status = 'confirmed', 
            payment_status = 'captured', 
            expires_at = NULL, 
            cancellation_reason = NULL,
            updated_at = NOW() 
        WHERE id = p_order_id;

        out_action := 'CONFIRMED_REALLOCATED';
        out_order_status := 'confirmed';
        out_payment_status := 'captured';
    ELSE
        -- Inventory depleted by another customer; DO NOT oversell. Record payment as refund_pending
        INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, status, raw_payload)
        VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'refund_pending', p_raw_payload)
        ON CONFLICT (provider_payment_id) DO NOTHING;

        UPDATE public.orders 
        SET order_status = 'cancelled_inventory_depleted', 
            payment_status = 'refund_pending', 
            cancellation_reason = 'Late payment received after reservation expired; stock claimed by another order.',
            updated_at = NOW() 
        WHERE id = p_order_id;

        out_action := 'TRIGGER_REFUND';
        out_order_status := 'cancelled_inventory_depleted';
        out_payment_status := 'refund_pending';
    END IF;

    RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_reconcile_late_payment FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reconcile_late_payment TO service_role;
```

---

### 5.4 Deterministic Order Handover & Cash Verification (`rpc_complete_order_handover`)

```sql
CREATE OR REPLACE FUNCTION public.rpc_complete_order_handover(
    p_order_id UUID,
    p_staff_id UUID,
    p_cash_collected BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Prevent completing an already completed order
    IF v_order.order_status = 'completed' THEN
        RAISE EXCEPTION 'Order % is already completed.', p_order_id;
    END IF;

    IF v_order.order_status != 'ready_for_pickup' THEN
        RAISE EXCEPTION 'Order is not ready for pickup. Current status: %', v_order.order_status;
    END IF;

    -- Cash at Pickup: Ensure staff confirmed physical cash receipt
    IF v_order.payment_method = 'cash_at_pickup' THEN
        IF p_cash_collected IS NOT TRUE THEN
            RAISE EXCEPTION 'Cannot complete cash order without staff confirmation of cash receipt.';
        END IF;

        -- Record cash payment
        INSERT INTO public.payments (order_id, provider, amount, status, raw_payload)
        VALUES (p_order_id, 'cash_register', v_order.total_amount, 'captured', jsonb_build_object('collected_by', p_staff_id));

        UPDATE public.orders SET payment_status = 'captured' WHERE id = p_order_id;
    ELSE
        -- Online order: Must already have payment_status = 'captured'
        IF v_order.payment_status != 'captured' THEN
            RAISE EXCEPTION 'Cannot complete online order: payment is not captured. Current payment status: %', v_order.payment_status;
        END IF;
    END IF;

    -- Decrement physical_stock and reserved_stock in deterministic ascending order
    FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id ASC
    LOOP
        UPDATE public.inventory
        SET physical_stock = physical_stock - v_item.quantity,
            reserved_stock = GREATEST(0, reserved_stock - v_item.quantity),
            updated_at = TIMEZONE('utc', NOW())
        WHERE product_id = v_item.product_id;
    END LOOP;

    -- Complete order
    UPDATE public.orders 
    SET order_status = 'completed', 
        collected_at = NOW(), 
        collected_by_staff_id = p_staff_id,
        updated_at = NOW() 
    WHERE id = p_order_id;

    RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_complete_order_handover FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_complete_order_handover TO service_role;
```

---

### 5.5 Protected Inventory Write-Off (`rpc_write_off_inventory`)

```sql
CREATE OR REPLACE FUNCTION public.rpc_write_off_inventory(
    p_product_id UUID,
    p_damaged_quantity INT,
    p_staff_id UUID,
    p_reason TEXT
)
RETURNS TABLE (
    out_physical_stock INT,
    out_reserved_stock INT,
    out_available_stock INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv RECORD;
    v_available INT;
BEGIN
    IF p_damaged_quantity <= 0 THEN
        RAISE EXCEPTION 'Damaged quantity must be greater than zero. Received: %', p_damaged_quantity;
    END IF;

    -- Lock the inventory row
    SELECT * INTO v_inv 
    FROM public.inventory 
    WHERE product_id = p_product_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record for product % not found', p_product_id;
    END IF;

    v_available := v_inv.physical_stock - v_inv.reserved_stock;

    -- Case 1: Damage can be absorbed by unreserved available stock
    IF p_damaged_quantity <= v_available THEN
        UPDATE public.inventory
        SET physical_stock = physical_stock - p_damaged_quantity,
            updated_at = TIMEZONE('utc', NOW())
        WHERE product_id = p_product_id;

        -- Record audit log
        INSERT INTO public.audit_logs (
            actor_id, actor_role, action, entity_type, entity_id,
            old_values, new_values
        ) VALUES (
            p_staff_id, 'staff', 'INVENTORY_WRITE_OFF', 'inventory', p_product_id::TEXT,
            jsonb_build_object('physical_stock', v_inv.physical_stock, 'reserved_stock', v_inv.reserved_stock),
            jsonb_build_object('physical_stock', v_inv.physical_stock - p_damaged_quantity, 'reserved_stock', v_inv.reserved_stock, 'reason', p_reason)
        );

        out_physical_stock := v_inv.physical_stock - p_damaged_quantity;
        out_reserved_stock := v_inv.reserved_stock;
        out_available_stock := out_physical_stock - out_reserved_stock;
        RETURN NEXT;
        RETURN;
    ELSE
        -- Case 2: Damage exceeds unreserved stock! 
        -- Physical items committed to active customer reservations are affected.
        -- Prohibit silent invalidation or constraint violation.
        RAISE EXCEPTION 'INVENTORY_WRITE_OFF_BLOCKED: Damaged quantity (%) exceeds unreserved stock (%). % active reserved unit(s) are impacted. Manager must explicitly cancel and refund affected customer order(s) via rpc_cancel_order before this physical stock can be written off.',
            p_damaged_quantity, v_available, (p_damaged_quantity - v_available);
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_write_off_inventory FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_write_off_inventory TO service_role;
```

---

### 5.6 Deterministic Order Cancellation (`rpc_cancel_order`)

```sql
CREATE OR REPLACE FUNCTION public.rpc_cancel_order(
    p_order_id UUID,
    p_actor_id UUID,
    p_reason TEXT,
    p_is_staff BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_new_status order_status_enum;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Customer cancellation: only allowed while draft or confirmed (before kitchen prep)
    IF NOT p_is_staff AND v_order.order_status NOT IN ('draft', 'confirmed') THEN
        RAISE EXCEPTION 'Customer cannot cancel order once preparation has begun.';
    END IF;

    IF p_is_staff THEN
        IF p_reason = 'damaged_stock' THEN
            v_new_status := 'cancelled_damaged_stock';
        ELSE
            v_new_status := 'cancelled_by_staff';
        END IF;
    ELSE
        v_new_status := 'cancelled_by_customer';
    END IF;

    -- Release reserved_stock in deterministic order exactly once
    FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id ASC
    LOOP
        UPDATE public.inventory
        SET reserved_stock = GREATEST(0, reserved_stock - v_item.quantity),
            updated_at = TIMEZONE('utc', NOW())
        WHERE product_id = v_item.product_id;
    END LOOP;

    -- Update order status
    UPDATE public.orders 
    SET order_status = v_new_status, 
        cancellation_reason = p_reason,
        updated_at = NOW() 
    WHERE id = p_order_id;

    -- If order was paid online, mark for refund
    IF v_order.payment_method = 'online_razorpay' AND v_order.payment_status = 'captured' THEN
        UPDATE public.orders SET payment_status = 'refund_pending' WHERE id = p_order_id;
    END IF;

    RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_cancel_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_order TO service_role;
```

---

### 5.7 Authoritative Partial/Full Refund Initiation (`rpc_issue_refund`)

```sql
CREATE OR REPLACE FUNCTION public.rpc_issue_refund(
    p_order_id UUID,
    p_refund_amount NUMERIC,
    p_staff_id UUID,
    p_reason TEXT,
    p_idempotency_key VARCHAR
)
RETURNS TABLE (
    out_refund_id UUID,
    out_status refund_status_enum,
    out_remaining_refundable NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_payment RECORD;
    v_existing_refund RECORD;
    v_total_refunded NUMERIC := 0;
    v_remaining NUMERIC;
    v_refund_id UUID;
BEGIN
    IF p_refund_amount <= 0 THEN
        RAISE EXCEPTION 'Refund amount must be greater than zero. Received: %', p_refund_amount;
    END IF;

    -- Lock the order row
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Lock the payment row
    SELECT * INTO v_payment 
    FROM public.payments 
    WHERE order_id = p_order_id AND status = 'captured' 
    ORDER BY created_at DESC LIMIT 1 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No captured payment found for order %', p_order_id;
    END IF;

    -- Check idempotency key for refund
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, status INTO v_existing_refund 
        FROM public.refunds 
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            out_refund_id := v_existing_refund.id;
            out_status := v_existing_refund.status;
            out_remaining_refundable := 0;
            RETURN NEXT;
            RETURN;
        END IF;
    END IF;

    -- Calculate existing active refunds
    SELECT COALESCE(SUM(amount), 0) INTO v_total_refunded
    FROM public.refunds
    WHERE payment_id = v_payment.id AND status IN ('refund_pending', 'refund_processing', 'refunded');

    v_remaining := v_payment.amount - v_total_refunded;

    IF p_refund_amount > v_remaining THEN
        RAISE EXCEPTION 'REFUND_EXCEEDS_REMAINING_AMOUNT: Requested % exceeds remaining refundable amount (%). Captured: %, Previously refunded/processing: %',
            p_refund_amount, v_remaining, v_payment.amount, v_total_refunded;
    END IF;

    -- Insert new refund record in refund_pending status
    INSERT INTO public.refunds (
        order_id, payment_id, amount, status, reason, idempotency_key
    ) VALUES (
        p_order_id, v_payment.id, p_refund_amount, 'refund_pending', p_reason, p_idempotency_key
    ) RETURNING id INTO v_refund_id;

    -- Update order payment status to reflect ongoing refund
    UPDATE public.orders 
    SET payment_status = 'refund_pending', updated_at = NOW() 
    WHERE id = p_order_id;

    out_refund_id := v_refund_id;
    out_status := 'refund_pending';
    out_remaining_refundable := v_remaining - p_refund_amount;
    RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_issue_refund FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_issue_refund TO service_role;
```
