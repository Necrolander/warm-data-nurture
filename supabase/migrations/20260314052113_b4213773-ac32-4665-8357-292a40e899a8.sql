
-- Kitchen urgency alerts table
CREATE TABLE public.kitchen_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  waiter_name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT 'URGÊNCIA!',
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.kitchen_alerts ENABLE ROW LEVEL SECURITY;

-- Waiters can insert alerts
CREATE POLICY "Waiters can insert alerts" ON public.kitchen_alerts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('waiter', 'admin', 'staff')
  ));

-- Admins/staff can read and update alerts
CREATE POLICY "Admins can manage alerts" ON public.kitchen_alerts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Waiters can view their own alerts
CREATE POLICY "Waiters can view alerts" ON public.kitchen_alerts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'waiter'
  ));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_alerts;
