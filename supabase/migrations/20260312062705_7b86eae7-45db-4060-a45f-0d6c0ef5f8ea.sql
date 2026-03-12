
-- Salon tables table
CREATE TABLE public.salon_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INTEGER NOT NULL UNIQUE,
    seats INTEGER DEFAULT 4,
    qr_code_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.salon_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active tables" ON public.salon_tables FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage tables" ON public.salon_tables FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Waiters table
CREATE TABLE public.waiters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.waiters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage waiters" ON public.waiters FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Customer contacts table (for tracking order history)
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    total_orders INTEGER DEFAULT 0,
    last_order_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Cashback/Coupons table
CREATE TABLE public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('cashback', 'coupon')),
    name TEXT NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    is_percentage BOOLEAN DEFAULT true,
    min_order DECIMAL(10,2) DEFAULT 0,
    code TEXT,
    is_active BOOLEAN DEFAULT false,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active promotions" ON public.promotions FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage promotions" ON public.promotions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Reports PIN table
CREATE TABLE public.report_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_hash TEXT NOT NULL,
    recovery_email TEXT NOT NULL
);
ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage report settings" ON public.report_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
