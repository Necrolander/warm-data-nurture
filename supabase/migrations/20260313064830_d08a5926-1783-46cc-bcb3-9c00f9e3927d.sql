-- Allow waiters to insert orders
CREATE POLICY "Waiters can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'waiter')
);

-- Allow waiters to insert order items
CREATE POLICY "Waiters can create order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'waiter')
);

-- Allow waiters to read orders (for dashboard)
CREATE POLICY "Waiters can view orders" ON public.orders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'waiter')
);

-- Allow waiters to read order items
CREATE POLICY "Waiters can view order items" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'waiter')
);