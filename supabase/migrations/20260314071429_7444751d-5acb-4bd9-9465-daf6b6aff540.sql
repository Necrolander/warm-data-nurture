
-- In-app messages between driver and admin
CREATE TABLE public.driver_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  sender TEXT NOT NULL DEFAULT 'driver', -- 'driver' or 'admin'
  message TEXT NOT NULL,
  is_emergency BOOLEAN NOT NULL DEFAULT false,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  read_by_driver BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (driver has no auth user)
CREATE POLICY "Anyone can insert driver messages" ON public.driver_messages
  FOR INSERT TO public WITH CHECK (true);

-- Anyone can view driver messages
CREATE POLICY "Anyone can view driver messages" ON public.driver_messages
  FOR SELECT TO public USING (true);

-- Anyone can update driver messages (mark as read)
CREATE POLICY "Anyone can update driver messages" ON public.driver_messages
  FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Admins full access
CREATE POLICY "Admins can manage driver messages" ON public.driver_messages
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_messages;
