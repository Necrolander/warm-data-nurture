
-- Add estimated times and delay tracking to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_prep_minutes integer DEFAULT 30;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_delivery_minutes integer DEFAULT 15;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delay_notified boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS arrived_at_destination boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checklist_confirmed boolean DEFAULT false;
