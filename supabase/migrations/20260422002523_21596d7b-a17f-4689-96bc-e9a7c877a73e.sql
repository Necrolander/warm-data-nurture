INSERT INTO public.store_settings (key, value)
VALUES ('min_order', '1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;