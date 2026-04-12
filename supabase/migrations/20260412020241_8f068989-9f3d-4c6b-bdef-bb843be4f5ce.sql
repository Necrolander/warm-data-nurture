
-- ============================================
-- 1. ORDERS: Remove public SELECT and UPDATE
-- ============================================
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Public can update orders" ON public.orders;

-- Allow public to insert orders (checkout flow) - keep existing
-- Allow public to view their own order by order number (for tracking)
CREATE POLICY "Public can insert orders"
ON public.orders FOR INSERT TO public
WITH CHECK (true);

-- ============================================
-- 2. ORDER_ITEMS: Remove public SELECT
-- ============================================
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;

-- Allow public to insert order items (checkout flow)
CREATE POLICY "Public can insert order items"
ON public.order_items FOR INSERT TO public
WITH CHECK (true);

-- ============================================
-- 3. DELIVERY_PERSONS: Remove public SELECT/UPDATE
-- ============================================
DROP POLICY IF EXISTS "Anyone can view delivery persons public" ON public.delivery_persons;
DROP POLICY IF EXISTS "Anyone can update delivery persons public" ON public.delivery_persons;

-- ============================================
-- 4. DELIVERY_TRACKING: Remove public INSERT/UPDATE
-- ============================================
DROP POLICY IF EXISTS "Public can insert delivery tracking" ON public.delivery_tracking;
DROP POLICY IF EXISTS "Public can update delivery tracking" ON public.delivery_tracking;

-- ============================================
-- 5. DRIVER_LOCATIONS: Remove public INSERT/SELECT
-- ============================================
DROP POLICY IF EXISTS "Public can insert driver locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Public can view driver locations" ON public.driver_locations;

-- ============================================
-- 6. DRIVER_MESSAGES: Remove public INSERT/UPDATE/SELECT
-- ============================================
DROP POLICY IF EXISTS "Anyone can insert driver messages" ON public.driver_messages;
DROP POLICY IF EXISTS "Anyone can update driver messages" ON public.driver_messages;
DROP POLICY IF EXISTS "Anyone can view driver messages" ON public.driver_messages;

-- ============================================
-- 7. ROUTES: Remove public UPDATE
-- ============================================
DROP POLICY IF EXISTS "Public can update routes" ON public.routes;

-- ============================================
-- 8. DELIVERY_ISSUES: Remove public INSERT/SELECT
-- ============================================
DROP POLICY IF EXISTS "Anyone can insert delivery issues" ON public.delivery_issues;
DROP POLICY IF EXISTS "Anyone can view delivery issues" ON public.delivery_issues;

-- ============================================
-- 9. DELIVERY_HISTORY: Remove public INSERT
-- ============================================
DROP POLICY IF EXISTS "Public can insert delivery history" ON public.delivery_history;

-- ============================================
-- Now add proper scoped policies
-- ============================================

-- Staff (waiters) need to view delivery persons for assignment UI
CREATE POLICY "Waiters can view delivery persons"
ON public.delivery_persons FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'waiter'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
);

-- Delivery tracking: admin already has ALL; allow authenticated staff to manage
CREATE POLICY "Staff can manage delivery tracking"
ON public.delivery_tracking FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role)
);

-- Driver locations: only admin (already has ALL policy)

-- Driver messages: staff can view
CREATE POLICY "Staff can manage driver messages"
ON public.driver_messages FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role)
);

-- Routes: staff can view
CREATE POLICY "Staff can view routes"
ON public.routes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role)
);

-- Delivery issues: staff can view/insert
CREATE POLICY "Staff can manage delivery issues"
ON public.delivery_issues FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role)
);

-- Delivery history: staff can insert
CREATE POLICY "Staff can manage delivery history"
ON public.delivery_history FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role)
);

-- Enable HIBP check would be done via configure_auth tool
