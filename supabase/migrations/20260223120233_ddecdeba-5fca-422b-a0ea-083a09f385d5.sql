
CREATE TABLE public.site_settings (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site_settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update site_settings"
  ON public.site_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert site_settings"
  ON public.site_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.site_settings (id, value) VALUES
  ('school_name', 'ثانوية الفيصلية'),
  ('school_subtitle', 'نظام إدارة المدرسة');
