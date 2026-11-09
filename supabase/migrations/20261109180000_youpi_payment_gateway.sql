-- ==============================================================================
-- Migration: 20261109180000_youpi_payment_gateway.sql
-- Description: Integration of self-hosted YouPI-PG UPI & COD Payment Gateway.
-- Adds 'online_youpi' payment method enum value and updates order & reconciliation procedures.
-- ==============================================================================

-- 1. Extend Payment Method Enum
ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'online_youpi';

-- 2. Update rpc_expire_stale_draft_orders to clean up both online_youpi and online_razorpay
CREATE OR REPLACE FUNCTION public.rpc_expire_stale_draft_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_expired_count INTEGER := 0;
BEGIN
    FOR v_order IN 
        SELECT id FROM public.orders 
        WHERE order_status = 'draft' 
          AND payment_method IN ('online_youpi', 'online_razorpay')
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
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_order.id;

        v_expired_count := v_expired_count + 1;
    END LOOP;

    RETURN v_expired_count;
END;
$$;

-- 3. Update rpc_reconcile_late_payment to accept YouPI-PG payments
CREATE OR REPLACE FUNCTION public.rpc_reconcile_late_payment(
    p_order_id UUID,
    p_provider_payment_id VARCHAR,
    p_provider_order_id VARCHAR,
    p_amount BIGINT,
    p_currency VARCHAR DEFAULT 'INR',
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_payment_id UUID;
    v_provider VARCHAR(30) := 'youpi';
BEGIN
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE id = p_order_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'P0002';
    END IF;

    -- Extract provider from raw payload if explicitly passed
    IF p_raw_payload ? 'provider' THEN
        v_provider := (p_raw_payload->>'provider')::VARCHAR(30);
    END IF;

    IF v_order.order_status = 'draft' THEN
        UPDATE public.orders 
        SET order_status = 'confirmed',
            payment_status = 'captured',
            provider_order_id = p_provider_order_id,
            expires_at = NULL,
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = p_order_id;

        INSERT INTO public.payments (
            order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, raw_payload
        ) VALUES (
            p_order_id, v_provider, p_provider_order_id, p_provider_payment_id, p_amount, p_currency, 'captured', p_raw_payload
        ) RETURNING id INTO v_payment_id;

        RETURN jsonb_build_object(
            'status', 'reconciled_confirmed',
            'order_id', p_order_id,
            'payment_id', v_payment_id
        );
    END IF;

    -- Already captured
    IF v_order.payment_status = 'captured' THEN
        RETURN jsonb_build_object(
            'status', 'already_captured',
            'order_id', p_order_id
        );
    END IF;

    -- Expired order late payment
    IF v_order.order_status = 'cancelled_expired' THEN
        INSERT INTO public.payments (
            order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, raw_payload
        ) VALUES (
            p_order_id, v_provider, p_provider_order_id, p_provider_payment_id, p_amount, p_currency, 'refund_pending', p_raw_payload
        ) RETURNING id INTO v_payment_id;

        RETURN jsonb_build_object(
            'status', 'refund_pending_late_arrival',
            'order_id', p_order_id,
            'payment_id', v_payment_id
        );
    END IF;

    RETURN jsonb_build_object(
        'status', 'ignored',
        'order_id', p_order_id
    );
END;
$$;

-- 4. Update rpc_cancel_order refund condition
CREATE OR REPLACE FUNCTION public.rpc_cancel_order(
    p_order_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE id = p_order_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'P0002';
    END IF;

    IF v_order.order_status IN ('cancelled', 'cancelled_expired') THEN
        RETURN true;
    END IF;

    IF v_order.order_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot cancel completed order %', p_order_id USING ERRCODE = 'P0001';
    END IF;

    -- Restock inventory if items were reserved/committed
    IF v_order.order_status IN ('draft', 'confirmed', 'ready_for_pickup') THEN
        FOR v_item IN 
            SELECT product_id, quantity 
            FROM public.order_items 
            WHERE order_id = p_order_id 
            ORDER BY product_id ASC
        LOOP
            IF v_order.order_status = 'draft' THEN
                UPDATE public.inventory 
                SET reserved_stock = GREATEST(0, reserved_stock - v_item.quantity),
                    updated_at = TIMEZONE('utc', NOW())
                WHERE product_id = v_item.product_id;
            ELSE
                UPDATE public.inventory 
                SET stock_quantity = stock_quantity + v_item.quantity,
                    updated_at = TIMEZONE('utc', NOW())
                WHERE product_id = v_item.product_id;
            END IF;
        END LOOP;
    END IF;

    UPDATE public.orders 
    SET order_status = 'cancelled',
        expires_at = NULL,
        special_notes = COALESCE(special_notes, '') || ' [Cancelled: ' || p_reason || ']',
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_order_id;

    -- Online payment refund flag
    IF v_order.payment_method IN ('online_youpi', 'online_razorpay') AND v_order.payment_status = 'captured' THEN
        UPDATE public.orders 
        SET payment_status = 'refund_pending', 
            updated_at = TIMEZONE('utc', NOW()) 
        WHERE id = p_order_id;
    END IF;

    RETURN true;
END;
$$;

