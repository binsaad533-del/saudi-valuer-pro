-- Create inspector_evaluations table for ratings and evaluations
CREATE TABLE IF NOT EXISTS public.inspector_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector_user_id uuid NOT NULL,
  evaluator_id uuid,
  evaluation_type text NOT NULL DEFAULT 'internal',
  rating numeric NOT NULL DEFAULT 0,
  speed_score numeric DEFAULT 0,
  quality_score numeric DEFAULT 0,
  completion_score numeric DEFAULT 0,
  satisfaction_score numeric DEFAULT 0,
  notes text,
  assignment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspector_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage evaluations" ON public.inspector_evaluations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Inspectors view own evaluations" ON public.inspector_evaluations
  FOR SELECT TO authenticated
  USING (inspector_user_id = auth.uid());

-- Add classification and scoring fields to inspector_profiles
ALTER TABLE public.inspector_profiles
  ADD COLUMN IF NOT EXISTS inspector_category text DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS overall_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_satisfaction numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corrections_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS management_notes text;
