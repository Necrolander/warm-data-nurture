ALTER TABLE public.wa_messages
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS ai_analysis text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('wa-media', 'wa-media', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Public read wa-media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'wa-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service write wa-media"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'wa-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service update wa-media"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'wa-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.whatsapp_outbox
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_mime text;