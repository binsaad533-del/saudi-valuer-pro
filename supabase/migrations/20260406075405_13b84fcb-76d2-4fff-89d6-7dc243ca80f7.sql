
CREATE TABLE public.otp_supported_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE,
  country_name_ar text NOT NULL,
  country_name_en text,
  dial_code text NOT NULL,
  otp_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_supported_countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read countries" ON public.otp_supported_countries
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Owners can manage countries" ON public.otp_supported_countries
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.otp_supported_countries (country_code, country_name_ar, country_name_en, dial_code, otp_enabled) VALUES
  ('SA', 'المملكة العربية السعودية', 'Saudi Arabia', '+966', true),
  ('AE', 'الإمارات العربية المتحدة', 'United Arab Emirates', '+971', false),
  ('BH', 'البحرين', 'Bahrain', '+973', false),
  ('KW', 'الكويت', 'Kuwait', '+965', false),
  ('OM', 'عُمان', 'Oman', '+968', false),
  ('QA', 'قطر', 'Qatar', '+974', false),
  ('EG', 'مصر', 'Egypt', '+20', false),
  ('JO', 'الأردن', 'Jordan', '+962', false),
  ('LB', 'لبنان', 'Lebanon', '+961', false),
  ('IQ', 'العراق', 'Iraq', '+964', false),
  ('US', 'الولايات المتحدة', 'United States', '+1', false),
  ('GB', 'المملكة المتحدة', 'United Kingdom', '+44', false);
