ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_charge numeric NOT NULL DEFAULT 0;

-- Allow waiters to update orders (edit, service charge, close bill)
CREATE POLICY "Waiters can update orders" ON public.orders FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'waiter')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'waiter')
);

-- Allow waiters to delete order items (for editing)
CREATE POLICY "Waiters can delete order items" ON public.order_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'waiter')
);

-- Allow waiters to update order items
CREATE POLICY "Waiters can update order items" ON public.order_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'waiter')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'waiter')
);