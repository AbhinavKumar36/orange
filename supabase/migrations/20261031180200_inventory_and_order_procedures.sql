-- ==============================================================================
-- Moody Orange — Migration 3: Hardened Stored Procedures & Atomic Workflows
-- Document Reference: docs/phase-0/DATABASE_DESIGN.md & SECURITY_PLAN.md
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
        v_expires_at := TIMEZONE('utc', NOW()) + INTERVAL '10 minutes';
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


-- 3. Deterministic Late Payment Reconciliation
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
        SET payment_status = 'refund_pending', updated_at = TIMEZONE('utc', NOW()) 
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
            updated_at = TIMEZONE('utc', NOW()) 
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
            updated_at = TIMEZONE('utc', NOW()) 
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


-- 6. Deterministic Order Cancellation
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
        updated_at = TIMEZONE('utc', NOW()) 
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


-- 7. Authoritative Partial/Full Refund Initiation
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

