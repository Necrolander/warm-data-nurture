-- Create extra_groups table
CREATE TABLE public.extra_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  max_select integer NOT NULL DEFAULT 5,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true
);

ALTER TABLE public.extra_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage extra groups" ON public.extra_groups
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active extra groups" ON public.extra_groups
  FOR SELECT TO public USING (is_active = true);

-- Add group_id to product_extras
ALTER TABLE public.product_extras
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.extra_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS max_quantity integer DEFAULT 4;