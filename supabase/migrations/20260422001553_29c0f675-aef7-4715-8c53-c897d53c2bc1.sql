ALTER TABLE public.payment_failures
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS card_first_six text,
  ADD COLUMN IF NOT EXISTS card_last_four text,
  ADD COLUMN IF NOT EXISTS card_holder_name text,
  ADD COLUMN IF NOT EXISTS previous_payment_id text;

CREATE INDEX IF NOT EXISTS idx_payment_failures_customer_phone
  ON public.payment_failures (customer_phone);
CREATE INDEX IF NOT EXISTS idx_payment_failures_user_id
  ON public.payment_failures (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_failures_card_last_four
  ON public.payment_failures (card_last_four);
CREATE INDEX IF NOT EXISTS idx_payment_failures_previous_payment_id
  ON public.payment_failures (previous_payment_id);