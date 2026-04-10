
CREATE TABLE public.report_quality_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'pending',
  grade_label_ar TEXT,
  standard_breakdown JSONB DEFAULT '[]'::jsonb,
  total_checks INTEGER DEFAULT 0,
  passed_checks INTEGER DEFAULT 0,
  failed_mandatory INTEGER DEFAULT 0,
  failed_quality INTEGER DEFAULT 0,
  failed_enhancement INTEGER DEFAULT 0,
  can_issue BOOLEAN DEFAULT false,
  details JSONB DEFAULT '{}'::jsonb,
  scored_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_quality_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quality scores"
  ON public.report_quality_scores FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert quality scores"
  ON public.report_quality_scores FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = scored_by);

CREATE INDEX idx_rqs_assignment ON public.report_quality_scores(assignment_id);
CREATE INDEX idx_rqs_score ON public.report_quality_scores(score);
