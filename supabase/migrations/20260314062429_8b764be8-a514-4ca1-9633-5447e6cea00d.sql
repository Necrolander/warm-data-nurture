
-- Chat sessions for WhatsApp bot conversations
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  customer_name text,
  state text NOT NULL DEFAULT 'greeting',
  cart jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_category text,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  payment_method text,
  order_id uuid REFERENCES public.orders(id),
  is_active boolean NOT NULL DEFAULT true,
  last_message_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Chat messages log
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL DEFAULT 'incoming',
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Delivery tracking for entregadores
CREATE TABLE public.delivery_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  delivery_person_id uuid REFERENCES public.delivery_persons(id),
  current_lat double precision,
  current_lng double precision,
  is_active boolean NOT NULL DEFAULT true,
  tracking_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create unique index on phone for active sessions
CREATE UNIQUE INDEX idx_chat_sessions_active_phone ON public.chat_sessions(phone) WHERE is_active = true;

-- Create index on tracking token
CREATE UNIQUE INDEX idx_delivery_tracking_token ON public.delivery_tracking(tracking_token);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

-- RLS: Admins manage all
CREATE POLICY "Admins can manage chat sessions" ON public.chat_sessions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage chat messages" ON public.chat_messages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage delivery tracking" ON public.delivery_tracking FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Public read for tracking (by token - handled in edge function)
CREATE POLICY "Anyone can view active tracking" ON public.delivery_tracking FOR SELECT TO public USING (is_active = true);

-- Enable realtime for chat messages and delivery tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tracking;
