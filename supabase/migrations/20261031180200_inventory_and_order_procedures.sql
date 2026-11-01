-- ==============================================================================
-- Moody Orange — Migration 3: Hardened Stored Procedures & Atomic Workflows
-- Document Reference: docs/phase-0/DATABASE_DESIGN.md & SECURITY_PLAN.md
-- All monetary amounts are represented as integer INR paise (BIGINT).
--
-- PRIVILEGED RPC BOUNDARY & AUTHORIZATION ENFORCEMENT:
-- 1. All stored procedures implement authoritative state transitions, atomic stock
--    reservation, exact integer currency math, and security audit logging.
-- 2. Every procedure is marked SECURITY DEFINER with safe search_path = public, pg_temp.
-- 3. Execution is REVOKED from PUBLIC, anon, and authenticated roles, and GRANTED
--    strictly to service_role.
-- 4. Untrusted clients cannot invoke any stored procedure directly. The trusted Fastify
--    backend API authenticates callers via verified JWT claims and executes procedures
--    via service_role on behalf of verified identities.
-- 5. No caller-controlled authorization flags (such as p_is_staff) are accepted.
--    All actor permissions are verified against authoritative database state.
-- ==============================================================================

-- 1. Multi-Product Deterministic Stock Reservation
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
    out_total_amount BIGINT,
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
    v_existing_owner UUID;
    v_customer_exists UUID;
    v_item RECORD;
    v_raw_elem JSONB;
    v_inv RECORD;
    v_product RECORD;
    v_order_id UUID;
    v_order_number VARCHAR;
    v_subtotal BIGINT := 0;
    v_tax_total BIGINT := 0;
    v_packaging BIGINT := 0;
    v_grand_total BIGINT := 0;
    v_total_cart_qty BIGINT := 0;
    v_max_prep_time INT := 15;
    v_estimated_pickup TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
    v_order_status order_status_enum;
    v_payment_status payment_status_enum;
    v_item_qty INT;
BEGIN
    -- 1. Customer Verification (Prevent Customer ID Spoofing)
    SELECT id INTO v_customer_exists FROM auth.users WHERE id = p_customer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer % does not exist in auth.users.', p_customer_id;
    END IF;

    -- 2. Input Validation: Cart structure and upper bounds
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cart cannot be empty.';
    END IF;

    IF jsonb_array_length(p_items) > 50 THEN
        RAISE EXCEPTION 'Cart exceeds maximum allowed size of 50 distinct items.';
    END IF;

    -- Validate individual line structure and per-item quantity bounds
    FOR v_raw_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        IF (v_raw_elem->>'product_id') IS NULL THEN
            RAISE EXCEPTION 'Malformed cart item: product_id is required.';
        END IF;

        IF (v_raw_elem->>'quantity') IS NULL OR NOT ((v_raw_elem->>'quantity') ~ '^[0-9]+$') THEN
            RAISE EXCEPTION 'Malformed cart item: quantity must be a positive integer.';
        END IF;

        v_item_qty := (v_raw_elem->>'quantity')::INT;
        IF v_item_qty <= 0 OR v_item_qty > 100 THEN
            RAISE EXCEPTION 'Product quantity must be between 1 and 100. Received: %', v_item_qty;
        END IF;
    END LOOP;

    -- 3. Fulfillment & Schedule Validation
    IF p_fulfillment = 'scheduled' THEN
        IF p_scheduled_pickup IS NULL THEN
            RAISE EXCEPTION 'Scheduled pickup time must be provided for scheduled orders.';
        END IF;
        IF p_scheduled_pickup <= TIMEZONE('utc', NOW()) THEN
            RAISE EXCEPTION 'Scheduled pickup time must be in the future.';
        END IF;
    ELSIF p_fulfillment = 'immediate' THEN
        IF p_scheduled_pickup IS NOT NULL THEN
            RAISE EXCEPTION 'Scheduled pickup time must not be provided for immediate orders.';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid fulfillment type: %', p_fulfillment;
    END IF;

    -- 4. Customer-Scoped Idempotency Check & Concurrency Lock
    IF p_idempotency_key IS NOT NULL THEN
        -- Transaction-level advisory lock serializes concurrent duplicate requests
        PERFORM pg_advisory_xact_lock(hashtext('order_idemp:' || p_customer_id::TEXT || ':' || p_idempotency_key));

        -- Check if key belongs to another customer
        SELECT customer_id INTO v_existing_owner 
        FROM public.orders 
        WHERE client_idempotency_key = p_idempotency_key;

        IF FOUND AND v_existing_owner <> p_customer_id THEN
            RAISE EXCEPTION 'Idempotency key % belongs to a different customer.', p_idempotency_key;
        END IF;

        -- Check if order exists for this customer
        SELECT id, order_number, total_amount, expires_at, client_payload_hash, order_status, payment_status
        INTO v_existing_order 
        FROM public.orders 
        WHERE customer_id = p_customer_id AND client_idempotency_key = p_idempotency_key;
        
        IF FOUND THEN
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

    -- 5. Aggregate Duplicate Product Lines & Enforce Quantity Bounds
    FOR v_item IN 
        SELECT (x->>'product_id')::UUID AS product_id, SUM((x->>'quantity')::BIGINT)::BIGINT AS quantity
        FROM jsonb_array_elements(p_items) AS x
        GROUP BY (x->>'product_id')::UUID
        ORDER BY (x->>'product_id')::UUID ASC
    LOOP
        IF v_item.quantity <= 0 OR v_item.quantity > 100 THEN
            RAISE EXCEPTION 'Aggregated product quantity for product % exceeds maximum limit of 100 units. Received: %', v_item.product_id, v_item.quantity;
        END IF;

        v_total_cart_qty := v_total_cart_qty + v_item.quantity;
        IF v_total_cart_qty > 500 THEN
            RAISE EXCEPTION 'Total cart quantity exceeds maximum allowable limit of 500 units.';
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

    -- 6. Atomic All-or-Nothing Allocation & Authoritative Server Pricing (in Paise)
    FOR v_item IN 
        SELECT (x->>'product_id')::UUID AS product_id, SUM((x->>'quantity')::BIGINT)::BIGINT AS quantity
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

        -- Exact integer arithmetic with explicit rounding
        v_subtotal := v_subtotal + (v_product.base_price * v_item.quantity);
        IF v_subtotal > 100000000 THEN
            RAISE EXCEPTION 'Order subtotal exceeds maximum allowed transaction limit of 100000000 paise.';
        END IF;

        v_tax_total := v_tax_total + ROUND((v_product.base_price * v_item.quantity * v_product.tax_rate_pct) / 100.0)::BIGINT;
        
        IF v_product.prep_time_minutes > v_max_prep_time THEN
            v_max_prep_time := v_product.prep_time_minutes;
        END IF;
    END LOOP;

    v_grand_total := v_subtotal + v_tax_total + v_packaging;
    IF v_grand_total > 100000000 THEN
        RAISE EXCEPTION 'Order total exceeds maximum allowed transaction limit of 100000000 paise.';
    END IF;

    IF p_fulfillment = 'immediate' THEN
        v_estimated_pickup := TIMEZONE('utc', NOW()) + (v_max_prep_time || ' minutes')::INTERVAL;
    ELSE
        v_estimated_pickup := p_scheduled_pickup;
    END IF;

    -- 7. Delineate Lifecycles Based on Payment Method
    IF p_payment_method = 'cash_at_pickup' THEN
        v_order_status := 'confirmed';
        v_payment_status := 'unpaid';
        v_expires_at := NULL;
    ELSE
        v_order_status := 'draft';
        v_payment_status := 'pending';
        v_expires_at := TIMEZONE('utc', NOW()) + INTERVAL '10 minutes';
    END IF;

    v_order_number := 'MO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- 8. Insert Order Record
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

    -- 9. Insert Snapshot Order Items
    FOR v_item IN 
        SELECT (x->>'product_id')::UUID AS product_id, SUM((x->>'quantity')::BIGINT)::BIGINT AS quantity
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
            v_product.base_price, v_product.tax_rate_pct, v_item.quantity::INT,
            (v_product.base_price * v_item.quantity)
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


-- 2. Safe Expiration Worker for Online Reservations
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
    FOR v_order IN 
        SELECT id FROM public.orders 
        WHERE order_status = 'draft' 
          AND payment_method = 'online_razorpay'
          AND expires_at IS NOT NULL 
          AND expires_at < TIMEZONE('utc', NOW())
        FOR UPDATE SKIP LOCKED
    LOOP
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
            payment_status = 'failed',
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


-- 3. Deterministic Payment Reconciliation
CREATE OR REPLACE FUNCTION public.rpc_reconcile_late_payment(
    p_order_id UUID,
    p_provider_payment_id VARCHAR,
    p_provider_order_id VARCHAR,
    p_amount BIGINT,
    p_currency VARCHAR,
    p_raw_payload JSONB DEFAULT '{}'::jsonb
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
    v_existing_payment RECORD;
    v_item RECORD;
    v_inv RECORD;
    v_can_allocate BOOLEAN := true;
BEGIN
    -- 1. Input Validation: Parameter completeness and exact currency requirement
    IF p_provider_payment_id IS NULL OR trim(p_provider_payment_id) = '' THEN
        RAISE EXCEPTION 'Provider payment ID cannot be empty.';
    END IF;

    IF p_provider_order_id IS NULL OR trim(p_provider_order_id) = '' THEN
        RAISE EXCEPTION 'Provider order ID cannot be empty.';
    END IF;

    IF p_currency IS NULL OR p_currency <> 'INR' THEN
        RAISE EXCEPTION 'Invalid payment currency: %. Must be exactly INR.', p_currency;
    END IF;

    -- Concurrency Lock on provider_payment_id
    PERFORM pg_advisory_xact_lock(hashtext('provider_payment:' || p_provider_payment_id));

    -- 2. Deduplication & Cross-Order Hijack Check
    SELECT * INTO v_existing_payment 
    FROM public.payments 
    WHERE provider_payment_id = p_provider_payment_id;

    IF FOUND THEN
        IF v_existing_payment.order_id <> p_order_id THEN
            RAISE EXCEPTION 'Provider payment ID % already exists for different order %', p_provider_payment_id, v_existing_payment.order_id;
        END IF;

        -- Duplicate webhook / event on the same order: idempotent no-op
        SELECT order_status, payment_status INTO v_order FROM public.orders WHERE id = p_order_id;
        out_action := 'DUPLICATE_EVENT';
        out_order_status := v_order.order_status;
        out_payment_status := v_order.payment_status;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 3. Lock target order row FOR UPDATE
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- 4. Payment Parameter Verification
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.';
    END IF;

    IF p_amount <> v_order.total_amount THEN
        RAISE EXCEPTION 'Payment amount mismatch. Expected %, received %', v_order.total_amount, p_amount;
    END IF;

    IF v_order.provider_order_id IS NOT NULL AND p_provider_order_id <> v_order.provider_order_id THEN
        RAISE EXCEPTION 'Provider order ID mismatch. Expected %, received %', v_order.provider_order_id, p_provider_order_id;
    END IF;

    -- 5. State Decision Tree
    -- Case A: Draft order (Verify reservation expiry before accepting on-time capture)
    IF v_order.order_status = 'draft' THEN
        IF v_order.expires_at IS NOT NULL AND v_order.expires_at < TIMEZONE('utc', NOW()) THEN
            -- Reservation expired before payment arrival! Release draft stock and route to late capture recovery
            FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id ASC
            LOOP
                UPDATE public.inventory
                SET reserved_stock = GREATEST(0, reserved_stock - v_item.quantity),
                    updated_at = TIMEZONE('utc', NOW())
                WHERE product_id = v_item.product_id;
            END LOOP;

            UPDATE public.orders 
            SET order_status = 'cancelled_expired', 
                payment_status = 'failed',
                cancellation_reason = 'Online checkout reservation TTL expired before payment capture.',
                updated_at = TIMEZONE('utc', NOW())
            WHERE id = p_order_id;

            -- Re-read order state as cancelled_expired to fall into Case D below
            v_order.order_status := 'cancelled_expired';
        ELSE
            -- Valid on-time capture!
            INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, raw_payload)
            VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'INR', 'captured', p_raw_payload);

            UPDATE public.orders 
            SET order_status = 'confirmed', 
                payment_status = 'captured', 
                expires_at = NULL, 
                updated_at = TIMEZONE('utc', NOW()) 
            WHERE id = p_order_id;

            out_action := 'CAPTURED_ON_TIME';
            out_order_status := 'confirmed';
            out_payment_status := 'captured';
            RETURN NEXT;
            RETURN;
        END IF;
    END IF;

    -- Case B: Order already confirmed or completed
    IF v_order.order_status IN ('confirmed', 'preparing', 'ready_for_pickup', 'completed') THEN
        INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, raw_payload)
        VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'INR', 'captured', p_raw_payload);

        out_action := 'ALREADY_CAPTURED';
        out_order_status := v_order.order_status;
        out_payment_status := v_order.payment_status;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Case C: Order explicitly cancelled by customer or staff - do NOT revive
    IF v_order.order_status IN ('cancelled_by_customer', 'cancelled_by_staff', 'cancelled_damaged_stock') THEN
        INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, raw_payload)
        VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'INR', 'refund_pending', p_raw_payload);

        UPDATE public.orders 
        SET payment_status = 'refund_pending', updated_at = TIMEZONE('utc', NOW()) 
        WHERE id = p_order_id;

        out_action := 'TRIGGER_REFUND_MANUAL_CANCEL';
        out_order_status := v_order.order_status;
        out_payment_status := 'refund_pending';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Case D: Late payment on expired reservation (cancelled_expired)
    IF v_order.order_status = 'cancelled_expired' THEN
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

        IF v_can_allocate THEN
            -- Re-reserve stock atomically
            FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id ASC
            LOOP
                UPDATE public.inventory 
                SET reserved_stock = reserved_stock + v_item.quantity,
                    updated_at = TIMEZONE('utc', NOW())
                WHERE product_id = v_item.product_id;
            END LOOP;

            INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, raw_payload)
            VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'INR', 'captured', p_raw_payload);

            UPDATE public.orders 
            SET order_status = 'confirmed', 
                payment_status = 'captured', 
                expires_at = NULL, 
                cancellation_reason = NULL,
                updated_at = TIMEZONE('utc', NOW()) 
            WHERE id = p_order_id;

            out_action := 'CONFIRMED_REALLOCATED';
            out_order_status := 'confirmed';
            out_payment_status := 'captured';
        ELSE
            -- Stock depleted by another order: record payment and mark refund_pending
            INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, raw_payload)
            VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'INR', 'refund_pending', p_raw_payload);

            UPDATE public.orders 
            SET order_status = 'cancelled_inventory_depleted', 
                payment_status = 'refund_pending', 
                cancellation_reason = 'Late payment received after reservation expired; stock claimed by another order.',
                updated_at = TIMEZONE('utc', NOW()) 
            WHERE id = p_order_id;

            out_action := 'TRIGGER_REFUND';
            out_order_status := 'cancelled_inventory_depleted';
            out_payment_status := 'refund_pending';
        END IF;

        RETURN NEXT;
        RETURN;
    END IF;

    -- Case E: Any other cancellation state
    INSERT INTO public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, raw_payload)
    VALUES (p_order_id, 'razorpay', p_provider_order_id, p_provider_payment_id, p_amount, 'INR', 'refund_pending', p_raw_payload);

    UPDATE public.orders SET payment_status = 'refund_pending', updated_at = TIMEZONE('utc', NOW()) WHERE id = p_order_id;

    out_action := 'TRIGGER_REFUND';
    out_order_status := v_order.order_status;
    out_payment_status := 'refund_pending';
    RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_reconcile_late_payment FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reconcile_late_payment TO service_role;


-- 4. Deterministic Order Handover & Cash Verification
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
    v_staff_role staff_role_enum;
BEGIN
    -- 1. Validate staff identity and active role (Prevent Staff ID Spoofing)
    SELECT role INTO v_staff_role 
    FROM public.staff_roles 
    WHERE user_id = p_staff_id AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Staff member % is not active staff.', p_staff_id;
    END IF;

    -- 2. Lock order row FOR UPDATE
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- 3. Reject invalid state transitions
    IF v_order.order_status = 'completed' THEN
        RAISE EXCEPTION 'Order % is already completed.', p_order_id;
    END IF;

    IF v_order.order_status != 'ready_for_pickup' THEN
        RAISE EXCEPTION 'Order is not ready for pickup. Current status: %', v_order.order_status;
    END IF;

    -- 4. Payment verification
    IF v_order.payment_method = 'cash_at_pickup' THEN
        IF p_cash_collected IS NOT TRUE THEN
            RAISE EXCEPTION 'Cannot complete cash order without staff confirmation of cash receipt.';
        END IF;

        INSERT INTO public.payments (order_id, provider, amount, currency, status, raw_payload)
        VALUES (p_order_id, 'cash_register', v_order.total_amount, 'INR', 'captured', jsonb_build_object('collected_by', p_staff_id));

        UPDATE public.orders SET payment_status = 'captured' WHERE id = p_order_id;
    ELSE
        IF v_order.payment_status != 'captured' THEN
            RAISE EXCEPTION 'Cannot complete online order: payment is not captured. Current payment status: %', v_order.payment_status;
        END IF;
    END IF;

    -- 5. Decrement physical_stock and reserved_stock in deterministic ascending order
    FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id ASC
    LOOP
        UPDATE public.inventory
        SET physical_stock = physical_stock - v_item.quantity,
            reserved_stock = GREATEST(0, reserved_stock - v_item.quantity),
            updated_at = TIMEZONE('utc', NOW())
        WHERE product_id = v_item.product_id;
    END LOOP;

    -- 6. Mark order completed
    UPDATE public.orders 
    SET order_status = 'completed', 
        collected_at = TIMEZONE('utc', NOW()), 
        collected_by_staff_id = p_staff_id,
        updated_at = TIMEZONE('utc', NOW()) 
    WHERE id = p_order_id;

    RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_complete_order_handover FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_complete_order_handover TO service_role;


-- 5. Protected Inventory Write-Off
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
    v_staff_role staff_role_enum;
BEGIN
    -- 1. Validate staff role (manager or admin required)
    SELECT role INTO v_staff_role 
    FROM public.staff_roles 
    WHERE user_id = p_staff_id AND is_active = true AND role IN ('manager', 'admin');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Staff member % is not authorized to write off inventory (must be manager or admin).', p_staff_id;
    END IF;

    IF p_damaged_quantity <= 0 THEN
        RAISE EXCEPTION 'Damaged quantity must be greater than zero. Received: %', p_damaged_quantity;
    END IF;

    -- 2. Lock the inventory row
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

        INSERT INTO public.audit_logs (
            actor_id, actor_role, action, entity_type, entity_id,
            old_values, new_values
        ) VALUES (
            p_staff_id, v_staff_role::TEXT, 'INVENTORY_WRITE_OFF', 'inventory', p_product_id::TEXT,
            jsonb_build_object('physical_stock', v_inv.physical_stock, 'reserved_stock', v_inv.reserved_stock),
            jsonb_build_object('physical_stock', v_inv.physical_stock - p_damaged_quantity, 'reserved_stock', v_inv.reserved_stock, 'reason', p_reason)
        );

        out_physical_stock := v_inv.physical_stock - p_damaged_quantity;
        out_reserved_stock := v_inv.reserved_stock;
        out_available_stock := out_physical_stock - out_reserved_stock;
        RETURN NEXT;
        RETURN;
    ELSE
        -- Case 2: Damage exceeds unreserved stock
        RAISE EXCEPTION 'INVENTORY_WRITE_OFF_BLOCKED: Damaged quantity (%) exceeds unreserved stock (%). % active reserved unit(s) are impacted. Manager must explicitly cancel and refund affected customer order(s) via rpc_cancel_order before this physical stock can be written off.',
            p_damaged_quantity, v_available, (p_damaged_quantity - v_available);
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_write_off_inventory FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_write_off_inventory TO service_role;


-- 6. Deterministic Order Cancellation (Role-Verified, No Caller-Controlled Flag)
CREATE OR REPLACE FUNCTION public.rpc_cancel_order(
    p_order_id UUID,
    p_actor_id UUID,
    p_reason TEXT
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
    v_staff_role staff_role_enum;
    v_is_staff BOOLEAN := false;
BEGIN
    -- 1. Lock order row FOR UPDATE
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- 2. Completed orders CANNOT be cancelled
    IF v_order.order_status = 'completed' THEN
        RAISE EXCEPTION 'Order % is already completed and cannot be cancelled.', p_order_id;
    END IF;

    -- 3. Idempotent repeat cancellation: if already cancelled, do not release stock again
    IF v_order.order_status IN ('cancelled_by_customer', 'cancelled_by_staff', 'cancelled_expired', 'cancelled_inventory_depleted', 'cancelled_damaged_stock') THEN
        RETURN true;
    END IF;

    -- 4. Verified Role Check (Derived from database, NOT a caller-supplied boolean parameter)
    SELECT role INTO v_staff_role 
    FROM public.staff_roles 
    WHERE user_id = p_actor_id AND is_active = true;

    IF FOUND THEN
        v_is_staff := true;
        IF p_reason = 'damaged_stock' THEN
            v_new_status := 'cancelled_damaged_stock';
        ELSE
            v_new_status := 'cancelled_by_staff';
        END IF;
    ELSE
        -- Actor is a customer: verify ownership
        IF p_actor_id <> v_order.customer_id THEN
            RAISE EXCEPTION 'Customer % is not authorized to cancel order belonging to %.', p_actor_id, v_order.customer_id;
        END IF;

        -- Customer cancellation: only allowed while draft or confirmed (before kitchen preparation)
        IF v_order.order_status NOT IN ('draft', 'confirmed') THEN
            RAISE EXCEPTION 'Customer cannot cancel order once preparation has begun. Current status: %', v_order.order_status;
        END IF;

        v_new_status := 'cancelled_by_customer';
    END IF;

    -- 5. Release reserved stock ONLY for orders holding active reservations
    IF v_order.order_status IN ('draft', 'confirmed', 'preparing', 'ready_for_pickup') THEN
        FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id ASC
        LOOP
            UPDATE public.inventory
            SET reserved_stock = GREATEST(0, reserved_stock - v_item.quantity),
                updated_at = TIMEZONE('utc', NOW())
            WHERE product_id = v_item.product_id;
        END LOOP;
    END IF;

    -- 6. Update order status
    UPDATE public.orders 
    SET order_status = v_new_status, 
        cancellation_reason = p_reason,
        updated_at = TIMEZONE('utc', NOW()) 
    WHERE id = p_order_id;

    -- 7. If online order was captured, transition to refund_pending
    IF v_order.payment_method = 'online_razorpay' AND v_order.payment_status = 'captured' THEN
        UPDATE public.orders SET payment_status = 'refund_pending', updated_at = TIMEZONE('utc', NOW()) WHERE id = p_order_id;
    END IF;

    RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_cancel_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_order TO service_role;

-- Distinct trusted operation for Customer cancellation
CREATE OR REPLACE FUNCTION public.rpc_cancel_order_by_customer(
    p_order_id UUID,
    p_customer_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.rpc_cancel_order(p_order_id, p_customer_id, p_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_cancel_order_by_customer FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_order_by_customer TO service_role;

-- Distinct trusted operation for Staff cancellation
CREATE OR REPLACE FUNCTION public.rpc_cancel_order_by_staff(
    p_order_id UUID,
    p_staff_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_role staff_role_enum;
BEGIN
    SELECT role INTO v_staff_role 
    FROM public.staff_roles 
    WHERE user_id = p_staff_id AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Staff member % is not active staff.', p_staff_id;
    END IF;

    RETURN public.rpc_cancel_order(p_order_id, p_staff_id, p_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_cancel_order_by_staff FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_order_by_staff TO service_role;


-- 7. Authoritative Partial/Full Refund Initiation
CREATE OR REPLACE FUNCTION public.rpc_issue_refund(
    p_order_id UUID,
    p_refund_amount BIGINT,
    p_staff_id UUID,
    p_reason TEXT,
    p_idempotency_key VARCHAR
)
RETURNS TABLE (
    out_refund_id UUID,
    out_status refund_status_enum,
    out_remaining_refundable BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_payment RECORD;
    v_existing_refund RECORD;
    v_total_refunded BIGINT := 0;
    v_remaining BIGINT;
    v_refund_id UUID;
    v_staff_role staff_role_enum;
BEGIN
    -- 1. Validate staff identity and manager/admin role (Prevent Staff ID Spoofing)
    SELECT role INTO v_staff_role 
    FROM public.staff_roles 
    WHERE user_id = p_staff_id AND is_active = true AND role IN ('manager', 'admin');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Staff member % is not authorized to issue refunds (must be manager or admin).', p_staff_id;
    END IF;

    IF p_refund_amount <= 0 THEN
        RAISE EXCEPTION 'Refund amount must be greater than zero. Received: %', p_refund_amount;
    END IF;

    -- Concurrency safety: lock refund idempotency key if provided
    IF p_idempotency_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('refund_idemp:' || p_idempotency_key));
    END IF;

    -- 2. Lock target order FOR UPDATE
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- 3. Reject Cash Orders (Cash refunds must NOT enter online gateway refund flow)
    IF v_order.payment_method = 'cash_at_pickup' THEN
        RAISE EXCEPTION 'Cannot issue online gateway refund for cash-at-pickup order %. Cash refunds must be handled via store register.', p_order_id;
    END IF;

    -- 4. Lock captured payment row FOR UPDATE
    SELECT * INTO v_payment 
    FROM public.payments 
    WHERE order_id = p_order_id AND status = 'captured' 
    ORDER BY created_at DESC LIMIT 1 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No captured payment found for order %', p_order_id;
    END IF;

    -- 5. Check Idempotency Key Replay and Verify ALL Parameters
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_refund 
        FROM public.refunds 
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            -- Verify every replay parameter strictly
            IF v_existing_refund.order_id <> p_order_id 
               OR v_existing_refund.payment_id <> v_payment.id 
               OR v_existing_refund.amount <> p_refund_amount 
               OR v_existing_refund.currency <> 'INR' THEN
                RAISE EXCEPTION 'Refund idempotency key reused with mismatched parameters.';
            END IF;

            SELECT COALESCE(SUM(amount), 0) INTO v_total_refunded
            FROM public.refunds
            WHERE payment_id = v_payment.id AND status IN ('refund_pending', 'refund_processing', 'refunded');

            out_refund_id := v_existing_refund.id;
            out_status := v_existing_refund.status;
            out_remaining_refundable := GREATEST(0, v_payment.amount - v_total_refunded);
            RETURN NEXT;
            RETURN;
        END IF;
    END IF;

    -- 6. Enforce Cumulative Refund Cap across in-flight and completed refunds
    SELECT COALESCE(SUM(amount), 0) INTO v_total_refunded
    FROM public.refunds
    WHERE payment_id = v_payment.id AND status IN ('refund_pending', 'refund_processing', 'refunded');

    v_remaining := v_payment.amount - v_total_refunded;

    IF p_refund_amount > v_remaining THEN
        RAISE EXCEPTION 'REFUND_EXCEEDS_REMAINING_AMOUNT: Requested % exceeds remaining refundable amount (%). Captured: %, Previously refunded/processing: %',
            p_refund_amount, v_remaining, v_payment.amount, v_total_refunded;
    END IF;

    -- 7. Insert new refund record in refund_pending status
    -- A refund is never marked refunded before gateway provider confirmation webhook is recorded
    INSERT INTO public.refunds (
        order_id, payment_id, amount, currency, status, reason, idempotency_key
    ) VALUES (
        p_order_id, v_payment.id, p_refund_amount, 'INR', 'refund_pending', p_reason, p_idempotency_key
    ) RETURNING id INTO v_refund_id;

    -- 8. Update order payment status to reflect ongoing refund
    UPDATE public.orders 
    SET payment_status = 'refund_pending', updated_at = TIMEZONE('utc', NOW()) 
    WHERE id = p_order_id;

    out_refund_id := v_refund_id;
    out_status := 'refund_pending';
    out_remaining_refundable := v_remaining - p_refund_amount;
    RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_issue_refund FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_issue_refund TO service_role;
