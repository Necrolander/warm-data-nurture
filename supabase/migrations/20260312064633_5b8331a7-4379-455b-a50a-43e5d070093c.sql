
-- Drop restrictive INSERT policies and recreate as permissive
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can create order items"
  ON public.order_items FOR INSERT
  TO public
  WITH CHECK (true);
