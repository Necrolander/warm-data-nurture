
-- Fila de mensagens WhatsApp pendentes (consumida pela VPS)
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | sending | sent | failed
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  kind text DEFAULT 'status_notification',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_pending ON public.whatsapp_outbox(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_order ON public.whatsapp_outbox(order_id);

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whatsapp outbox" ON public.whatsapp_outbox
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_whatsapp_outbox_updated_at
  BEFORE UPDATE ON public.whatsapp_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: quando pedido vai para out_for_delivery, gera tracking e enfileira mensagem
CREATE OR REPLACE FUNCTION public.handle_order_out_for_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_msg text;
  v_driver_name text;
  v_driver_phone text;
  v_eta_min int;
  v_base_url text := 'https://warm-data-nurture.lovable.app';
BEGIN
  -- Só age na transição para out_for_delivery
  IF NEW.status = 'out_for_delivery' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Garante delivery_tracking ativo
    INSERT INTO public.delivery_tracking (order_id, delivery_person_id, is_active)
    SELECT NEW.id, NEW.delivery_person_id, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.delivery_tracking WHERE order_id = NEW.id AND is_active = true
    );

    SELECT tracking_token INTO v_token
    FROM public.delivery_tracking
    WHERE order_id = NEW.id AND is_active = true
    ORDER BY created_at DESC LIMIT 1;

    -- Dados do entregador
    SELECT name, phone INTO v_driver_name, v_driver_phone
    FROM public.delivery_persons
    WHERE id = NEW.delivery_person_id;

    v_eta_min := COALESCE(NEW.estimated_delivery_minutes, 15);

    v_msg := '🛵 *Pedido #' || NEW.order_number || ' saiu para entrega!*' || E'\n\n' ||
             'Olá ' || COALESCE(NEW.customer_name, '') || ', seu pedido está a caminho! 🏍️💨' || E'\n\n';

    IF v_driver_name IS NOT NULL THEN
      v_msg := v_msg || '👤 *Entregador:* ' || v_driver_name || E'\n';
      IF v_driver_phone IS NOT NULL THEN
        v_msg := v_msg || '📞 *Telefone:* ' || v_driver_phone || E'\n';
      END IF;
      v_msg := v_msg || E'\n';
    END IF;

    v_msg := v_msg || '⏱️ *Chega em aproximadamente ' || v_eta_min || ' minutos*' || E'\n\n';

    IF v_token IS NOT NULL THEN
      v_msg := v_msg || '📍 *Acompanhe em tempo real:*' || E'\n' ||
               v_base_url || '/tracking/' || v_token || E'\n\n';
    END IF;

    IF NEW.delivery_code IS NOT NULL THEN
      v_msg := v_msg || '🔐 *Código de entrega:* `' || NEW.delivery_code || '`' || E'\n' ||
               '⚠️ Informe este código APENAS ao entregador no momento da entrega.' || E'\n\n';
    END IF;

    v_msg := v_msg || 'Qualquer dúvida, é só responder esta mensagem! 💬';

    INSERT INTO public.whatsapp_outbox (phone, message, order_id, kind)
    VALUES (NEW.customer_phone, v_msg, NEW.id, 'out_for_delivery');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_out_for_delivery ON public.orders;
CREATE TRIGGER trg_order_out_for_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_out_for_delivery();

-- Realtime para que admin veja envios em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_outbox;
