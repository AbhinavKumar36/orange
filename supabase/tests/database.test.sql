-- ==============================================================================
-- Moody Orange — pgTAP Database Test Suite
-- Document Reference: docs/phase-0/TESTING_STRATEGY.md & IMPLEMENTATION_ROADMAP.md
-- ==============================================================================

BEGIN;

-- Load pgTAP extension if available
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

-- ------------------------------------------------------------------------------
-- Setup Hermetic Test Users, Categories & Products
-- Ensures foreign keys are satisfied for all subsequent tests
-- ------------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'customer@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'staff@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'manager@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'admin@moodyorange.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, phone, full_name, email)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '+919876543210', 'Test Customer', 'customer@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000002', '+919876543211', 'Counter Staff', 'staff@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000003', '+919876543212', 'Store Manager', 'manager@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000004', '+919876543213', 'System Administrator', 'admin@moodyorange.local')
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
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Test Prod A', 'test-prod-a', 100.00),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Test Prod B', 'test-prod-b', 100.00),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Test Prod C', 'test-prod-c', 100.00)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Constraints: Stock Balance & Negative Values
-- ------------------------------------------------------------------------------
-- Test negative product base_price rejection
PREPARE bad_price AS INSERT INTO public.products (category_id, name, slug, base_price)
VALUES ('11111111-1111-1111-1111-111111111111', 'Bad Price Cake', 'bad-price-cake', -10.00);
SELECT throws_ok('bad_price', '23514', NULL, 'chk_base_price_non_negative must reject negative product price');

-- Test stock balance invariant: reserved_stock cannot exceed physical_stock
PREPARE bad_stock AS INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5, 10);
SELECT throws_ok('bad_stock', '23514', NULL, 'chk_stock_balance must reject reserved_stock > physical_stock');

-- Test negative physical_stock rejection
PREPARE negative_physical AS INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -1, 0);
SELECT throws_ok('negative_physical', '23514', NULL, 'chk_physical_non_negative must reject negative physical_stock');

-- Test negative reserved_stock rejection
PREPARE negative_reserved AS INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 10, -2);
SELECT throws_ok('negative_reserved', '23514', NULL, 'chk_reserved_non_negative must reject negative reserved_stock');

-- Test Cash Order expiry constraint: cash orders must NOT have an online expiry timestamp
PREPARE bad_cash_expiry AS INSERT INTO public.orders (
    order_number, customer_id, customer_phone, customer_name,
    estimated_pickup_at, order_status, payment_status, payment_method,
    subtotal_amount, total_amount, expires_at
) VALUES (
    'MO-TEST-CASH-EXP', '00000000-0000-0000-0000-000000000001', '+919876543210', 'Test User',
    NOW() + INTERVAL '1 hour', 'confirmed', 'unpaid', 'cash_at_pickup',
    100.00, 100.00, NOW() + INTERVAL '10 minutes'
);
SELECT throws_ok('bad_cash_expiry', '23514', NULL, 'chk_cash_no_online_expiry must reject cash orders with expires_at set');

-- ------------------------------------------------------------------------------
-- 3. Stored Procedures Existence & Execution Permissions
-- ------------------------------------------------------------------------------
SELECT has_function('public', 'rpc_reserve_order_stock', 'rpc_reserve_order_stock must exist');
SELECT has_function('public', 'rpc_release_expired_reservations', 'rpc_release_expired_reservations must exist');
SELECT has_function('public', 'rpc_reconcile_late_payment', 'rpc_reconcile_late_payment must exist');
SELECT has_function('public', 'rpc_complete_order_handover', 'rpc_complete_order_handover must exist');
SELECT has_function('public', 'rpc_write_off_inventory', 'rpc_write_off_inventory must exist');
SELECT has_function('public', 'rpc_cancel_order', 'rpc_cancel_order must exist');
SELECT has_function('public', 'rpc_issue_refund', 'rpc_issue_refund must exist');

-- ------------------------------------------------------------------------------
-- 4. Test RPC: Inventory Reservation (Online & Cash Parity)
-- ------------------------------------------------------------------------------
-- Setup test product and clean inventory
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.inventory;
DELETE FROM public.products;
DELETE FROM public.categories;

INSERT INTO public.categories (id, name, slug) 
VALUES ('c0000000-0000-0000-0000-000000000001', 'Test Category', 'test-cat');

INSERT INTO public.products (id, category_id, name, slug, base_price, tax_rate_pct, prep_time_minutes)
VALUES ('p0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Choco Cake', 'choco-cake', 500.00, 5.00, 15);

INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
VALUES ('p0000000-0000-0000-0000-000000000001', 10, 0);

-- Action 1: Reserve 2 units online
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001',
    '+919876543210',
    'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 2)),
    'immediate',
    NULL,
    'online_razorpay',
    'idemp-001',
    'hash-001',
    'Extra candles'
);

-- Assert stock reservation
SELECT results_eq(
    'SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (10, 2)',
    'Online reservation increments reserved_stock without altering physical_stock'
);

-- Assert online order state
SELECT results_eq(
    'SELECT order_status::TEXT, payment_status::TEXT, expires_at IS NOT NULL FROM public.orders WHERE client_idempotency_key = ''idemp-001''',
    'VALUES (''draft''::TEXT, ''pending''::TEXT, true)',
    'Online reservation starts in draft/pending with expires_at set'
);

-- Action 2: Idempotent replay of reservation
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001',
    '+919876543210',
    'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 2)),
    'immediate',
    NULL,
    'online_razorpay',
    'idemp-001',
    'hash-001',
    'Extra candles'
);

SELECT results_eq(
    'SELECT reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (2)',
    'Idempotent replay does not double-reserve stock'
);

-- Action 3: Reusing idempotency key with mismatched payload must abort
PREPARE mismatched_idemp AS SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001',
    '+919876543210',
    'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 2)),
    'immediate',
    NULL,
    'online_razorpay',
    'idemp-001',
    'different-payload-hash',
    'Extra candles'
);
SELECT throws_ok('mismatched_idemp', NULL, 'Idempotency key reused with mismatched order payload.', 'Payload mismatch must abort with exception');

-- Action 4: All-or-Nothing Oversell Rejection
PREPARE oversell_order AS SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001',
    '+919876543210',
    'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 15)),
    'immediate',
    NULL,
    'online_razorpay',
    'idemp-oversell',
    'hash-oversell',
    NULL
);
SELECT throws_ok('oversell_order', NULL, NULL, 'Oversell attempt must abort and leave stock intact');

-- ------------------------------------------------------------------------------
-- 5. Test RPC: Cash-at-Pickup Order Lifecycle
-- ------------------------------------------------------------------------------
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001',
    '+919876543210',
    'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 3)),
    'immediate',
    NULL,
    'cash_at_pickup',
    'idemp-cash-01',
    'hash-cash-01',
    NULL
);

SELECT results_eq(
    'SELECT order_status::TEXT, payment_status::TEXT, expires_at IS NULL FROM public.orders WHERE client_idempotency_key = ''idemp-cash-01''',
    'VALUES (''confirmed''::TEXT, ''unpaid''::TEXT, true)',
    'Cash order is confirmed immediately with unpaid status and no expiration timestamp'
);

-- Total reserved stock is now 2 (online) + 3 (cash) = 5
SELECT results_eq(
    'SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (10, 5)',
    'Total reserved stock correctly reflects both active online and cash reservations'
);

-- ------------------------------------------------------------------------------
-- 6. Test RPC: Cash Order Immunity to Expiration Worker
-- ------------------------------------------------------------------------------
-- Manually expire the online draft order
UPDATE public.orders 
SET expires_at = NOW() - INTERVAL '1 minute' 
WHERE client_idempotency_key = 'idemp-001';

-- Run expiration worker
SELECT public.rpc_release_expired_reservations();

-- Online order expired, cash order untouched
SELECT results_eq(
    'SELECT order_status::TEXT FROM public.orders WHERE client_idempotency_key = ''idemp-001''',
    'VALUES (''cancelled_expired''::TEXT)',
    'Expired online draft order transitioned to cancelled_expired'
);

SELECT results_eq(
    'SELECT order_status::TEXT, payment_status::TEXT FROM public.orders WHERE client_idempotency_key = ''idemp-cash-01''',
    'VALUES (''confirmed''::TEXT, ''unpaid''::TEXT)',
    'Cash order is immune to reservation expiration worker'
);

-- Reserved stock dropped from 5 to 3 (only the 2 online units released)
SELECT results_eq(
    'SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (10, 3)',
    'Reserved stock accurately released only for the expired online order'
);

-- Running expiration worker a second time does not double-decrement
SELECT is(public.rpc_release_expired_reservations(), 0, 'Second run of expiration worker processes zero orders');
SELECT results_eq(
    'SELECT reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (3)',
    'Releasing reservations twice does not release stock twice'
);

-- ------------------------------------------------------------------------------
-- 7. Test RPC: Protected Inventory Write-Off
-- ------------------------------------------------------------------------------
-- Attempt to write off 8 units when physical=10, reserved=3 (available=7)
-- 8 > 7, so write off must be blocked to protect the cash order
PREPARE blocked_write_off AS SELECT * FROM public.rpc_write_off_inventory(
    'p0000000-0000-0000-0000-000000000001',
    8,
    '00000000-0000-0000-0000-000000000003',
    'Spilled batch'
);
SELECT throws_ok('blocked_write_off', NULL, NULL, 'Write-off exceeding available stock must be blocked');

-- Writing off 2 units (2 <= 7) succeeds cleanly
SELECT * FROM public.rpc_write_off_inventory(
    'p0000000-0000-0000-0000-000000000001',
    2,
    '00000000-0000-0000-0000-000000000003',
    'Sample test spoilage'
);

SELECT results_eq(
    'SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (8, 3)',
    'Permitted write-off decrements physical_stock while leaving reserved_stock intact'
);

-- ------------------------------------------------------------------------------
-- 8. Test RPC: Handover Decrements Physical & Reserved Stock Atomically
-- ------------------------------------------------------------------------------
-- Transition cash order to ready_for_pickup
UPDATE public.orders 
SET order_status = 'ready_for_pickup' 
WHERE client_idempotency_key = 'idemp-cash-01';

-- Handover requires cash confirmation
SELECT public.rpc_complete_order_handover(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-cash-01'),
    '00000000-0000-0000-0000-000000000002',
    true
);

SELECT results_eq(
    'SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (5, 0)',
    'Counter handover decrements both physical and reserved stock atomically'
);

SELECT * FROM finish();
ROLLBACK;
