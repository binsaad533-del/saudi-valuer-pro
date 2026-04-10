
CREATE TABLE public.quality_gate_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  run_by UUID NOT NULL,
  overall_passed BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  total_checks INTEGER NOT NULL DEFAULT 0,
  passed_checks INTEGER NOT NULL DEFAULT 0,
  failed_mandatory INTEGER NOT NULL DEFAULT 0,
  failed_quality INTEGER NOT NULL DEFAULT 0,
  failed_enhancement INTEGER NOT NULL DEFAULT 0,
  can_issue BOOLEAN NOT NULL DEFAULT false,
  has_warnings BOOLEAN NOT NULL DEFAULT false,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked_reasons JSONB DEFAULT '[]'::jsonb,
  warning_reasons JSONB DEFAULT '[]'::jsonb,
  enhancement_suggestions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quality_gate_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quality gate results"
  ON public.quality_gate_results FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert quality gate results"
  ON public.quality_gate_results FOR INSERT TO authenticated
  WITH CHECK (run_by = auth.uid());

CREATE INDEX idx_quality_gate_assignment ON public.quality_gate_results(assignment_id);
CREATE INDEX idx_quality_gate_created ON public.quality_gate_results(created_at DESC);
