
-- Inspection analysis results table
CREATE TABLE public.inspection_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  
  -- AI extracted condition data
  condition_rating text DEFAULT 'good',
  condition_score numeric DEFAULT 5.0,
  finishing_level text DEFAULT 'standard',
  quality_score numeric DEFAULT 5.0,
  maintenance_level text DEFAULT 'average',
  environment_quality text DEFAULT 'good',
  
  -- Detailed findings
  visible_defects jsonb DEFAULT '[]'::jsonb,
  risk_flags jsonb DEFAULT '[]'::jsonb,
  adjustment_factors jsonb DEFAULT '{}'::jsonb,
  
  -- Photo analysis
  photo_analysis jsonb DEFAULT '[]'::jsonb,
  
  -- Combined structured output
  checklist_summary jsonb DEFAULT '{}'::jsonb,
  inspector_notes_summary text,
  
  -- AI reasoning
  ai_reasoning_ar text,
  ai_reasoning_en text,
  ai_model_used text,
  ai_confidence numeric DEFAULT 0.8,
  
  -- Depreciation inputs for valuation
  physical_depreciation_pct numeric DEFAULT 0,
  functional_obsolescence_pct numeric DEFAULT 0,
  external_obsolescence_pct numeric DEFAULT 0,
  condition_adjustment_pct numeric DEFAULT 0,
  
  -- Override
  is_overridden boolean DEFAULT false,
  override_by uuid,
  override_at timestamptz,
  override_notes text,
  original_ai_data jsonb,
  
  -- Status
  status text DEFAULT 'pending' NOT NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(inspection_id)
);

-- RLS
ALTER TABLE public.inspection_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access inspection analysis via assignment"
ON public.inspection_analysis FOR ALL TO authenticated
USING (
  assignment_id IN (
    SELECT id FROM public.valuation_assignments 
    WHERE organization_id = get_user_org_id(auth.uid())
  )
  OR
  inspection_id IN (
    SELECT id FROM public.inspections WHERE inspector_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_inspection_analysis_updated_at
  BEFORE UPDATE ON public.inspection_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
