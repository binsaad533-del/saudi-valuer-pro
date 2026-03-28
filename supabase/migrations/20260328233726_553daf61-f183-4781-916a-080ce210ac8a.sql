
-- Add report lifecycle fields
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- Add assignment_type and retrospective fields to valuation_assignments
DO $$ BEGIN
  CREATE TYPE public.assignment_type AS ENUM ('new', 'revaluation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.valuation_assignments
  ADD COLUMN IF NOT EXISTS assignment_type text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS previous_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS valuation_date date,
  ADD COLUMN IF NOT EXISTS is_retrospective boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retrospective_note_ar text,
  ADD COLUMN IF NOT EXISTS retrospective_note_en text;

-- Add version_type to report_versions for tracking change reason
ALTER TABLE public.report_versions
  ADD COLUMN IF NOT EXISTS version_type text DEFAULT 'revision',
  ADD COLUMN IF NOT EXISTS reason_ar text,
  ADD COLUMN IF NOT EXISTS reason_en text;
