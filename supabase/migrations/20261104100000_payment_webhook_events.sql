-- ==============================================================================
-- Moody Orange — Phase 7: Payments & Refunds
-- Table: PAYMENT WEBHOOK EVENTS (Idempotent Webhook Processing Ledger)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    event_id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    provider VARCHAR(30) NOT NULL DEFAULT 'razorpay',
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    provider_payment_id VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'processed',
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Index for traversal by order
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_order_id ON public.payment_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_payment_id ON public.payment_webhook_events(provider_payment_id);

-- Enable Row-Level Security
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role has full management access
CREATE POLICY "Service role manages webhook events" ON public.payment_webhook_events
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Admins and managers can view webhook events for audit
CREATE POLICY "Admins can view webhook events" ON public.payment_webhook_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_roles
            WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'manager')
        )
    );

-- Explicitly deny public client mutations
CREATE POLICY "Deny public webhook writes" ON public.payment_webhook_events
    FOR INSERT TO anon, authenticated
    WITH CHECK (false);

GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.payment_webhook_events FROM anon, authenticated;
