ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS mercadopago_payment_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_mp_payment_id ON public.orders(mercadopago_payment_id);