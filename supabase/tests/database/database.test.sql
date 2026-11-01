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
PREPARE bad_price AS INSERT INTO public.products (category_id, name, slug, base_price)
VALUES ('11111111-1111-1111-1111-111111111111', 'Bad Price Cake', 'bad-price-cake', -1000);
SELECT throws_ok('bad_price', '23514', 'chk_base_price_non_negative must reject negative product price');

PREPARE bad_stock AS INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
VALUES ('e1111111-1111-1111-1111-111111111111', 5, 10);
SELECT throws_ok('bad_stock', '23514', 'chk_stock_balance must reject reserved_stock > physical_stock');

PREPARE negative_physical AS INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
VALUES ('e2222222-2222-2222-2222-222222222222', -1, 0);
SELECT throws_ok('negative_physical', '23514', 'chk_physical_non_negative must reject negative physical_stock');

PREPARE negative_reserved AS INSERT INTO public.inventory (product_id, physical_stock, reserved_stock)
VALUES ('e3333333-3333-3333-3333-333333333333', 10, -2);
SELECT throws_ok('negative_reserved', '23514', 'chk_reserved_non_negative must reject negative reserved_stock');

PREPARE bad_cash_expiry AS INSERT INTO public.orders (
    order_number, customer_id, customer_phone, customer_name,
    estimated_pickup_at, order_status, payment_status, payment_method,
    subtotal_amount, total_amount, expires_at
) VALUES (
    'MO-TEST-CASH-EXP', '00000000-0000-0000-0000-000000000001', '+919876543210', 'Test User',
    NOW() + INTERVAL '1 hour', 'confirmed', 'unpaid', 'cash_at_pickup',
    10000, 10000, NOW() + INTERVAL '10 minutes'
);
SELECT throws_ok('bad_cash_expiry', '23514', 'chk_cash_no_online_expiry must reject cash orders with expires_at set');

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
-- Direct inventory SELECT is revoked from anon
-- Product availability view is viewable and returns boolean is_in_stock
SELECT results_eq(
    'SELECT count(*)::INT FROM public.product_availability WHERE product_id = ''e1111111-1111-1111-1111-111111111111''',
    'VALUES (1)',
    'product_availability view is accessible and returns record for product'
);

-- ------------------------------------------------------------------------------
-- 5. Test RPC: Inventory Reservation Input Validation & Atomicity
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
VALUES ('p0000000-0000-0000-0000-000000000001', 10, 0);

-- 5a: Empty cart must be rejected
PREPARE empty_cart AS SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001', '+919876543210', 'Customer A',
    '[]'::jsonb, 'immediate', NULL, 'online_razorpay', 'idemp-empty', 'hash', NULL
);
SELECT throws_ok('empty_cart', 'Cart cannot be empty.', 'Empty cart reservation must abort with exception');

-- 5b: Malformed non-positive or negative quantity must be rejected
PREPARE negative_qty_cart AS SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001', '+919876543210', 'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', -1)),
    'immediate', NULL, 'online_razorpay', 'idemp-neg', 'hash', NULL
);
SELECT throws_ok('negative_qty_cart', 'Malformed cart item: quantity must be a positive integer.', 'Negative quantity cart item must be rejected');

-- 5c: Non-existent customer must be rejected
PREPARE invalid_customer AS SELECT * FROM public.rpc_reserve_order_stock(
    '99999999-9999-9999-9999-999999999999', '+919876543210', 'Customer X',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 1)),
    'immediate', NULL, 'online_razorpay', 'idemp-cust', 'hash', NULL
);
SELECT throws_ok('invalid_customer', 'Customer 99999999-9999-9999-9999-999999999999 does not exist in auth.users.', 'Non-existent customer must be rejected');

-- 5d: Valid Online Reservation: 2 units
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001', '+919876543210', 'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 2)),
    'immediate', NULL, 'online_razorpay', 'idemp-001', 'hash-001', 'Extra candles'
);

SELECT results_eq(
    'SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (10, 2)',
    'Online reservation increments reserved_stock without altering physical_stock'
);

-- Total amount calculation check (2 * 50000 + 5% tax = 100000 + 5000 = 105000 paise)
SELECT results_eq(
    'SELECT total_amount FROM public.orders WHERE client_idempotency_key = ''idemp-001''',
    'VALUES (105000::BIGINT)',
    'Authoritative server pricing calculates total in integer paise'
);

-- 5e: Idempotency key hijacking by different customer must be rejected
PREPARE hijack_idemp AS SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000005', '+919876543214', 'Second Customer',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 1)),
    'immediate', NULL, 'online_razorpay', 'idemp-001', 'hash-001', NULL
);
SELECT throws_ok('hijack_idemp', 'Idempotency key idemp-001 belongs to a different customer.', 'Idempotency key cannot be hijacked by another customer');

-- 5f: Idempotent replay by same customer returns existing order
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001', '+919876543210', 'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 2)),
    'immediate', NULL, 'online_razorpay', 'idemp-001', 'hash-001', 'Extra candles'
);

SELECT results_eq(
    'SELECT reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (2)',
    'Idempotent replay does not double-reserve stock'
);

-- 5g: Oversell attempt rejected
PREPARE oversell_order AS SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001', '+919876543210', 'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 15)),
    'immediate', NULL, 'online_razorpay', 'idemp-oversell', 'hash-oversell', NULL
);
SELECT throws_ok('oversell_order', 'Oversell attempt must abort and leave stock intact');

-- ------------------------------------------------------------------------------
-- 6. Test RPC: Expiration Worker Releases Exactly Once
-- ------------------------------------------------------------------------------
-- Create a cash order to test immunity to expiration worker
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001', '+919876543210', 'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 3)),
    'immediate', NULL, 'cash_at_pickup', 'idemp-cash-01', 'hash-cash-01', NULL
);

-- Total reserved stock: 2 (online) + 3 (cash) = 5
SELECT results_eq(
    'SELECT physical_stock, reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (10, 5)',
    'Total reserved stock correctly reflects active reservations'
);

-- Expire online order
UPDATE public.orders SET expires_at = NOW() - INTERVAL '1 minute' WHERE client_idempotency_key = 'idemp-001';

-- Run expiration worker
SELECT public.rpc_release_expired_reservations();

SELECT results_eq(
    'SELECT order_status::TEXT FROM public.orders WHERE client_idempotency_key = ''idemp-001''',
    'VALUES (''cancelled_expired''::TEXT)',
    'Expired online order transitioned to cancelled_expired'
);

SELECT results_eq(
    'SELECT order_status::TEXT FROM public.orders WHERE client_idempotency_key = ''idemp-cash-01''',
    'VALUES (''confirmed''::TEXT)',
    'Cash order is immune to reservation expiration worker'
);

SELECT results_eq(
    'SELECT reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (3)',
    'Reserved stock accurately released only for expired online order'
);

-- Run expiration worker again: processes zero orders
SELECT is(public.rpc_release_expired_reservations(), 0, 'Second run of expiration worker processes zero orders');

-- ------------------------------------------------------------------------------
-- 7. Test RPC: Order Cancellation Invariants & Repeated Calls
-- ------------------------------------------------------------------------------
-- 7a: Unauthorized customer cannot cancel another customer's order
PREPARE unauth_cancel AS SELECT public.rpc_cancel_order(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-cash-01'),
    '00000000-0000-0000-0000-000000000005',
    'Malicious customer attempt',
    false
);
SELECT throws_ok('unauth_cancel', 'Customer 00000000-0000-0000-0000-000000000005 is not authorized to cancel order', 'Customer cannot cancel another customers order');

-- 7b: Valid customer cancellation of cash order releases stock
SELECT public.rpc_cancel_order(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-cash-01'),
    '00000000-0000-0000-0000-000000000001',
    'Customer changed mind',
    false
);

SELECT results_eq(
    'SELECT reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (0)',
    'Cancelling cash order releases reserved stock back to 0'
);

-- 7c: Repeated cancellation call is idempotent and does NOT decrement stock again
SELECT public.rpc_cancel_order(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-cash-01'),
    '00000000-0000-0000-0000-000000000001',
    'Customer changed mind again',
    false
);

SELECT results_eq(
    'SELECT reserved_stock FROM public.inventory WHERE product_id = ''p0000000-0000-0000-0000-000000000001''',
    'VALUES (0)',
    'Repeated cancellation does not double-decrement reserved stock'
);

-- ------------------------------------------------------------------------------
-- 8. Test RPC: Payment Reconciliation Deduplication & Cross-Order Hijack
-- ------------------------------------------------------------------------------
-- Setup order for payment reconciliation
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000001', '+919876543210', 'Customer A',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 1)),
    'immediate', NULL, 'online_razorpay', 'idemp-pay-01', 'hash-pay-01', NULL
);

-- Reconcile payment on draft order (1 * 50000 + 5% tax = 52500 paise)
SELECT * FROM public.rpc_reconcile_late_payment(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-pay-01'),
    'pay_razor_test_001',
    'order_razor_test_001',
    52500::BIGINT,
    'INR',
    '{}'::jsonb
);

SELECT results_eq(
    'SELECT order_status::TEXT, payment_status::TEXT FROM public.orders WHERE client_idempotency_key = ''idemp-pay-01''',
    'VALUES (''confirmed''::TEXT, ''captured''::TEXT)',
    'Payment reconciliation transitions draft order to confirmed/captured'
);

-- 8a: Duplicate payment webhook on same order is handled idempotently
SELECT results_eq(
    'SELECT out_action FROM public.rpc_reconcile_late_payment(
        (SELECT id FROM public.orders WHERE client_idempotency_key = ''idemp-pay-01''),
        ''pay_razor_test_001'', ''order_razor_test_001'', 52500::BIGINT, ''INR'', ''{}''::jsonb
    )',
    'VALUES (''DUPLICATE_EVENT''::VARCHAR)',
    'Duplicate payment webhook returns DUPLICATE_EVENT without error or double action'
);

-- 8b: Duplicate provider payment ID reused for a different order must be rejected
SELECT * FROM public.rpc_reserve_order_stock(
    '00000000-0000-0000-0000-000000000005', '+919876543214', 'Customer 2',
    jsonb_build_array(jsonb_build_object('product_id', 'p0000000-0000-0000-0000-000000000001', 'quantity', 1)),
    'immediate', NULL, 'online_razorpay', 'idemp-pay-02', 'hash-pay-02', NULL
);

PREPARE payment_hijack AS SELECT * FROM public.rpc_reconcile_late_payment(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-pay-02'),
    'pay_razor_test_001',
    'order_razor_test_002',
    52500::BIGINT,
    'INR',
    '{}'::jsonb
);
SELECT throws_ok('payment_hijack', 'Provider payment ID pay_razor_test_001 already exists for different order', 'Payment provider ID reuse on another order must abort');

-- ------------------------------------------------------------------------------
-- 9. Test RPC: Order Handover & Cancellation of Completed Order Rejection
-- ------------------------------------------------------------------------------
UPDATE public.orders SET order_status = 'ready_for_pickup' WHERE client_idempotency_key = 'idemp-pay-01';

-- 9a: Handover by non-staff must be rejected
PREPARE unauth_handover AS SELECT public.rpc_complete_order_handover(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-pay-01'),
    '00000000-0000-0000-0000-000000000001',
    false
);
SELECT throws_ok('unauth_handover', 'Staff member 00000000-0000-0000-0000-000000000001 is not active staff.', 'Handover requires active staff');

-- 9b: Valid handover by counter_staff
SELECT public.rpc_complete_order_handover(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-pay-01'),
    '00000000-0000-0000-0000-000000000002',
    false
);

SELECT results_eq(
    'SELECT order_status::TEXT FROM public.orders WHERE client_idempotency_key = ''idemp-pay-01''',
    'VALUES (''completed''::TEXT)',
    'Completed handover sets status to completed'
);

-- 9c: Cancellation of completed order must be rejected
PREPARE cancel_completed AS SELECT public.rpc_cancel_order(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-pay-01'),
    '00000000-0000-0000-0000-000000000003',
    'Manager trying to cancel completed order',
    true
);
SELECT throws_ok('cancel_completed', 'is already completed and cannot be cancelled.', 'Completed orders cannot be cancelled');

-- ------------------------------------------------------------------------------
-- 10. Test RPC: Refunds, Cumulative Caps & Idempotency Mismatch
-- ------------------------------------------------------------------------------
-- 10a: Counter staff cannot issue refunds (only manager/admin)
PREPARE unauth_refund AS SELECT * FROM public.rpc_issue_refund(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-pay-01'),
    10000::BIGINT,
    '00000000-0000-0000-0000-000000000002',
    'Counter staff attempting refund',
    'ref-idemp-01'
);
SELECT throws_ok('unauth_refund', 'Staff member 00000000-0000-0000-0000-000000000002 is not authorized to issue refunds (must be manager or admin).', 'Counter staff cannot issue refunds');

-- 10b: Refund exceeding captured amount (captured is 52500, request 60000) must be rejected
PREPARE excess_refund AS SELECT * FROM public.rpc_issue_refund(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-pay-01'),
    60000::BIGINT,
    '00000000-0000-0000-0000-000000000003',
    'Manager partial refund',
    'ref-idemp-excess'
);
SELECT throws_ok('excess_refund', 'REFUND_EXCEEDS_REMAINING_AMOUNT', 'Refund exceeding captured amount must be rejected');

-- 10c: Valid partial refund (20000 paise) by manager
SELECT * FROM public.rpc_issue_refund(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-pay-01'),
    20000::BIGINT,
    '00000000-0000-0000-0000-000000000003',
    'Customer dissatisfaction discount',
    'ref-idemp-partial-01'
);

SELECT results_eq(
    'SELECT status::TEXT, amount FROM public.refunds WHERE idempotency_key = ''ref-idemp-partial-01''',
    'VALUES (''refund_pending''::TEXT, 20000::BIGINT)',
    'Partial refund created in refund_pending status'
);

-- 10d: Refund idempotency key reused with mismatched amount must be rejected
PREPARE ref_mismatch AS SELECT * FROM public.rpc_issue_refund(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-pay-01'),
    30000::BIGINT,
    '00000000-0000-0000-0000-000000000003',
    'Mismatched amount replay',
    'ref-idemp-partial-01'
);
SELECT throws_ok('ref_mismatch', 'Refund idempotency key reused with mismatched parameters.', 'Refund idempotency mismatch must be rejected');

-- 10e: Remaining cumulative cap: captured was 52500, refunded 20000, remaining is 32500
-- Attempting to refund 35000 exceeds 32500 and must be rejected
PREPARE excess_second_refund AS SELECT * FROM public.rpc_issue_refund(
    (SELECT id FROM public.orders WHERE client_idempotency_key = 'idemp-pay-01'),
    35000::BIGINT,
    '00000000-0000-0000-0000-000000000003',
    'Second excess refund',
    'ref-idemp-excess-02'
);
SELECT throws_ok('excess_second_refund', 'REFUND_EXCEEDS_REMAINING_AMOUNT', 'Second refund exceeding remaining captured balance must be rejected');

-- ------------------------------------------------------------------------------
-- 11. Test RPC: Inventory Write-Off Authorization & Protection
-- ------------------------------------------------------------------------------
-- 11a: Counter staff cannot write off inventory
PREPARE unauth_write_off AS SELECT * FROM public.rpc_write_off_inventory(
    'p0000000-0000-0000-0000-000000000001',
    1,
    '00000000-0000-0000-0000-000000000002',
    'Counter staff write off'
);
SELECT throws_ok('unauth_write_off', 'Staff member 00000000-0000-0000-0000-000000000002 is not authorized to write off inventory (must be manager or admin).', 'Counter staff cannot write off inventory');

-- 11b: Valid manager write-off
SELECT * FROM public.rpc_write_off_inventory(
    'p0000000-0000-0000-0000-000000000001',
    1,
    '00000000-0000-0000-0000-000000000003',
    'Broken during restocking'
);

SELECT * FROM finish();
ROLLBACK;
