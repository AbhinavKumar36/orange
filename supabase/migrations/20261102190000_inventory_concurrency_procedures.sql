-- ==============================================================================
-- Moody Orange — Phase 6 Correction: Concurrency & Invariant Procedures
-- 1. Atomic Order Status Advancement with Row Locking
-- 2. Atomic Inventory Adjustment with Row Locking
-- 3. Hardened Handover & Write-Off Procedures with Strict Invariant Verification
-- ==============================================================================

-- 1. Atomic Order Status Advancement
CREATE OR REPLACE FUNCTION public.rpc_advance_order_status(
    p_order_id UUID,
    p_target_status order_status_enum,
    p_staff_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_staff_role staff_role_enum;
    v_is_valid BOOLEAN;
BEGIN
    -- Verify active staff identity
    SELECT role INTO v_staff_role 
    FROM public.staff_roles 
    WHERE user_id = p_staff_id AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Staff member % is not active staff.', p_staff_id;
    END IF;

    -- Row-level locking on orders table
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE id = p_order_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Enforce valid linear transitions only:
    -- confirmed -> preparing -> ready_for_pickup
    v_is_valid := (v_order.order_status = 'confirmed' AND p_target_status = 'preparing') OR
                  (v_order.order_status = 'preparing' AND p_target_status = 'ready_for_pickup');

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'INVALID_ORDER_TRANSITION: Cannot transition order from status % to %.',
            v_order.order_status, p_target_status;
    END IF;

    UPDATE public.orders
    SET order_status = p_target_status,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_order_id;

    RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_advance_order_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_advance_order_status TO service_role;


-- 2. Atomic Inventory Adjustment with Row-Level Locking
CREATE OR REPLACE FUNCTION public.rpc_adjust_inventory(
    p_product_id UUID,
    p_delta INT,
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
    v_staff_role staff_role_enum;
    v_new_physical INT;
BEGIN
    -- Verify staff has manager or admin permission
    SELECT role INTO v_staff_role 
    FROM public.staff_roles 
    WHERE user_id = p_staff_id AND is_active = true AND role IN ('manager', 'admin');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Staff member % is not authorized to adjust inventory (manager or admin required).', p_staff_id;
    END IF;

    -- Acquire row-level lock on the target product inventory
    SELECT * INTO v_inv 
    FROM public.inventory 
    WHERE product_id = p_product_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record for product % not found', p_product_id;
    END IF;

    v_new_physical := v_inv.physical_stock + p_delta;
    IF v_new_physical < 0 OR v_new_physical < v_inv.reserved_stock THEN
        RAISE EXCEPTION 'INVALID_STOCK_ADJUSTMENT: Stock adjustment would violate physical stock (%) >= reserved stock (%) constraint.',
            v_new_physical, v_inv.reserved_stock;
    END IF;

    UPDATE public.inventory
    SET physical_stock = v_new_physical,
        updated_at = TIMEZONE('utc', NOW())
    WHERE product_id = p_product_id;

    INSERT INTO public.audit_logs (
        actor_id, actor_role, action, entity_type, entity_id,
        old_values, new_values
    ) VALUES (
        p_staff_id, v_staff_role::TEXT, 'INVENTORY_ADJUST', 'inventory', p_product_id::TEXT,
        jsonb_build_object('physical_stock', v_inv.physical_stock, 'reserved_stock', v_inv.reserved_stock),
        jsonb_build_object('physical_stock', v_new_physical, 'reserved_stock', v_inv.reserved_stock, 'reason', p_reason)
    );

    out_physical_stock := v_new_physical;
    out_reserved_stock := v_inv.reserved_stock;
    out_available_stock := v_new_physical - v_inv.reserved_stock;
    RETURN NEXT;
    RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_adjust_inventory FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_adjust_inventory TO service_role;


-- 3. Hardened Handover Procedure with Inventory Row Locking
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
    v_inv RECORD;
    v_staff_role staff_role_enum;
    v_item_count INT;
    v_inv_count INT;
BEGIN
    -- 1. Validate staff identity and active role
    SELECT role INTO v_staff_role 
    FROM public.staff_roles 
    WHERE user_id = p_staff_id AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Staff member % is not active staff.', p_staff_id;
    END IF;

    -- 2. Lock order row FOR UPDATE (prevents duplicate concurrent handovers)
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

    -- 5. Lock relevant inventory rows in ascending order to prevent deadlocks under concurrency
    PERFORM 1 FROM public.inventory
    WHERE product_id IN (SELECT product_id FROM public.order_items WHERE order_id = p_order_id)
    ORDER BY product_id ASC
    FOR UPDATE;

    -- 6. Strict pre-validation: Verify ALL order items have inventory records and sufficient stock
    SELECT count(DISTINCT product_id) INTO v_item_count
    FROM public.order_items WHERE order_id = p_order_id;

    SELECT count(DISTINCT product_id) INTO v_inv_count
    FROM public.inventory
    WHERE product_id IN (SELECT product_id FROM public.order_items WHERE order_id = p_order_id);

    IF v_inv_count < v_item_count THEN
        RAISE EXCEPTION 'MISSING_INVENTORY_ROW: One or more products in order % do not have an inventory record.', p_order_id;
    END IF;

    FOR v_item IN
        SELECT product_id, SUM(quantity)::INT AS total_quantity
        FROM public.order_items
        WHERE order_id = p_order_id
        GROUP BY product_id
        ORDER BY product_id ASC
    LOOP
        SELECT * INTO v_inv
        FROM public.inventory
        WHERE product_id = v_item.product_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'MISSING_INVENTORY_ROW: Product % has no inventory record for order %.',
                v_item.product_id, p_order_id;
        END IF;

        IF v_inv.physical_stock < v_item.total_quantity THEN
            RAISE EXCEPTION 'INSUFFICIENT_PHYSICAL_STOCK: Product % physical stock (%) is less than required order quantity (%).',
                v_item.product_id, v_inv.physical_stock, v_item.total_quantity;
        END IF;

        IF v_inv.reserved_stock < v_item.total_quantity THEN
            RAISE EXCEPTION 'INSUFFICIENT_RESERVED_STOCK: Product % reserved stock (%) is less than required order quantity (%).',
                v_item.product_id, v_inv.reserved_stock, v_item.total_quantity;
        END IF;
    END LOOP;

    -- 7. Modification phase: Only executed after ALL items pass strict validation
    FOR v_item IN
        SELECT product_id, SUM(quantity)::INT AS total_quantity
        FROM public.order_items
        WHERE order_id = p_order_id
        GROUP BY product_id
        ORDER BY product_id ASC
    LOOP
        UPDATE public.inventory
        SET physical_stock = physical_stock - v_item.total_quantity,
            reserved_stock = reserved_stock - v_item.total_quantity,
            updated_at = TIMEZONE('utc', NOW())
        WHERE product_id = v_item.product_id;
    END LOOP;

    -- 8. Mark order completed
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
