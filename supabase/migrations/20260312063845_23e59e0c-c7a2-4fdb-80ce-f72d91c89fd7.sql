-- Allow anyone to insert orders (public checkout)
CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow anyone to insert order items (public checkout)
CREATE POLICY "Anyone can create order items"
  ON public.order_items FOR INSERT
  TO public
  WITH CHECK (true);