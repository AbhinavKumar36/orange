-- ==============================================================================
-- Moody Orange — Migration 2: Row Level Security (RLS) & Role Privileges
-- Document Reference: docs/phase-0/DATABASE_DESIGN.md & SECURITY_PLAN.md
-- ==============================================================================

-- 1. Helper Function: get_staff_role()
CREATE OR REPLACE FUNCTION public.get_staff_role()
RETURNS staff_role_enum 
LANGUAGE sql 
SECURITY DEFINER 
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.staff_roles 
  WHERE user_id = auth.uid() AND is_active = true;
$$;

REVOKE EXECUTE ON FUNCTION public.get_staff_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_role() TO authenticated, service_role;

-- 2. Enable Row Level Security Across All 10 Core Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Table 1: PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Staff can view customer profiles" ON public.profiles;
CREATE POLICY "Staff can view customer profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (public.get_staff_role() IS NOT NULL);

-- Table 2: STAFF ROLES
DROP POLICY IF EXISTS "Staff can view their own role" ON public.staff_roles;
CREATE POLICY "Staff can view their own role" ON public.staff_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all staff roles" ON public.staff_roles;
CREATE POLICY "Admins can view all staff roles" ON public.staff_roles
    FOR SELECT TO authenticated
    USING (public.get_staff_role() = 'admin');

DROP POLICY IF EXISTS "Admins can manage staff roles" ON public.staff_roles;
CREATE POLICY "Admins can manage staff roles" ON public.staff_roles
    FOR ALL TO authenticated
    USING (public.get_staff_role() = 'admin');

-- Table 3: CATEGORIES
DROP POLICY IF EXISTS "Public categories are viewable" ON public.categories;
CREATE POLICY "Public categories are viewable" ON public.categories
    FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Staff can view all categories" ON public.categories;
CREATE POLICY "Staff can view all categories" ON public.categories
    FOR SELECT TO authenticated
    USING (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "Managers can manage categories" ON public.categories;
CREATE POLICY "Managers can manage categories" ON public.categories
    FOR ALL TO authenticated
    USING (public.get_staff_role() IN ('manager', 'admin'));

-- Table 4: PRODUCTS
DROP POLICY IF EXISTS "Public products are viewable" ON public.products;
CREATE POLICY "Public products are viewable" ON public.products
    FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Staff can view all products" ON public.products;
CREATE POLICY "Staff can view all products" ON public.products
    FOR SELECT TO authenticated
    USING (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "Managers can manage products" ON public.products;
CREATE POLICY "Managers can manage products" ON public.products
    FOR ALL TO authenticated
    USING (public.get_staff_role() IN ('manager', 'admin'));

-- Table 5: INVENTORY
DROP POLICY IF EXISTS "Public can view inventory" ON public.inventory;
CREATE POLICY "Public can view inventory" ON public.inventory
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Managers can update inventory" ON public.inventory;
CREATE POLICY "Managers can update inventory" ON public.inventory
    FOR UPDATE TO authenticated
    USING (public.get_staff_role() IN ('manager', 'admin'));

DROP POLICY IF EXISTS "Deny direct client inventory insert" ON public.inventory;
CREATE POLICY "Deny direct client inventory insert" ON public.inventory
    FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client inventory delete" ON public.inventory;
CREATE POLICY "Deny direct client inventory delete" ON public.inventory
    FOR DELETE USING (false);

-- Table 6: ORDERS
DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
CREATE POLICY "Customers view own orders" ON public.orders
    FOR SELECT TO authenticated
    USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Staff view all orders" ON public.orders;
CREATE POLICY "Staff view all orders" ON public.orders
    FOR SELECT TO authenticated
    USING (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "Deny direct client order creation" ON public.orders;
CREATE POLICY "Deny direct client order creation" ON public.orders
    FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client order updates" ON public.orders;
CREATE POLICY "Deny direct client order updates" ON public.orders
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Deny direct client order deletion" ON public.orders;
CREATE POLICY "Deny direct client order deletion" ON public.orders
    FOR DELETE USING (false);

-- Table 7: ORDER ITEMS
DROP POLICY IF EXISTS "Customers view own order items" ON public.order_items;
CREATE POLICY "Customers view own order items" ON public.order_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.id = order_items.order_id 
          AND orders.customer_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Staff view all order items" ON public.order_items;
CREATE POLICY "Staff view all order items" ON public.order_items
    FOR SELECT TO authenticated
    USING (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "Deny direct client order items write" ON public.order_items;
CREATE POLICY "Deny direct client order items write" ON public.order_items
    FOR ALL WITH CHECK (false);

-- Table 8: PAYMENTS
DROP POLICY IF EXISTS "Customers view own payments" ON public.payments;
CREATE POLICY "Customers view own payments" ON public.payments
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.id = payments.order_id 
          AND orders.customer_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Staff view all payments" ON public.payments;
CREATE POLICY "Staff view all payments" ON public.payments
    FOR SELECT TO authenticated
    USING (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "Deny direct client payments write" ON public.payments;
CREATE POLICY "Deny direct client payments write" ON public.payments
    FOR ALL WITH CHECK (false);

-- Table 9: REFUNDS
DROP POLICY IF EXISTS "Customers view own refunds" ON public.refunds;
CREATE POLICY "Customers view own refunds" ON public.refunds
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.id = refunds.order_id 
          AND orders.customer_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Staff view all refunds" ON public.refunds;
CREATE POLICY "Staff view all refunds" ON public.refunds
    FOR SELECT TO authenticated
    USING (public.get_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "Deny direct client refunds write" ON public.refunds;
CREATE POLICY "Deny direct client refunds write" ON public.refunds
    FOR ALL WITH CHECK (false);

-- Table 10: AUDIT LOGS
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.get_staff_role() = 'admin');

DROP POLICY IF EXISTS "Deny client audit logs write" ON public.audit_logs;
CREATE POLICY "Deny client audit logs write" ON public.audit_logs
    FOR ALL WITH CHECK (false);

-- 4. Role Grants (Dual-Layer Privilege Defense)
-- Ensure anon and authenticated roles have only necessary table privileges
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Public read access to catalog and inventory
GRANT SELECT ON public.categories, public.products, public.inventory TO anon, authenticated;

-- Authenticated user permissions
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.staff_roles, public.orders, public.order_items, public.payments, public.refunds, public.audit_logs TO authenticated;

-- Service role retains full privileged access for authoritative backend operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Explicitly revoke write access to sensitive transaction tables from untrusted client roles
REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items, public.payments, public.refunds, public.audit_logs FROM anon, authenticated;
REVOKE INSERT, DELETE ON public.inventory FROM anon, authenticated;

