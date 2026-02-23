
INSERT INTO public.site_settings (id, value) VALUES ('print_letterhead_url', '')
ON CONFLICT (id) DO NOTHING;
