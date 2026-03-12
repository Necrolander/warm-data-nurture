
-- Products table (editable menu)
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    category TEXT NOT NULL,
    badges TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone can read active products (for the menu)
CREATE POLICY "Anyone can view active products" ON public.products
FOR SELECT USING (is_active = true);

-- Admins can manage all products
CREATE POLICY "Admins can manage products" ON public.products
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Product extras table
CREATE TABLE public.product_extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0
);
ALTER TABLE public.product_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active extras" ON public.product_extras
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage extras" ON public.product_extras
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Categories table
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories" ON public.categories
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage categories" ON public.categories
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Delivery fees table
CREATE TABLE public.delivery_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    max_km DECIMAL(5,2) NOT NULL,
    fee DECIMAL(10,2) NOT NULL,
    sort_order INTEGER DEFAULT 0
);
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view delivery fees" ON public.delivery_fees
FOR SELECT USING (true);

CREATE POLICY "Admins can manage delivery fees" ON public.delivery_fees
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Store settings table (for general config)
CREATE TABLE public.store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings" ON public.store_settings
FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON public.store_settings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Bot responses table
CREATE TABLE public.bot_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_key TEXT NOT NULL UNIQUE,
    trigger_label TEXT NOT NULL,
    response_text TEXT NOT NULL DEFAULT '',
    include_menu_link BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.bot_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bot responses" ON public.bot_responses
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Triggers
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bot_responses_updated_at BEFORE UPDATE ON public.bot_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
