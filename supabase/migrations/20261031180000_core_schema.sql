-- ==============================================================================
-- Moody Orange — Migration 1: Core Schema, Custom Types, Tables & Constraints
-- Document Reference: docs/phase-0/DATABASE_DESIGN.md
-- ==============================================================================

-- 1. Prerequisites & Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enumerated Types
DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM (
        'unpaid',             -- Specific to Cash at Pickup prior to physical collection
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
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM (
        'online_razorpay',
        'cash_at_pickup'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE staff_role_enum AS ENUM (
        'counter_staff',
        'manager',
        'admin'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE refund_status_enum AS ENUM (
        'refund_pending',
        'refund_processing',
        'refunded',
        'refund_failed'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Table Definitions

-- Table 1: PROFILES (Customer Profile bound to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(100),
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Table 2: STAFF ROLES (Server-governed permissions)
CREATE TABLE IF NOT EXISTS public.staff_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role staff_role_enum NOT NULL DEFAULT 'counter_staff',
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Table 3: CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL UNIQUE,
    slug VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Table 4: PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL UNIQUE,
    description TEXT,
    base_price BIGINT NOT NULL CONSTRAINT chk_base_price_non_negative CHECK (base_price >= 0),
    tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CONSTRAINT chk_tax_rate_non_negative CHECK (tax_rate_pct >= 0),
    is_veg BOOLEAN NOT NULL DEFAULT true,
    allergens TEXT[] NOT NULL DEFAULT '{}',
    prep_time_minutes INT NOT NULL DEFAULT 15 CONSTRAINT chk_prep_time_non_negative CHECK (prep_time_minutes >= 0),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Table 5: INVENTORY (Authoritative Physical & Reserved Stock)
CREATE TABLE IF NOT EXISTS public.inventory (
    product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE RESTRICT,
    physical_stock INT NOT NULL DEFAULT 0 CONSTRAINT chk_physical_non_negative CHECK (physical_stock >= 0),
    reserved_stock INT NOT NULL DEFAULT 0 CONSTRAINT chk_reserved_non_negative CHECK (reserved_stock >= 0),
    low_stock_threshold INT NOT NULL DEFAULT 3 CONSTRAINT chk_low_stock_non_negative CHECK (low_stock_threshold >= 0),
    last_restocked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    -- Invariant: reserved stock cannot exceed physical stock
    CONSTRAINT chk_stock_balance CHECK (physical_stock >= reserved_stock)
);

-- Table 6: ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
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
    subtotal_amount BIGINT NOT NULL CONSTRAINT chk_subtotal_amount_non_negative CHECK (subtotal_amount >= 0),
    tax_amount BIGINT NOT NULL DEFAULT 0 CONSTRAINT chk_tax_amount_non_negative CHECK (tax_amount >= 0),
    packaging_amount BIGINT NOT NULL DEFAULT 0 CONSTRAINT chk_packaging_amount_non_negative CHECK (packaging_amount >= 0),
    total_amount BIGINT NOT NULL CONSTRAINT chk_total_amount_non_negative CHECK (total_amount >= 0),
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

-- Table 7: ORDER ITEMS (Immutable Financial Snapshot)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(120) NOT NULL,
    unit_price_snapshot BIGINT NOT NULL CONSTRAINT chk_item_unit_price_non_negative CHECK (unit_price_snapshot >= 0),
    tax_rate_snapshot NUMERIC(5, 2) NOT NULL CONSTRAINT chk_item_tax_rate_non_negative CHECK (tax_rate_snapshot >= 0),
    quantity INT NOT NULL CONSTRAINT chk_item_quantity_positive CHECK (quantity > 0),
    line_total BIGINT NOT NULL CONSTRAINT chk_item_line_total_non_negative CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Table 8: PAYMENTS (Gateway & Cash Audit Records)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    provider VARCHAR(30) NOT NULL, -- 'razorpay' or 'cash_register'
    provider_order_id VARCHAR(100),
    provider_payment_id VARCHAR(100) UNIQUE,
    provider_signature VARCHAR(255),
    amount BIGINT NOT NULL CONSTRAINT chk_payment_amount_positive CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status payment_status_enum NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Table 9: REFUNDS (Evidence-Based Refund Ledger)
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    provider_refund_id VARCHAR(100) UNIQUE,
    amount BIGINT NOT NULL CONSTRAINT chk_refund_amount_positive CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status refund_status_enum NOT NULL DEFAULT 'refund_pending',
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Table 10: AUDIT LOGS (Immutable Security Ledger)
CREATE TABLE IF NOT EXISTS public.audit_logs (
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

-- 4. Indexes for Query Performance & Foreign Key Traversal
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status, scheduled_pickup_at);
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON public.orders(expires_at) WHERE order_status = 'draft';

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON public.payments(provider_payment_id);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON public.refunds(order_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

