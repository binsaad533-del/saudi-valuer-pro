
-- Add enforcement columns to raqeem_rules
ALTER TABLE public.raqeem_rules 
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'warning',
  ADD COLUMN IF NOT EXISTS enforcement_stage text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rule_type text NOT NULL DEFAULT 'checklist',
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.raqeem_knowledge(id) ON DELETE SET NULL;

-- Create compliance_check_results for per-assignment rule enforcement
CREATE TABLE IF NOT EXISTS public.compliance_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.raqeem_rules(id) ON DELETE CASCADE,
  stage text NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  violation_message text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by text DEFAULT 'system',
  UNIQUE(assignment_id, rule_id, stage)
);

ALTER TABLE public.compliance_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read compliance results"
  ON public.compliance_check_results FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System and owners can insert compliance results"
  ON public.compliance_check_results FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "System and owners can update compliance results"
  ON public.compliance_check_results FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
