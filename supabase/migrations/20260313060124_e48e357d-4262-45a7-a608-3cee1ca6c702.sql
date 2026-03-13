
-- Add visibility channels: where the product should appear
-- Options: 'delivery', 'dine_in', 'pickup', 'qrcode', 'waiter_app'
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS visibility_channels text[] DEFAULT '{delivery,dine_in,pickup,qrcode,waiter_app}';

-- Add schedule columns: day and time restrictions
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS available_days integer[] DEFAULT '{0,1,2,3,4,5,6}';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS available_start_time text DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS available_end_time text DEFAULT NULL;

-- Add is_combo flag for combo products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_combo boolean DEFAULT false;

-- Add combo_items to store which products are in a combo (as JSON array of product IDs)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS combo_items jsonb DEFAULT NULL;
