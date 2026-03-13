CREATE TABLE public.print_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'order',
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  content text NOT NULL,
  printed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.print_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert print jobs" ON public.print_queue
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins and staff can read print queue" ON public.print_queue
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Admins can update print queue" ON public.print_queue
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')
  ) WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')
  );

-- Waiters can also insert
CREATE POLICY "Waiters can insert print jobs" ON public.print_queue
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'waiter')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.print_queue;