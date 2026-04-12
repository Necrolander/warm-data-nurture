
-- 1. store_settings: restrict public SELECT to exclude sensitive keys
DROP POLICY IF EXISTS "Anyone can view settings" ON public.store_settings;
CREATE POLICY "Public can view non-sensitive settings"
ON public.store_settings FOR SELECT TO public
USING (key NOT IN ('reports_pin', 'admin_pin', 'secret_key'));

-- 2. delivery_tracking: restrict public SELECT to token-based access
DROP POLICY IF EXISTS "Anyone can view active tracking" ON public.delivery_tracking;
CREATE POLICY "Public can view tracking by token"
ON public.delivery_tracking FOR SELECT TO public
USING (false); -- Disable public access; use edge function or authenticated access

-- 3. delivery_persons: drop password_hash column
ALTER TABLE public.delivery_persons DROP COLUMN IF EXISTS password_hash;

-- 4. routes: remove public SELECT
DROP POLICY IF EXISTS "Public can view routes" ON public.routes;

-- 5. route_orders: remove public SELECT
DROP POLICY IF EXISTS "Public can view route orders" ON public.route_orders;

-- Add staff SELECT for route_orders
CREATE POLICY "Staff can view route orders"
ON public.route_orders FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role)
);
