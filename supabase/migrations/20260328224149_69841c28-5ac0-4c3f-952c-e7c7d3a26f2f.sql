
-- Reference cities table for Saudi Arabia
CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  region_ar text,
  region_en text,
  latitude numeric,
  longitude numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read cities" ON public.cities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cities" ON public.cities FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- Districts table
CREATE TABLE public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  latitude numeric,
  longitude numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read districts" ON public.districts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage districts" ON public.districts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- Inspector coverage areas (links inspectors to cities/districts with optional GPS radius)
CREATE TABLE public.inspector_coverage_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector_profile_id uuid NOT NULL REFERENCES public.inspector_profiles(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL,
  coverage_radius_km numeric DEFAULT 50,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inspector_profile_id, city_id, district_id)
);

ALTER TABLE public.inspector_coverage_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coverage" ON public.inspector_coverage_areas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));
CREATE POLICY "Inspectors view own coverage" ON public.inspector_coverage_areas FOR SELECT TO authenticated
  USING (inspector_profile_id IN (SELECT id FROM public.inspector_profiles WHERE user_id = auth.uid()));

-- Add GPS and performance fields to inspector_profiles
ALTER TABLE public.inspector_profiles
  ADD COLUMN IF NOT EXISTS home_latitude numeric,
  ADD COLUMN IF NOT EXISTS home_longitude numeric,
  ADD COLUMN IF NOT EXISTS avg_response_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_completion_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_score numeric DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS total_completed integer DEFAULT 0;

-- Seed major Saudi cities
INSERT INTO public.cities (name_ar, name_en, region_ar, region_en, latitude, longitude) VALUES
  ('الرياض', 'Riyadh', 'منطقة الرياض', 'Riyadh Region', 24.7136, 46.6753),
  ('جدة', 'Jeddah', 'منطقة مكة المكرمة', 'Makkah Region', 21.4858, 39.1925),
  ('مكة المكرمة', 'Makkah', 'منطقة مكة المكرمة', 'Makkah Region', 21.3891, 39.8579),
  ('المدينة المنورة', 'Madinah', 'منطقة المدينة المنورة', 'Madinah Region', 24.4539, 39.6142),
  ('الدمام', 'Dammam', 'المنطقة الشرقية', 'Eastern Province', 26.3927, 49.9777),
  ('الخبر', 'Khobar', 'المنطقة الشرقية', 'Eastern Province', 26.2172, 50.1971),
  ('الظهران', 'Dhahran', 'المنطقة الشرقية', 'Eastern Province', 26.2361, 50.0393),
  ('بريدة', 'Buraidah', 'منطقة القصيم', 'Qassim Region', 26.3260, 43.9750),
  ('تبوك', 'Tabuk', 'منطقة تبوك', 'Tabuk Region', 28.3838, 36.5550),
  ('أبها', 'Abha', 'منطقة عسير', 'Asir Region', 18.2164, 42.5053),
  ('خميس مشيط', 'Khamis Mushait', 'منطقة عسير', 'Asir Region', 18.3063, 42.7353),
  ('الطائف', 'Taif', 'منطقة مكة المكرمة', 'Makkah Region', 21.2703, 40.4158),
  ('حائل', 'Hail', 'منطقة حائل', 'Hail Region', 27.5114, 41.7208),
  ('نجران', 'Najran', 'منطقة نجران', 'Najran Region', 17.4933, 44.1277),
  ('جازان', 'Jazan', 'منطقة جازان', 'Jazan Region', 16.8892, 42.5611),
  ('ينبع', 'Yanbu', 'منطقة المدينة المنورة', 'Madinah Region', 24.0895, 38.0618),
  ('الجبيل', 'Jubail', 'المنطقة الشرقية', 'Eastern Province', 27.0046, 49.6225),
  ('الأحساء', 'Al Ahsa', 'المنطقة الشرقية', 'Eastern Province', 25.3648, 49.5876);

-- Haversine distance function for GPS matching
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians((lon2 - lon1) / 2)), 2)
  ))
$$;
