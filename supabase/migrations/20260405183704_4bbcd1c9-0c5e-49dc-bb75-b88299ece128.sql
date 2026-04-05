ALTER TABLE public.raqeem_rules
  ADD COLUMN IF NOT EXISTS applicable_asset_type text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS condition_text text,
  ADD COLUMN IF NOT EXISTS requirement_text text,
  ADD COLUMN IF NOT EXISTS impact_type text NOT NULL DEFAULT 'warning';

COMMENT ON COLUMN public.raqeem_rules.applicable_asset_type IS 'real_estate, machinery, or both';
COMMENT ON COLUMN public.raqeem_rules.condition_text IS 'When this rule applies (Arabic)';
COMMENT ON COLUMN public.raqeem_rules.requirement_text IS 'What must be satisfied (Arabic)';
COMMENT ON COLUMN public.raqeem_rules.impact_type IS 'warning, risk, confidence_reduction, or blocking';