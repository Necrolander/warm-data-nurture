CREATE TABLE public.payment_failures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  method TEXT NOT NULL DEFAULT 'card',
  amount NUMERIC,
  mp_payment_id TEXT,
  status TEXT,
  status_detail TEXT,
  error_code TEXT,
  error_message TEXT,
  payment_method_id TEXT,
  installments INTEGER,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_failures_created_at ON public.payment_failures(created_at DESC);
CREATE INDEX idx_payment_failures_status_detail ON public.payment_failures(status_detail);
CREATE INDEX idx_payment_failures_order_id ON public.payment_failures(order_id);

ALTER TABLE public.payment_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payment failures"
  ON public.payment_failures
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert payment failures"
  ON public.payment_failures
  FOR INSERT
  TO authenticated
  WITH CHECK (true);