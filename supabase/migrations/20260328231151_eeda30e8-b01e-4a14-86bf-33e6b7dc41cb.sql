
-- Create valuation_type enum
CREATE TYPE public.valuation_type AS ENUM ('real_estate', 'machinery', 'mixed');

-- Add valuation_type to valuation_assignments
ALTER TABLE public.valuation_assignments ADD COLUMN IF NOT EXISTS valuation_type public.valuation_type NOT NULL DEFAULT 'real_estate';

-- Add valuation_type to valuation_requests
ALTER TABLE public.valuation_requests ADD COLUMN IF NOT EXISTS valuation_type public.valuation_type DEFAULT 'real_estate';

-- Create subjects_machinery table
CREATE TABLE IF NOT EXISTS public.subjects_machinery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  asset_name_ar text NOT NULL,
  asset_name_en text,
  asset_category text NOT NULL DEFAULT 'general',
  manufacturer text,
  model text,
  serial_number text,
  year_manufactured integer,
  year_installed integer,
  condition text DEFAULT 'good',
  condition_score numeric,
  remaining_useful_life integer,
  total_useful_life integer DEFAULT 15,
  original_cost numeric,
  replacement_cost numeric,
  capacity text,
  specifications jsonb DEFAULT '{}',
  location_ar text,
  location_en text,
  description_ar text,
  description_en text,
  photo_urls text[] DEFAULT '{}',
  is_operational boolean DEFAULT true,
  depreciation_method text DEFAULT 'straight_line',
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects_machinery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access machinery subjects via assignment"
  ON public.subjects_machinery
  FOR ALL
  TO authenticated
  USING (
    assignment_id IN (
      SELECT id FROM public.valuation_assignments
      WHERE organization_id = get_user_org_id(auth.uid())
    )
  );

-- Lock trigger for machinery subjects
DROP TRIGGER IF EXISTS trg_lock_subjects_machinery ON public.subjects_machinery;
CREATE TRIGGER trg_lock_subjects_machinery
  BEFORE UPDATE OR DELETE ON public.subjects_machinery
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_assignment_data_edit();

-- Create machinery valuation methods table for separate calc results
CREATE TABLE IF NOT EXISTS public.machinery_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  subject_machinery_id uuid NOT NULL,
  approach text NOT NULL DEFAULT 'cost',
  replacement_cost_new numeric,
  physical_depreciation_pct numeric DEFAULT 0,
  functional_obsolescence_pct numeric DEFAULT 0,
  economic_obsolescence_pct numeric DEFAULT 0,
  concluded_value numeric DEFAULT 0,
  market_comparable_value numeric,
  income_value numeric,
  weight_cost numeric DEFAULT 0.7,
  weight_market numeric DEFAULT 0.2,
  weight_income numeric DEFAULT 0.1,
  final_value numeric DEFAULT 0,
  audit_trail jsonb DEFAULT '[]',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.machinery_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access machinery valuations via assignment"
  ON public.machinery_valuations
  FOR ALL
  TO authenticated
  USING (
    assignment_id IN (
      SELECT id FROM public.valuation_assignments
      WHERE organization_id = get_user_org_id(auth.uid())
    )
  );
