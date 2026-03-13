-- Add image_url to product_extras
ALTER TABLE public.product_extras
  ADD COLUMN IF NOT EXISTS image_url text;

-- Add applies_to_categories to extra_groups (which category slugs this group applies to)
ALTER TABLE public.extra_groups
  ADD COLUMN IF NOT EXISTS applies_to_categories text[] DEFAULT '{}';