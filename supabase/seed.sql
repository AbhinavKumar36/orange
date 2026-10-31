-- ==============================================================================
-- Moody Orange — Local Development Seed Data
-- ==============================================================================

-- 1. Mock Users in auth.users (for local dev / test)
INSERT INTO auth.users (id, email, created_at)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'customer@moodyorange.local', NOW()),
    ('00000000-0000-0000-0000-000000000002', 'staff@moodyorange.local', NOW()),
    ('00000000-0000-0000-0000-000000000003', 'manager@moodyorange.local', NOW()),
    ('00000000-0000-0000-0000-000000000004', 'admin@moodyorange.local', NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Profiles
INSERT INTO public.profiles (id, phone, full_name, email)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '+919876543210', 'Demo Customer', 'customer@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000002', '+919876543211', 'Counter Staff', 'staff@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000003', '+919876543212', 'Store Manager', 'manager@moodyorange.local'),
    ('00000000-0000-0000-0000-000000000004', '+919876543213', 'System Administrator', 'admin@moodyorange.local')
ON CONFLICT (id) DO NOTHING;

-- 3. Staff Roles
INSERT INTO public.staff_roles (user_id, role, is_active)
VALUES 
    ('00000000-0000-0000-0000-000000000002', 'counter_staff', true),
    ('00000000-0000-0000-0000-000000000003', 'manager', true),
    ('00000000-0000-0000-0000-000000000004', 'admin', true)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Categories
INSERT INTO public.categories (id, name, slug, description, display_order, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Artisanal Cakes', 'artisanal-cakes', 'Freshly baked boutique gourmet cakes', 1, true),
    ('22222222-2222-2222-2222-222222222222', 'Cold-Pressed Juices', 'cold-pressed-juices', 'Raw, 100% natural cold-pressed fruit juices', 2, true),
    ('33333333-3333-3333-3333-333333333333', 'Gourmet Chocolates', 'gourmet-chocolates', 'Handcrafted single-origin chocolate confections', 3, true)
ON CONFLICT (id) DO NOTHING;

-- 5. Products
INSERT INTO public.products (id, category_id, name, slug, description, base_price, tax_rate_pct, is_veg, allergens, prep_time_minutes, is_active)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Dark Chocolate Truffle Cake (500g)', 'dark-chocolate-truffle-cake-500g', '70% Belgian dark chocolate sponge with silky ganache', 650.00, 5.00, true, ARRAY['dairy', 'gluten'], 20, true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Valencia Orange Cold-Pressed (300ml)', 'valencia-orange-cold-pressed-300ml', 'Pure Valencia orange juice freshly pressed daily', 180.00, 5.00, true, ARRAY[]::TEXT[], 5, true),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Artisanal Praline Box (6 pcs)', 'artisanal-praline-box-6-pcs', 'Assorted roasted hazelnut and almond pralines', 350.00, 5.00, true, ARRAY['nuts', 'dairy'], 10, true)
ON CONFLICT (id) DO NOTHING;

-- 6. Initial Inventory
INSERT INTO public.inventory (product_id, physical_stock, reserved_stock, low_stock_threshold, last_restocked_at)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 10, 0, 3, NOW()),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 25, 0, 5, NOW()),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 15, 0, 4, NOW())
ON CONFLICT (product_id) DO UPDATE 
SET physical_stock = EXCLUDED.physical_stock,
    reserved_stock = EXCLUDED.reserved_stock;
