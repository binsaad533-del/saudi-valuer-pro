
-- Intelligence source links: connects approved sources to valuation methods
CREATE TABLE public.intelligence_source_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  source_name_ar TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('government', 'market', 'auction', 'cost_database', 'professional_standard')),
  valuation_method TEXT NOT NULL CHECK (valuation_method IN ('comparison', 'income', 'cost', 'all')),
  asset_type TEXT NOT NULL DEFAULT 'all' CHECK (asset_type IN ('real_estate', 'machinery', 'all')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_linked BOOLEAN NOT NULL DEFAULT false,
  linked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intelligence_source_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read source links"
  ON public.intelligence_source_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage source links"
  ON public.intelligence_source_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Seed default links for known sources
INSERT INTO public.intelligence_source_links (source_id, source_name_ar, source_type, valuation_method, asset_type, auto_linked) VALUES
  ('moj', 'وزارة العدل', 'government', 'comparison', 'real_estate', true),
  ('rega', 'الهيئة العامة للعقار', 'government', 'comparison', 'real_estate', true),
  ('real-estate-exchange', 'البورصة العقارية', 'government', 'comparison', 'real_estate', true),
  ('aqar', 'عقار', 'market', 'comparison', 'real_estate', true),
  ('bayut', 'بيوت', 'market', 'comparison', 'real_estate', true),
  ('sakan', 'سكني', 'market', 'comparison', 'real_estate', true),
  ('sama', 'البنك المركزي السعودي', 'government', 'income', 'real_estate', true),
  ('gastat', 'الهيئة العامة للإحصاء', 'government', 'all', 'all', true),
  ('marshall-swift', 'مارشال آند سويفت', 'cost_database', 'cost', 'all', true),
  ('ritchie-brothers', 'ريتشي براذرز', 'auction', 'comparison', 'machinery', true),
  ('bidspotter', 'بيدسبوتر', 'auction', 'comparison', 'machinery', true),
  ('rock-and-dirt', 'روك آند دِرت', 'market', 'comparison', 'machinery', true),
  ('aircraft-bluebook', 'دليل الطائرات الأزرق', 'market', 'comparison', 'machinery', true);
