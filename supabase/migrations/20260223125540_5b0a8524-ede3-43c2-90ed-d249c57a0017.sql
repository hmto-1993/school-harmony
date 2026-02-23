INSERT INTO public.site_settings (id, value) VALUES 
  ('sms_provider_username', ''),
  ('sms_provider_api_key', ''),
  ('sms_provider_sender', '')
ON CONFLICT (id) DO NOTHING;