-- Tabela: pedidos de código 2FA do bot iFood
CREATE TABLE public.bot_2fa_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'ifood',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | provided | consumed | expired
  code TEXT,
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provided_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX idx_bot_2fa_requests_status ON public.bot_2fa_requests(channel, status, requested_at DESC);

ALTER TABLE public.bot_2fa_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view 2fa requests"
ON public.bot_2fa_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update 2fa requests"
ON public.bot_2fa_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Tabela: screenshots/snapshots do bot pra debug visual
CREATE TABLE public.bot_screenshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'ifood',
  screenshot_url TEXT NOT NULL,
  page_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_screenshots_channel_created ON public.bot_screenshots(channel, created_at DESC);

ALTER TABLE public.bot_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view screenshots"
ON public.bot_screenshots FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS para bot_heartbeats / bot_failures (se ainda não tiver leitura admin garantida)
ALTER TABLE public.bot_heartbeats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bot_heartbeats' AND policyname='Admins can view heartbeats') THEN
    CREATE POLICY "Admins can view heartbeats"
    ON public.bot_heartbeats FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

ALTER TABLE public.bot_failures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bot_failures' AND policyname='Admins can view failures') THEN
    CREATE POLICY "Admins can view failures"
    ON public.bot_failures FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_2fa_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_heartbeats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_screenshots;