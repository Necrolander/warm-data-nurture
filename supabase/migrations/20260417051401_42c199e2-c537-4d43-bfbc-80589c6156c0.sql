
CREATE TABLE IF NOT EXISTS public.wa_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'whatsapp' UNIQUE,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  qr_generated_at timestamptz,
  phone_number text,
  display_name text,
  last_event text,
  last_seen_at timestamptz,
  messages_sent_total integer NOT NULL DEFAULT 0,
  messages_received_total integer NOT NULL DEFAULT 0,
  failures_total integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa sessions"
  ON public.wa_sessions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_sessions;

CREATE TABLE IF NOT EXISTS public.wa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL,
  from_phone text,
  to_phone text,
  message text NOT NULL,
  wa_message_id text,
  related_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  outbox_id uuid REFERENCES public.whatsapp_outbox(id) ON DELETE SET NULL,
  ack integer,
  error text,
  raw jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa messages"
  ON public.wa_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_wa_messages_created ON public.wa_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON public.wa_messages(from_phone);

INSERT INTO public.wa_sessions (channel, status)
VALUES ('whatsapp','disconnected')
ON CONFLICT (channel) DO NOTHING;
