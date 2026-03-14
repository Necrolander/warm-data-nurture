
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_code text;
ALTER TABLE public.delivery_persons ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.delivery_persons ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE public.delivery_persons ADD COLUMN IF NOT EXISTS current_lat double precision;
ALTER TABLE public.delivery_persons ADD COLUMN IF NOT EXISTS current_lng double precision;
ALTER TABLE public.delivery_persons ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.delivery_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  delivery_person_id uuid NOT NULL REFERENCES public.delivery_persons(id),
  issue_type text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.delivery_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert delivery issues" ON public.delivery_issues FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can view delivery issues" ON public.delivery_issues FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage delivery issues" ON public.delivery_issues FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view delivery persons public" ON public.delivery_persons FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can update delivery persons public" ON public.delivery_persons FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public can view orders" ON public.orders FOR SELECT TO public USING (true);
CREATE POLICY "Public can update orders" ON public.orders FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public can view order items" ON public.order_items FOR SELECT TO public USING (true);
CREATE POLICY "Public can insert delivery tracking" ON public.delivery_tracking FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can update delivery tracking" ON public.delivery_tracking FOR UPDATE TO public USING (true) WITH CHECK (true);
