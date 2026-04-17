
CREATE TABLE IF NOT EXISTS public.ifood_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_external_id text NOT NULL,
  internal_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text,
  direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message text NOT NULL,
  intent text CHECK (intent IN ('status', 'composition', 'complaint', 'cancellation', 'other')),
  auto_replied boolean NOT NULL DEFAULT false,
  escalated boolean NOT NULL DEFAULT false,
  response_pending text,
  response_sent_at timestamptz,
  ai_confidence numeric,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ifood_chat_order ON public.ifood_chat_messages(order_external_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ifood_chat_pending ON public.ifood_chat_messages(response_pending) WHERE response_pending IS NOT NULL AND response_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ifood_chat_escalated ON public.ifood_chat_messages(escalated, created_at DESC) WHERE escalated = true;

ALTER TABLE public.ifood_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ifood chat messages"
  ON public.ifood_chat_messages
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.ifood_chat_messages;

INSERT INTO public.store_settings (key, value)
VALUES 
  ('ifood_chat_auto_reply_enabled', 'true'),
  ('ifood_chat_escalate_complaints', 'true'),
  ('ifood_chat_ai_model', 'google/gemini-2.5-flash')
ON CONFLICT (key) DO NOTHING;
