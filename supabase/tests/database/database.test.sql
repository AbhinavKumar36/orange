-- ==============================================================================
-- Moody Orange — pgTAP Database Test Suite
-- Document Reference: docs/phase-0/TESTING_STRATEGY.md & IMPLEMENTATION_ROADMAP.md
-- All monetary amounts are represented as integer INR paise (BIGINT).
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT * FROM no_plan();

-- ------------------------------------------------------------------------------
-- 1. Schema Existence & Structure Verification
-- ------------------------------------------------------------------------------
SELECT has_table('public', 'profiles', 'Table public.profiles must exist');
SELECT has_table('public', 'staff_roles', 'Table public.staff_roles must exist');
SELECT has_table('public', 'categories', 'Table public.categories must exist');
SELECT has_table('public', 'products', 'Table public.products must exist');
SELECT has_table('public', 'inventory', 'Table public.inventory must exist');
SELECT has_table('public', 'orders', 'Table public.orders must exist');
SELECT has_table('public', 'order_items', 'Table public.order_items must exist');
SELECT has_table('public', 'payments', 'Table public.payments must exist');
SELECT has_table('public', 'refunds', 'Table public.refunds must exist');
SELECT has_table('public', 'audit_logs', 'Table public.audit_logs must exist');
SELECT has_view('public', 'product_availability', 'View public.product_availability must exist');

-- ------------------------------------------------------------------------------
-- Setup Hermetic Test Users, Categories & Products
-- ------------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'customer@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'staff@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'manager@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'admin@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'customer2@moodyorange.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, phone, full_name, email)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '+919876543210', 'Test Customer', 'customer@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000002', '+919876543211', 'Counter Staff', 'staff@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000003', '+919876543212', 'Store Manager', 'manager@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000004', '+919876543213', 'System Administrator', 'admin@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000005', '+919876543214', 'Second Customer', 'customer2@moodyorange.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staff_roles (user_id, role, is_active)
VALUES 
    ('00000000-0000-0000-0000-000000000002', 'counter_staff', true),
    ('00000000-0000-0000-0000-000000000003', 'manager', true),
    ('00000000-0000-0000-0000-000000000004', 'admin', true)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.categories (id, name, slug) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Category', 'test-category')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, category_id, name, slug, base_price)
VALUES 
    ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Constraint Prod 1', 'constraint-prod-1', 10000),
    ('e2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Constraint Prod 2', 'constraint-prod-2', 10000),
    ('e3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Constraint Prod 3', 'constraint-prod-3', 10000)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Constraints: Stock Balance, Currency Types & Negative Values
-- ------------------------------------------------------------------------------
SELECT throws_ok(
    $$ INSERT INTO public.products (category_id, name, slug, base_price) VALUES ('11111111-1111-1111-1111-111111111111', 'Bad Price Cake', 'bad-price-cake', -1000) $$,
    '23514',
    'chk_base_price_non_negative',
    'chk_base_price_non_negative must reject negative product price'
);

SELECT throws_ok(
    $$ INSERT INTO public.inventory (product_id, physical_stock, reserved_stock) VALUES ('e1111111-1111-1111-1111-111111111111', 5, 10) $$,
    '23514',
    'chk_stock_balance',
    'chk_stock_balance must reject reserved_stock > physical_stock'
);

SELECT throws_ok(
    $$ INSERT INTO public.inventory (product_id, physical_stock, reserved_stock) VALUES ('e2222222-2222-2222-2222-222222222222', -1, 0) $$,
    '23514',
    'chk_physical_non_negative',
    'chk_physical_non_negative must reject negative physical_stock'
);

SELECT throws_ok(
    $$ INSERT INTO public.inventory (product_id, physical_stock, reserved_stock) VALUES ('e3333333-3333-3333-3333-333333333333', 10, -2) $$,
    '23514',
    'chk_reserved_non_negative',
    'chk_reserved_non_negative must reject negative reserved_stock'
);

SELECT throws_ok(
    $$ INSERT INTO public.orders (
        order_number, customer_id, customer_phone, customer_name,
        estimated_pickup_at, order_status, payment_status, payment_method,
        subtotal_amount, total_amount, expires_at
    ) VALUES (
        'MO-TEST-CASH-EXP', '00000000-0000-0000-0000-000000000001', '+919876543210', 'Test User',
        NOW() + INTERVAL '1 hour', 'confirmed', 'unpaid', 'cash_at_pickup',
        10000, 10000, NOW() + INTERVAL '10 minutes'
    ) $$,
    '23514',
    'chk_cash_no_online_expiry',
    'chk_cash_no_online_expiry must reject cash orders with expires_at set'
);

-- ------------------------------------------------------------------------------
-- 3. Stored Procedures Existence & Execution Permissions
-- ------------------------------------------------------------------------------
SELECT has_function('rpc_reserve_order_stock', 'rpc_reserve_order_stock must exist');
SELECT has_function('rpc_release_expired_reservations', 'rpc_release_expired_reservations must exist');
SELECT has_function('rpc_reconcile_late_payment', 'rpc_reconcile_late_payment must exist');
SELECT has_function('rpc_complete_order_handover', 'rpc_complete_order_handover must exist');
SELECT has_function('rpc_write_off_inventory', 'rpc_write_off_inventory must exist');
SELECT has_function('rpc_cancel_order', 'rpc_cancel_order must exist');
SELECT has_function('rpc_issue_refund', 'rpc_issue_refund must exist');

-- ------------------------------------------------------------------------------
-- 4. Inventory Privacy & Availability View Verification
-- ------------------------------------------------------------------------------
SELECT results_eq(
    'SELECT count(*)::INT FROM public.product_availability WHERE product_id = ''e1111111-1111-1111-1111-111111111111''',
    'VALUES (1)',
    'product_availability view is accessible and returns record for product'
);

-- Anonymous role cannot query raw inventory
SELECT throws_ok(
    $$ SET LOCAL ROLE anon; SELECT * FROM public.inventory; $$,
    '42501',
    'permission denied for table inventory',
    'Anonymous role cannot query raw inventory table'
);
RESET ROLE;

-- ------------------------------------------------------------------------------
-- 5. Test RPC: Inventory Reservation, Upper Bounds & Customer Verification
-- ------------------------------------------------------------------------------
DELETE FROM public.refunds;
DELETE FROM public.payments;
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.inventory;
DELETE FROM public.products;
DELETE FROM public.categories;

INSERT INTO public.categories (id, name, slug) 
VALUES ('c0000000-0000-0000-0000-000000000001', 'Test Category', 'test-cat');

INSERT INTO public.products (id, category_id, name, slug, base_price, tax_rate_pct, prep_time_minutes)
VALUES ('p0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Choco Cake', 'choco-cake', 50000, 5.00, 15);

INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
VALUES ('p0000000-0000-0000-0000-000000000001', 50, 0);

-- 5a: Customer ID spoofing rejection
SELECT throws_ok(
    $$ SELECT * FROM public.rpc_reserve_order_stock(
        '99999999-9999-9999-9999-999999999999'::UUID, '+919876543210', 'Spoofed Customer',
        jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 1)),
        'immediate', NULL, 'online_razorpay', 'idemp-spoof', 'hash-spoof', NULL
    ) $$,
    'Customer 99999999-9999-9999-9999-999999999999 does not exist in auth.users.',
    'Customer ID spoofing must be rejected'
);

-- 5b: Quantity bounds and large quantity rejection (> 100 per line)
SELECT throws_ok(
    $$ SELECT * FROM public.rpc_reserve_order_stock(
        '00000000-0000-0000-0000-000000000001'::UUID, '+919876543210', 'Customer A',
        jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 150)),
        'immediate', NULL, 'online_razorpay', 'idemp-overflow', 'hash-overflow', NULL
    ) $$,
    'Product quantity must be between 1 and 100.',
    'Excessive line quantity must be rejected'
);

-- 5c: Empty cart rejection
SELECT throws_ok(
    $$ SELECT * FROM public.rpc_reserve_order_stock(
        '00000000-0000-0000-0000-000000000001'::UUID, '+919876543210', 'Customer A',
        '[]'::jsonb, 'immediate', NULL, 'online_razorpay', 'idemp-empty', 'hash', NULL
    ) $$,
    'Cart cannot be empty.',
    'Empty cart reservation must abort with exception'
);

-- 5d: Valid Online Reservation: 2 units (2 * 50000 + 5% tax = 105000 paise)
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001', '+919876543210', 'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 2)),
    'immediate', NULL, 'online_razorpay', 'idemp-001', 'hash-001', 'Extra candles'
);

SELECT results_eq(
    'SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (50, 2)',
    'Online reservation increments reserved_stock'
);

SELECT results_eq(
    'SELECT total_amount FROM public.orders WHERE client_idempotency_key = ''idemp-001''',
    'VALUES (105000::BIGINT)',
    'Authoritative server pricing calculates total in integer paise'
);

-- 5e: Concurrent Idempotency Replay (Returns existing order safely)
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001', '+919876543210', 'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 2)),
    'immediate', NULL, 'online_razorpay', 'idemp-001', 'hash-001', 'Extra candles'
);

SELECT results_eq(
    'SELECT reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (2)',
    'Idempotent duplicate request does not alter stock'
);

-- ------------------------------------------------------------------------------
-- 6. Test RPC: Expiration Worker Releases Exactly Once
-- ------------------------------------------------------------------------------
UPDATE public.orders SET expires_at = NOW() - INTERVAL '1 minute' WHERE client_idempotency_key = 'idemp-001';

SELECT public.rpc_release_expired_reservations();

SELECT results_eq(
    'SELECT order_status::TEXT FROM public.orders WHERE client_idempotency_key = ''idemp-001''',
    'VALUES (''cancelled_expired''::TEXT)',
    'Expired online order transitioned to cancelled_expired'
);

SELECT results_eq(
    'SELECT reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (0)',
    'Reserved stock accurately released for expired online order'
);

SELECT is(public.rpc_release_expired_reservations(), 0, 'Second run of expiration worker processes zero orders');

-- ------------------------------------------------------------------------------
-- 7. Test RPC: Payment Reconciliation, Currency Verification & Late Capture Tree
-- ------------------------------------------------------------------------------
-- 7a: Payment with NULL currency must be rejected
SELECT throws_ok(
    $$ SELECT * FROM public.rpc_reconcile_late_payment(
        (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-001'),
        'pay_razor_test_null', 'order_razor_test_001', 105000::BIGINT, NULL, '{}'::jsonb
    ) $$,
    'Invalid payment currency: . Must be exactly INR.',
    'NULL payment currency must be rejected'
);

-- 7b: Payment with non-INR currency must be rejected
SELECT throws_ok(
    $$ SELECT * FROM public.rpc_reconcile_late_payment(
        (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-001'),
        'pay_razor_test_usd', 'order_razor_test_001', 105000::BIGINT, 'USD', '{}'::jsonb
    ) $$,
    'Invalid payment currency: USD. Must be exactly INR.',
    'Non-INR payment currency must be rejected'
);

-- 7c: Late payment after reservation expiry triggers atomic re-allocation if stock available
SELECT * FROM public.rpc_reconcile_late_payment(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-001'),
    'pay_razor_late_001', 'order_razor_test_001', 105000::BIGINT, 'INR', '{}'::jsonb
);

SELECT results_eq(
    'SELECT order_status::TEXT, payment_status::TEXT FROM public.orders WHERE client_idempotency_key = ''idemp-001''',
    'VALUES (''confirmed''::TEXT, ''captured''::TEXT)',
    'Late payment re-allocates available stock and confirms order'
);

-- 7d: Duplicate payment webhook with identical provider ID handled idempotently
SELECT results_eq(
    'SELECT out_action FROM public.rpc_reconcile_late_payment(
        (SELECT id FROM public.orders WHERE client_idempotency_key = ''idemp-001''),
        ''pay_razor_late_001'', ''order_razor_test_001'', 105000::BIGINT, ''INR'', ''{}''::jsonb
    )',
    'VALUES (''DUPLICATE_EVENT''::VARCHAR)',
    'Duplicate payment webhook returns DUPLICATE_EVENT without error'
);

-- 7e: Reusing provider payment ID on a different order rejected
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000005', '+919876543214', 'Customer 2',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 2)),
    'immediate', NULL, 'online_razorpay', 'idemp-diff-order', 'hash-diff', NULL
);

SELECT throws_ok(
    $$ SELECT * FROM public.rpc_reconcile_late_payment(
        (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-diff-order'),
        'pay_razor_late_001', 'order_razor_test_002', 105000::BIGINT, 'INR', '{}'::jsonb
    ) $$,
    'Provider payment ID pay_razor_late_001 already exists for different order',
    'Reusing provider payment ID on different order is rejected'
);

-- ------------------------------------------------------------------------------
-- 8. Test RPC: Role-Verified Order Cancellation (No Caller-Controlled Flag)
-- ------------------------------------------------------------------------------
-- 8a: Customer cannot cancel order once preparation begins (kitchen prep protection)
UPDATE public.orders SET order_status = 'preparing' WHERE client_idempotency_key = 'idemp-001';

SELECT throws_ok(
    $$ SELECT public.rpc_cancel_order(
        (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-001'),
        '00000000-0000-0000-0000-000000000001'::UUID,
        'Customer cancelled late'
    ) $$,
    'Customer cannot cancel order once preparation has begun.',
    'Customer cannot cancel order during preparation'
);

-- 8b: Staff member can cancel order during preparation (role verified from DB)
SELECT public.rpc_cancel_order(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-001'),
    '00000000-0000-0000-0000-000000000002',
    'Counter staff cancellation'
);

SELECT results_eq(
    'SELECT order_status::TEXT, payment_status::TEXT FROM public.orders WHERE client_idempotency_key = ''idemp-001''',
    'VALUES (''cancelled_by_staff''::TEXT, ''refund_pending''::TEXT)',
    'Staff cancellation sets status to cancelled_by_staff and marks payment refund_pending'
);

-- 8c: Repeated cancellation call is idempotent
SELECT public.rpc_cancel_order(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-001'),
    '00000000-0000-0000-0000-000000000002',
    'Staff cancellation repeated'
);

-- ------------------------------------------------------------------------------
-- 9. Test RPC: Refunds, Staff Spoofing & Cash Order Immunity
-- ------------------------------------------------------------------------------
-- 9a: Staff ID spoofing rejection (Customer attempting refund)
SELECT throws_ok(
    $$ SELECT * FROM public.rpc_issue_refund(
        (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-001'),
        20000::BIGINT, '00000000-0000-0000-0000-000000000001'::UUID, 'Spoofed refund', 'ref-spoof'
    ) $$,
    'Staff member 00000000-0000-0000-0000-000000000001 is not authorized to issue refunds (must be manager or admin).',
    'Customer cannot issue refund'
);

-- 9b: Valid partial refund by manager
SELECT * FROM public.rpc_issue_refund(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-001'),
    50000::BIGINT, '00000000-0000-0000-0000-000000000003', 'Manager partial refund', 'ref-mgr-01'
);

SELECT results_eq(
    'SELECT status::TEXT, amount FROM public.refunds WHERE idempotency_key = ''ref-mgr-01''',
    'VALUES (''refund_pending''::TEXT, 50000::BIGINT)',
    'Valid refund created in refund_pending status'
);

-- 9c: Cash order cannot enter online gateway refund
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001', '+919876543210', 'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 1)),
    'immediate', NULL, 'cash_at_pickup', 'idemp-cash-refund-test', 'hash-cash', NULL
);

SELECT throws_ok(
    $$ SELECT * FROM public.rpc_issue_refund(
        (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-cash-refund-test'),
        52500::BIGINT, '00000000-0000-0000-0000-000000000003'::UUID, 'Attempt online refund on cash', 'ref-cash-bad'
    ) $$,
    'Cannot issue online gateway refund for cash-at-pickup order',
    'Cash orders cannot enter online refund flow'
);

SELECT * FROM finish();
ROLLBACK;
