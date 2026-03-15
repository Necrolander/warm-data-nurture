
-- Driver status enum
CREATE TYPE public.driver_status AS ENUM ('available', 'on_route', 'paused', 'offline');

-- Route status enum
CREATE TYPE public.route_status AS ENUM ('created', 'awaiting_driver', 'assigned', 'in_delivery', 'completed', 'cancelled');

-- Driver locations history
CREATE TABLE public.driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.delivery_persons(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add new fields to delivery_persons
ALTER TABLE public.delivery_persons
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS current_route_id UUID,
  ADD COLUMN IF NOT EXISTS avg_speed_kmh DOUBLE PRECISION DEFAULT 25,
  ADD COLUMN IF NOT EXISTS avg_delay_rate DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_capacity_per_hour DOUBLE PRECISION DEFAULT 6,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Routes table
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL DEFAULT 'R-' || substr(gen_random_uuid()::text, 1, 6),
  origin_lat DOUBLE PRECISION NOT NULL DEFAULT -16.0145251,
  origin_lng DOUBLE PRECISION NOT NULL DEFAULT -48.0593436,
  total_distance_km DOUBLE PRECISION DEFAULT 0,
  estimated_duration_min INTEGER DEFAULT 0,
  predicted_real_duration_min INTEGER DEFAULT 0,
  optimized_sequence JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'created',
  driver_id UUID REFERENCES public.delivery_persons(id),
  auto_assigned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Route orders (stops)
CREATE TABLE public.route_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL DEFAULT 1,
  stop_distance_km DOUBLE PRECISION DEFAULT 0,
  stop_duration_min INTEGER DEFAULT 0,
  predicted_eta TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Routing configuration
CREATE TABLE public.routing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  label TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Delivery history for AI learning
CREATE TABLE public.delivery_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id),
  route_id UUID REFERENCES public.routes(id),
  driver_id UUID REFERENCES public.delivery_persons(id),
  neighborhood TEXT,
  region TEXT,
  distance_km DOUBLE PRECISION,
  estimated_time_min INTEGER,
  actual_time_min INTEGER,
  delay_min INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Order demand history for forecasting
CREATE TABLE public.order_demand_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  hour INTEGER NOT NULL,
  order_count INTEGER DEFAULT 0,
  neighborhood TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add route_id to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.routes(id),
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS route_position INTEGER,
  ADD COLUMN IF NOT EXISTS predicted_eta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delay_risk BOOLEAN DEFAULT false;

-- Enable RLS on all new tables
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_demand_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage driver locations" ON public.driver_locations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can insert driver locations" ON public.driver_locations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can view driver locations" ON public.driver_locations FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage routes" ON public.routes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can view routes" ON public.routes FOR SELECT TO public USING (true);
CREATE POLICY "Public can update routes" ON public.routes FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage route orders" ON public.route_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can view route orders" ON public.route_orders FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage routing config" ON public.routing_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can view routing config" ON public.routing_config FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage delivery history" ON public.delivery_history FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can insert delivery history" ON public.delivery_history FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Admins can manage demand history" ON public.order_demand_history FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for routes and driver_locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.routes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_orders;

-- Insert default routing config
INSERT INTO public.routing_config (key, value, label) VALUES
  ('max_grouping_radius_km', '5', 'Raio máximo de agrupamento (km)'),
  ('max_orders_per_route', '3', 'Máximo de pedidos por rota'),
  ('max_time_diff_min', '15', 'Diferença máxima de tempo entre pedidos (min)'),
  ('max_wait_before_route_min', '10', 'Tempo máximo de espera antes de gerar rota (min)'),
  ('weight_distance', '1.0', 'Peso de distância'),
  ('weight_time', '1.5', 'Peso de tempo'),
  ('weight_delay', '2.0', 'Peso de atraso'),
  ('weight_priority', '1.8', 'Peso de prioridade'),
  ('assignment_mode', 'manual', 'Modo de atribuição (manual/auto)'),
  ('acceptable_delay_min', '15', 'Limite de atraso aceitável (min)')
ON CONFLICT (key) DO NOTHING;
