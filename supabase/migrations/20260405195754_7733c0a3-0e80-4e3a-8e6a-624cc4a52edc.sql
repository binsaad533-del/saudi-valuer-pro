
-- Expand pricing_rules with subcategories, tiers, and additional pricing fields
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS subcategory text DEFAULT NULL;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS tier_label_ar text DEFAULT NULL;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS tier_min_units integer DEFAULT 1;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS tier_max_units integer DEFAULT NULL;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS per_unit_fee numeric DEFAULT 0;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS surcharge_percentage numeric DEFAULT 0;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS auto_discount_percentage numeric DEFAULT 0;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Drop unique constraint on service_type to allow subcategories
ALTER TABLE public.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_service_type_key;

-- Add unique constraint on service_type + subcategory combo
ALTER TABLE public.pricing_rules ADD CONSTRAINT pricing_rules_type_sub_unique UNIQUE (service_type, subcategory) DEFERRABLE INITIALLY DEFERRED;

-- Price override tracking table
CREATE TABLE IF NOT EXISTS public.price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.valuation_assignments(id),
  original_amount numeric NOT NULL,
  override_amount numeric NOT NULL,
  reason_ar text,
  override_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage price overrides"
  ON public.price_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Authenticated can view own overrides"
  ON public.price_overrides FOR SELECT TO authenticated
  USING (true);

-- Clear existing default rules and insert comprehensive matrix
DELETE FROM public.pricing_rules;

INSERT INTO public.pricing_rules (service_type, subcategory, label_ar, label_en, tier_label_ar, base_fee, inspection_fee, income_analysis_fee, per_unit_fee, surcharge_percentage, auto_discount_percentage, sort_order, is_active)
VALUES
  -- Real Estate
  ('real_estate', 'residential',  'تقييم عقاري سكني',    'Residential RE',    NULL, 3500, 500, 1000, 0, 0, 0, 10, true),
  ('real_estate', 'commercial',   'تقييم عقاري تجاري',    'Commercial RE',     NULL, 5000, 750, 1500, 0, 0, 0, 20, true),
  ('real_estate', 'complex',      'تقييم أصول معقدة',     'Complex Assets',    NULL, 8000, 1000, 2000, 0, 0, 0, 30, true),
  ('real_estate', 'additional',   'أصل إضافي (عقاري)',   'Additional RE Asset', NULL, 1500, 250, 0, 0, 0, 0, 35, true),

  -- Machinery & Equipment tiers
  ('machinery', 'tier_1_5',       'آلات ومعدات (1-5)',     'Machinery 1-5',     '1 إلى 5 أصول', 4000, 750, 0, 0, 0, 0, 40, true),
  ('machinery', 'tier_6_20',      'آلات ومعدات (6-20)',    'Machinery 6-20',    '6 إلى 20 أصل', 3500, 500, 0, 500, 0, 0, 50, true),
  ('machinery', 'tier_20_plus',   'آلات ومعدات (20+)',     'Machinery 20+',     'أكثر من 20 أصل', 3000, 500, 0, 350, 0, 0, 60, true),

  -- Mixed
  ('mixed', 'standard',           'تقييم مختلط',           'Mixed Valuation',   NULL, 7000, 1000, 1500, 0, 0, 10, 70, true),

  -- Additional services
  ('revaluation', 'standard',     'إعادة تقييم',           'Revaluation',       NULL, 2000, 0, 0, 0, 0, 0, 80, true),
  ('report_copy', 'standard',     'نسخة تقرير / تحديث',   'Report Copy',       NULL, 500, 0, 0, 0, 0, 0, 90, true),
  ('urgent', 'standard',          'خدمة عاجلة',            'Urgent Service',    NULL, 0, 0, 0, 0, 50, 0, 100, true);

-- Set tier bounds for machinery
UPDATE public.pricing_rules SET tier_min_units = 1, tier_max_units = 5 WHERE service_type = 'machinery' AND subcategory = 'tier_1_5';
UPDATE public.pricing_rules SET tier_min_units = 6, tier_max_units = 20 WHERE service_type = 'machinery' AND subcategory = 'tier_6_20';
UPDATE public.pricing_rules SET tier_min_units = 21, tier_max_units = NULL WHERE service_type = 'machinery' AND subcategory = 'tier_20_plus';
