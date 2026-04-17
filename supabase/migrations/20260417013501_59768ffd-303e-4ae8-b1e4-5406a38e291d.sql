-- ============================================================
-- ENUM de status normalizado para pedidos externos
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.external_order_status AS ENUM (
    'PENDING','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- external_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.external_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,                  -- 'ifood' | '99food' | etc
  external_order_id text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_status text,
  normalized_status public.external_order_status NOT NULL DEFAULT 'PENDING',
  order_hash text NOT NULL,
  internal_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  sent_to_menu_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_orders_unique UNIQUE (channel, external_order_id)
);

CREATE INDEX IF NOT EXISTS idx_external_orders_channel ON public.external_orders(channel);
CREATE INDEX IF NOT EXISTS idx_external_orders_status ON public.external_orders(normalized_status);
CREATE INDEX IF NOT EXISTS idx_external_orders_created ON public.external_orders(created_at DESC);

ALTER TABLE public.external_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage external orders" ON public.external_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_external_orders_updated
  BEFORE UPDATE ON public.external_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- external_order_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.external_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_order_id uuid NOT NULL REFERENCES public.external_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,    -- 'created'|'updated'|'status_changed'|'sent_to_menu'|'failed'|'reprocessed'
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ext_order_events_order ON public.external_order_events(external_order_id, created_at DESC);

ALTER TABLE public.external_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage external order events" ON public.external_order_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- bot_failures
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  error_message text NOT NULL,
  screenshot_url text,
  html_snapshot_url text,
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_failures_created ON public.bot_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_failures_channel ON public.bot_failures(channel);

ALTER TABLE public.bot_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bot failures" ON public.bot_failures
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- bot_heartbeats
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unknown',     -- 'online'|'offline'|'error'|'unknown'
  last_polled_at timestamptz,
  orders_captured_total integer NOT NULL DEFAULT 0,
  failures_total integer NOT NULL DEFAULT 0,
  meta jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bot heartbeats" ON public.bot_heartbeats
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_bot_heartbeats_updated
  BEFORE UPDATE ON public.bot_heartbeats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Storage bucket para screenshots/HTML snapshots dos bots
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('bot-snapshots','bot-snapshots', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read bot snapshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bot-snapshots' AND public.has_role(auth.uid(),'admin'));

-- ============================================================
-- Função: promove external_order -> orders (pedido real)
-- Chamada pela edge function depois de validar o bearer token.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_order_from_external(_external_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ext RECORD;
  np jsonb;
  new_order_id uuid;
  item jsonb;
  v_order_type order_type;
  v_payment payment_method;
BEGIN
  SELECT * INTO ext FROM public.external_orders WHERE id = _external_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'external_order % not found', _external_id; END IF;
  IF ext.internal_order_id IS NOT NULL THEN RETURN ext.internal_order_id; END IF;

  np := ext.normalized_payload;

  v_order_type := CASE upper(coalesce(np->'delivery'->>'type',''))
    WHEN 'DELIVERY' THEN 'delivery'::order_type
    WHEN 'PICKUP'   THEN 'pickup'::order_type
    WHEN 'TAKEOUT'  THEN 'pickup'::order_type
    ELSE 'delivery'::order_type
  END;

  v_payment := CASE upper(coalesce(np->'payment'->>'method',''))
    WHEN 'PIX'     THEN 'pix'::payment_method
    WHEN 'CARD'    THEN 'credit_card'::payment_method
    WHEN 'CREDIT'  THEN 'credit_card'::payment_method
    WHEN 'DEBIT'   THEN 'debit_card'::payment_method
    WHEN 'CASH'    THEN 'cash'::payment_method
    ELSE NULL
  END;

  INSERT INTO public.orders (
    customer_name, customer_phone, status, order_type, payment_method,
    subtotal, delivery_fee, total, observation, reference,
    order_source
  ) VALUES (
    coalesce(np->'customer'->>'name','Cliente '||ext.channel),
    coalesce(np->'customer'->>'phone',''),
    'pending'::order_status,
    v_order_type,
    v_payment,
    coalesce((np->'totals'->>'subtotal')::numeric, 0),
    coalesce((np->'fees'->>'deliveryFee')::numeric, 0),
    coalesce((np->'totals'->>'total')::numeric, 0),
    np->>'notes',
    np->'delivery'->>'reference',
    ext.channel
  ) RETURNING id INTO new_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(coalesce(np->'items','[]'::jsonb)) LOOP
    INSERT INTO public.order_items (order_id, product_name, product_price, quantity, observation, extras)
    VALUES (
      new_order_id,
      coalesce(item->>'name','Item'),
      coalesce((item->>'unitPrice')::numeric, 0),
      coalesce((item->>'quantity')::integer, 1),
      item->>'notes',
      coalesce(item->'options','[]'::jsonb)
    );
  END LOOP;

  UPDATE public.external_orders
     SET internal_order_id = new_order_id, sent_to_menu_at = now()
   WHERE id = _external_id;

  INSERT INTO public.external_order_events (external_order_id, event_type, payload)
  VALUES (_external_id, 'sent_to_menu', jsonb_build_object('order_id', new_order_id));

  RETURN new_order_id;
END $$;