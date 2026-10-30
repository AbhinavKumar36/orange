# Moody Orange — Database Architecture & Schema Specification

**Document Version:** 1.2.0 (Phase 0.2 Final Consistency Review)  
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
| **1.2.0** | 2026-10-30 | Lead Architect | **Phase 0.2 Final Consistency Review:**<br>• Enforced `physical_stock` consistently across all tables, constraints, RPCs, and ERD (eliminated `current_stock`).<br>• Implemented deterministic multi-product row locking (`ORDER BY product_id ASC`) and atomic all-or-nothing validation in `rpc_reserve_order_stock`.<br>• Expanded `payment_status_enum` to include `refund_pending`, `refund_processing`, `partially_refunded`, and `refund_failed`.<br>• Clarified evidence-based refund progression: gateway acceptance sets `refund_processing`; `refunded` set only upon `refund.processed` webhook.<br>• Reaffirmed zero direct privileged database access for client applications. |

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
pending ──► captured (or paid) ──► refund_pending ──► refund_processing ──► refunded
   │                                                         │
   └─► failed                                                └─► refund_failed
```

### 2.2 Payment & Refund Lifecycle States Detailed
1. `pending`: Initial state when payment session is created with Razorpay.
2. `authorized`: Gateway authorized funds; pending auto-capture (if manual capture configured).
3. `captured`: Gateway confirmed funds captured via verified webhook (`payment.captured`). **Does NOT release stock reservation.**
4. `failed`: Customer payment declined or aborted.
5. `refund_pending`: Server initiated a refund request (e.g. late webhook or staff cancellation).
6. `refund_processing`: Gateway accepted refund request (`HTTP 200` to refund API). **Money is in transit; NOT yet confirmed refunded!**
7. `partially_refunded`: Partial amount refunded.
8. `refunded`: Authoritatively confirmed via Razorpay webhook `refund.processed`.
9. `refund_failed`: Gateway reported refund failure via webhook `refund.failed`. Alerts store manager for manual intervention.

---

## 3. Database Schema Definitions (DDL)

```sql
-- Enumerated Types
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
    'pending',
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
    collection_pin VARCHAR(6),
    collection_qr_hash VARCHAR(64),
    client_idempotency_key VARCHAR(100) UNIQUE,
    special_notes TEXT,
    cancellation_reason TEXT,
    expires_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ,
    collected_by_staff_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
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

-- 8. PAYMENTS (Gateway Audit Records)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    provider VARCHAR(30) NOT NULL,
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
    status VARCHAR(30) NOT NULL DEFAULT 'refund_processing', -- 'refund_processing', 'refunded', 'refund_failed'
    idempotency_key VARCHAR(100) UNIQUE,
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

## 4. Row Level Security (RLS) & Access Boundaries

Row Level Security is enabled on every table.

> [!IMPORTANT]
> **No client application—neither Customer Web, Android App, nor Admin Web—receives direct privileged database access.**  
> • Public catalog read access uses the Supabase Anon Key guarded by RLS.  
> • All mutations to `orders`, `inventory`, `payments`, and `refunds` are blocked from direct client execution and must route through `apps/backend-api`, which connects using the isolated Service Role key to execute secured stored procedures.

```sql
-- Role helper function
CREATE OR REPLACE FUNCTION public.get_staff_role()
RETURNS staff_role_enum AS $$
  SELECT role FROM public.staff_roles 
  WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Public Catalog Read Access
CREATE POLICY "Public categories are viewable" ON public.categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public products are viewable" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Public inventory availability is viewable" ON public.inventory FOR SELECT USING (true);

-- Customer Data Isolation
CREATE POLICY "Customers view own orders" ON public.orders FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customers view own order items" ON public.order_items FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid()));

-- Staff Read Access
CREATE POLICY "Staff view all orders" ON public.orders FOR SELECT TO authenticated USING (public.get_staff_role() IS NOT NULL);
CREATE POLICY "Staff view order items" ON public.order_items FOR SELECT TO authenticated USING (public.get_staff_role() IS NOT NULL);

-- Block Direct Client Writes
CREATE POLICY "Deny direct client order insertion" ON public.orders FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct client order updates" ON public.orders FOR UPDATE USING (false);
CREATE POLICY "Deny direct client inventory modification" ON public.inventory FOR UPDATE USING (false);
```

---

## 5. Critical Database Stored Procedures (RPCs)

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
BEGIN
    -- 1. Idempotency Check: Return existing order if client retried with same key
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, order_number, total_amount, expires_at 
        INTO v_existing_order 
        FROM public.orders 
        WHERE client_idempotency_key = p_idempotency_key;
        
        IF FOUND THEN
            out_order_id := v_existing_order.id;
            out_order_number := v_existing_order.order_number;
            out_total_amount := v_existing_order.total_amount;
            out_expires_at := v_existing_order.expires_at;
            RETURN NEXT;
            RETURN;
        END IF;
    END IF;

    -- 2. Deterministic Row-Locking & Pre-validation: Lock inventory in sorted order to prevent deadlocks
    FOR v_item IN 
        SELECT (x->>'product_id')::UUID AS product_id, (x->>'quantity')::INT AS quantity
        FROM jsonb_array_elements(p_items) AS x
        ORDER BY (x->>'product_id')::UUID ASC
    LOOP
        SELECT physical_stock, reserved_stock INTO v_inv
        FROM public.inventory
        WHERE product_id = v_item.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % is invalid or does not have inventory tracking.', v_item.product_id;
        END IF;

        -- Validate availability for EVERY item before modifying ANY stock
        IF (v_inv.physical_stock - v_inv.reserved_stock) < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product %. Requested: %, Available: %', 
                v_item.product_id, v_item.quantity, (v_inv.physical_stock - v_inv.reserved_stock);
        END IF;
    END LOOP;

    -- 3. Atomic Allocation: All items verified; now reserve stock and compute prices
    FOR v_item IN 
        SELECT (x->>'product_id')::UUID AS product_id, (x->>'quantity')::INT AS quantity
        FROM jsonb_array_elements(p_items) AS x
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

    -- Generate human-readable order number
    v_order_number := 'MO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- 4. Create Draft Order
    INSERT INTO public.orders (
        order_number, customer_id, customer_phone, customer_name,
        fulfillment_type, scheduled_pickup_at, estimated_pickup_at,
        order_status, payment_status, payment_method,
        subtotal_amount, tax_amount, packaging_amount, total_amount,
        client_idempotency_key, special_notes, expires_at
    ) VALUES (
        v_order_number, p_customer_id, p_customer_phone, p_customer_name,
        p_fulfillment, p_scheduled_pickup, v_estimated_pickup,
        'draft', 'pending', p_payment_method,
        v_subtotal, v_tax_total, v_packaging, v_grand_total,
        p_idempotency_key, p_special_notes, v_expires_at
    ) RETURNING id INTO v_order_id;

    -- 5. Insert Snapshot Order Items
    FOR v_item IN SELECT (x->>'product_id')::UUID AS product_id, (x->>'quantity')::INT AS quantity FROM jsonb_array_elements(p_items) AS x
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
```

---

### 5.2 Late Webhook Reconciliation (`rpc_reconcile_late_payment`)

```sql
CREATE OR REPLACE FUNCTION public.rpc_reconcile_late_payment(
    p_order_id UUID,
    p_provider_payment_id VARCHAR,
    p_amount NUMERIC,
    p_raw_payload JSONB
)
RETURNS TABLE (
    out_action VARCHAR, -- 'CONFIRMED_REALLOCATED' or 'TRIGGER_REFUND'
    out_order_status order_status_enum,
    out_payment_status payment_status_enum
)
LANGUAGE plpgsql
SECURITY DEFINER
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

    -- 1. Check if all items can be re-allocated in sorted deterministic order
    FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id ASC
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

    -- 2. Branch: Reallocate OR Mark for Refund
    IF v_can_allocate THEN
        -- Re-reserve stock
        FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id
        LOOP
            UPDATE public.inventory 
            SET reserved_stock = reserved_stock + v_item.quantity 
            WHERE product_id = v_item.product_id;
        END LOOP;

        INSERT INTO public.payments (order_id, provider, provider_payment_id, amount, status, raw_payload)
        VALUES (p_order_id, 'razorpay', p_provider_payment_id, p_amount, 'captured', p_raw_payload)
        ON CONFLICT (provider_payment_id) DO NOTHING;

        UPDATE public.orders 
        SET order_status = 'confirmed', payment_status = 'captured', updated_at = NOW() 
        WHERE id = p_order_id;

        out_action := 'CONFIRMED_REALLOCATED';
        out_order_status := 'confirmed';
        out_payment_status := 'captured';
    ELSE
        -- Inventory is depleted; set payment to refund_pending
        INSERT INTO public.payments (order_id, provider, provider_payment_id, amount, status, raw_payload)
        VALUES (p_order_id, 'razorpay', p_provider_payment_id, p_amount, 'refund_pending', p_raw_payload)
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
```
