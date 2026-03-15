-- Table to store iFood OAuth tokens
CREATE TABLE public.ifood_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ifood_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ifood tokens" ON public.ifood_tokens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Table to track iFood reviews and auto-responses  
CREATE TABLE public.ifood_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id text UNIQUE NOT NULL,
  merchant_id text NOT NULL,
  order_id text,
  customer_name text,
  rating integer,
  comment text,
  response_sent boolean DEFAULT false,
  response_text text,
  responded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ifood_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ifood reviews" ON public.ifood_reviews
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Table to track polled event IDs to avoid duplicates
CREATE TABLE public.ifood_events_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text,
  order_id text,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ifood_events_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ifood events" ON public.ifood_events_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));