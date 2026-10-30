# Moody Orange — Database Architecture & Schema Specification

**Document Version:** 1.3.0 (Phase 0.3 Final Consistency Pass)  
**Phase:** Phase 0 (Requirements & Architecture)  
**Status:** Pending Client Review & Sign-Off  
**Database Engine:** PostgreSQL 15+ (Hosted on Supabase)  
**Repository:** [https://github.com/AbhinavKumar36/orange](https://github.com/AbhinavKumar36/orange)  

---

## Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-30 | Lead Architect | Initial schema definitions, tables, and RLS policies. |
| **1.1.0** | 2026-10-30 | Lead Architect | Phase 0.1 Revision: Decoupled Backend API and added initial late webhook handling. |
| **1.2.0** | 2026-10-30 | Lead Architect | Phase 0.2 Revision: Standardized `physical_stock` and multi-product deterministic row locks. |
| **1.3.0** | 2026-10-30 | Lead Architect | **Phase 0.3 Final Consistency Pass:**<br>• Hardened `rpc_reserve_order_stock`: aggregated duplicate product IDs, enforced positive quantities, rejected empty carts and inactive products.<br>• Scoped checkout idempotency keys strictly to authenticated customers with payload hash verification.<br>• Separated cash-at-pickup (`unpaid` state) from online payment gateway states; blocked cash order completion without verified cash payment.<br>• Enforced deterministic `ORDER BY product_id ASC FOR UPDATE` locking across ALL inventory-modifying procedures (checkout, cancellation, handover, late payment).<br>• Hardened `SECURITY DEFINER` functions with explicit `search_path = public, pg_temp` and restricted `EXECUTE` privileges.<br>• Defined complete RLS policies across all 10 database tables. |

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
| 1. Active checkout sessions awaiting payment (locked under a 10-minute TTL).  |
| 2. Confirmed orders (paid online or confirmed cash) awaiting customer pickup. |
+───────────────────────────────────────────────────────────────────────────────+
| DEFINITION 3: available_stock (COMPUTED FORMULA)                              |
| available_stock = physical_stock - reserved_stock                             |
| The net units available for new customers to add to cart and purchase.        |
+───────────────────────────────────────────────────────────────────────────────+
```

### 1.1 Authoritative Stock Accounting Example

| Operational Event | `physical_stock` | `reserved_stock` | `available_stock` | Rule & Lifecycle Note |
| :--- | :---: | :---: | :---: | :--- |
| **Initial Stock** | 10 | 0 | 10 | 10 sellable units present in store |
| **Customer Reserves 2 Units** | 10 | 2 | 8 | Reserved during checkout transaction |
| **Payment Captured Successfully** | 10 | 2 | 8 | **Reservation NOT released!** Confirmed order holds reserved stock |
| **Customer Collects 2 Units** | 8 | 0 | 8 | **Physical stock decreases on counter handover!** Reserved stock drops to 0 |
| **Another Checkout Reserves 1**| 8 | 1 | 7 | New pending checkout |
| **Reservation Expires** | 8 | 0 | 8 | Unpaid checkout timed out; reserved stock drops to 0 |
| **Damaged / Spoilage Deduction** (1 unit) | 7 | 0 | 7 | Physical write-off decrements `physical_stock` via audit log |

---

## 2. Order & Payment Lifecycle State Machines

### 2.1 Complete State Transition Pipelines

Order status and payment status are **strictly separated** in the database:

```
ORDER STATUS PIPELINE:
draft -> payment_pending -> confirmed -> preparing -> ready_for_pickup -> completed
           │                   │
           ├─► expired         ├─► cancelled_by_customer (if permitted)
           │                   └─► cancelled_by_staff
           └─► cancelled_inventory_depleted (late payment when stock is sold out)

PAYMENT STATUS PIPELINE:
Online:  pending ──► captured (or paid) ──► refund_pending ──► refund_processing ──► refunded
            │                                                               │
            └─► failed                                                      └─► refund_failed

Cash:    unpaid ──────────────────────────────────────────────────────────────► paid (upon counter collection)
            │
            └─► cancelled (if order cancelled before collection)
```

### 2.2 Payment & Refund Lifecycle States Detailed
1. `unpaid`: Specific to Cash-at-Pickup orders prior to physical counter collection.
2. `pending`: Initial state when an online payment session is created with Razorpay.
3. `authorized`: Gateway authorized funds; pending auto-capture (if manual capture configured).
4. `captured`: Gateway confirmed funds captured via verified webhook (`payment.captured`). **Does NOT release stock reservation.**
5. `failed`: Customer payment declined or aborted.
6. `refund_pending`: Server initiated a refund request (e.g., late webhook arrival or staff cancellation). Recorded in `refunds` table.
7. `refund_processing`: Gateway accepted refund request (`HTTP 200` to Razorpay Refunds API). **Funds are in transit; NOT yet confirmed refunded!**
8. `partially_refunded`: Partial amount refunded.
9. `refunded`: Authoritatively confirmed via Razorpay webhook `refund.processed`.
10. `refund_failed`: Gateway reported refund failure via webhook `refund.failed`. Alerts store manager for manual intervention.

---

## 3. Database Schema Definitions (DDL)

```sql
-- Custom Enumerated Types
CREATE TYPE order_status_enum AS ENUM (
    'draft',
    'payment_pending',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'completed',
    'expired',
    'cancelled_by_customer',
    'cancelled_by_staff',
    'cancelled_inventory_depleted'
);

CREATE TYPE payment_status_enum AS ENUM (
    'unpaid',             -- Cash at Pickup prior to collection
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
    'pending',
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
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(60) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
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
    -- Ensures reserved stock can never exceed total physical stock on hand
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
    -- Cash orders must have payment_status 'unpaid' or 'captured'/'paid'
    CONSTRAINT chk_cash_order_state CHECK (
        payment_method != 'cash_at_pickup' OR payment_status IN ('unpaid', 'captured', 'failed')
    )
);

CREATE INDEX idx_orders_customer ON public.orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_status ON public.orders(order_status, scheduled_pickup_at);
CREATE INDEX idx_orders_expires_at ON public.orders(expires_at) WHERE order_status IN ('draft', 'payment_pending');

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
    status refund_status_enum NOT NULL DEFAULT 'pending',
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

Every table has Row Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

> [!IMPORTANT]
> **No client application—neither Customer Web, Android App, nor Admin Web—receives direct privileged database access.**  
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
    out_expires_at TIMESTAMPTZ
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
    v_expires_at TIMESTAMPTZ := TIMEZONE('utc', NOW()) + INTERVAL '10 minutes';
    v_payment_status payment_status_enum;
BEGIN
    -- 1. Input Validation: Reject empty carts
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cart cannot be empty.';
    END IF;

    -- 2. Customer-Scoped Idempotency Check with Payload Hash Verification
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, order_number, total_amount, expires_at, client_payload_hash 
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

    -- Set initial payment status based on payment method
    IF p_payment_method = 'cash_at_pickup' THEN
        v_payment_status := 'unpaid';
    ELSE
        v_payment_status := 'pending';
    END IF;

    v_order_number := 'MO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- 5. Create Draft Order
    INSERT INTO public.orders (
        order_number, customer_id, customer_phone, customer_name,
        fulfillment_type, scheduled_pickup_at, estimated_pickup_at,
        order_status, payment_status, payment_method,
        subtotal_amount, tax_amount, packaging_amount, total_amount,
        client_idempotency_key, client_payload_hash, special_notes, expires_at
    ) VALUES (
        v_order_number, p_customer_id, p_customer_phone, p_customer_name,
        p_fulfillment, p_scheduled_pickup, v_estimated_pickup,
        'draft', v_payment_status, p_payment_method,
        v_subtotal, v_tax_total, v_packaging, v_grand_total,
        p_idempotency_key, p_payload_hash, p_special_notes, v_expires_at
    ) RETURNING id INTO v_order_id;

    -- 6. Insert Snapshot Order Items
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
    RETURN NEXT;
END;
$$;

-- Restrict execution strictly to service_role (Backend API)
REVOKE EXECUTE ON FUNCTION public.rpc_reserve_order_stock FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reserve_order_stock TO service_role;
```

---

### 5.2 Deterministic Late Payment Reconciliation (`rpc_reconcile_late_payment`)

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
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Authoritative Payment Verification: Amount and Provider Order ID MUST match
    IF p_amount <> v_order.total_amount THEN
        RAISE EXCEPTION 'Payment amount mismatch. Expected %, received %', v_order.total_amount, p_amount;
    END IF;

    IF v_order.provider_order_id IS NOT NULL AND p_provider_order_id <> v_order.provider_order_id THEN
        RAISE EXCEPTION 'Provider order ID mismatch. Expected %, received %', v_order.provider_order_id, p_provider_order_id;
    END IF;

    -- 1. Check if all items can be re-allocated in deterministic ascending order
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

    -- 2. Branch: Reallocate OR Mark for Evidence-Based Refund
    IF v_can_allocate THEN
        FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id ASC
        LOOP
            UPDATE public.inventory 
            SET reserved_stock = reserved_stock + v_item.quantity 
            WHERE product_id = v_item.product_id;
        END LOOP;

        INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, status, raw_payload)
        VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'captured', p_raw_payload)
        ON CONFLICT (provider_payment_id) DO NOTHING;

        UPDATE public.orders 
        SET order_status = 'confirmed', payment_status = 'captured', updated_at = NOW() 
        WHERE id = p_order_id;

        out_action := 'CONFIRMED_REALLOCATED';
        out_order_status := 'confirmed';
        out_payment_status := 'captured';
    ELSE
        -- Inventory depleted; record payment as refund_pending
        INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, status, raw_payload)
        VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'refund_pending', p_raw_payload)
        ON CONFLICT (provider_payment_id) DO NOTHING;

        UPDATE public.orders 
        SET order_status = 'cancelled_inventory_depleted', 
            payment_status = 'refund_pending', 
            cancellation_reason = 'Payment received after reservation expired; stock depleted by another order.',
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

### 5.3 Deterministic Order Handover & Cash Verification (`rpc_complete_order_handover`)

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
    END IF;

    -- Decrement physical_stock and reserved_stock in deterministic order
    FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id ASC
    LOOP
        UPDATE public.inventory
        SET physical_stock = physical_stock - v_item.quantity,
            reserved_stock = reserved_stock - v_item.quantity,
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

### 5.4 Deterministic Order Cancellation (`rpc_cancel_order`)

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
        v_new_status := 'cancelled_by_staff';
    ELSE
        v_new_status := 'cancelled_by_customer';
    END IF;

    -- Release reserved_stock in deterministic order
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
