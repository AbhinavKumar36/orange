-- ==============================================================================
-- Moody Orange — Migration 4: Mandatory Checkout Idempotency Hardening
-- Hardens public.rpc_reserve_order_stock to mandate a non-null, bounded
-- client idempotency key for all checkout attempts.
-- ==============================================================================

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

    -- 4. Mandatory Customer-Scoped Idempotency Check & Concurrency Lock
    IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
        RAISE EXCEPTION 'Idempotency key is required for checkout.';
    END IF;

    IF length(p_idempotency_key) > 128 THEN
        RAISE EXCEPTION 'Idempotency key exceeds maximum length of 128 characters.';
    END IF;

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

