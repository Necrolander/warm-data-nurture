
-- Delivery regions table
CREATE TABLE public.delivery_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0
);
ALTER TABLE public.delivery_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active regions" ON public.delivery_regions FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage regions" ON public.delivery_regions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Store schedule table
CREATE TABLE public.store_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time TEXT NOT NULL DEFAULT '18:00',
    close_time TEXT NOT NULL DEFAULT '23:00',
    is_open BOOLEAN DEFAULT true,
    UNIQUE(day_of_week)
);
ALTER TABLE public.store_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view schedule" ON public.store_schedule FOR SELECT USING (true);
CREATE POLICY "Admins can manage schedule" ON public.store_schedule FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
