
-- Add signature_hash to report_signatures
ALTER TABLE public.report_signatures ADD COLUMN IF NOT EXISTS signature_hash text;

-- Add locked fields to reports table
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS locked_by uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS superseded_by uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS previous_version_id uuid;

-- Add signature_hash to reports for quick verification
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS signature_hash text;

-- Create trigger to prevent editing locked reports
CREATE OR REPLACE FUNCTION public.prevent_locked_report_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.is_locked = true AND OLD.is_final = true THEN
    -- Allow only superseded_by to be set
    IF NEW.superseded_by IS DISTINCT FROM OLD.superseded_by THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a locked final report. Create a new version instead.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_report_edit ON public.reports;
CREATE TRIGGER trg_prevent_locked_report_edit
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_report_edit();

-- Create trigger to prevent editing locked assignment data
CREATE OR REPLACE FUNCTION public.prevent_locked_assignment_data_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  is_assignment_locked boolean;
BEGIN
  SELECT va.is_locked INTO is_assignment_locked
  FROM public.valuation_assignments va
  WHERE va.id = COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  IF is_assignment_locked = true THEN
    RAISE EXCEPTION 'Cannot modify data for a locked assignment. The report has been issued.';
  END IF;
  RETURN NEW;
END;
$$;

-- Protect subjects from edits when assignment is locked
DROP TRIGGER IF EXISTS trg_lock_subjects ON public.subjects;
CREATE TRIGGER trg_lock_subjects
  BEFORE UPDATE OR DELETE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_assignment_data_edit();

-- Protect valuation_methods from edits when assignment is locked
DROP TRIGGER IF EXISTS trg_lock_valuation_methods ON public.valuation_methods;
CREATE TRIGGER trg_lock_valuation_methods
  BEFORE UPDATE OR DELETE ON public.valuation_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_assignment_data_edit();

-- Protect reconciliation_results from edits when assignment is locked
DROP TRIGGER IF EXISTS trg_lock_reconciliation ON public.reconciliation_results;
CREATE TRIGGER trg_lock_reconciliation
  BEFORE UPDATE OR DELETE ON public.reconciliation_results
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_assignment_data_edit();

-- Create report_verification_log for tracking public verifications
CREATE TABLE IF NOT EXISTS public.report_verification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  ip_address text,
  user_agent text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL DEFAULT 'valid'
);

ALTER TABLE public.report_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert verification log"
  ON public.report_verification_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view verification log"
  ON public.report_verification_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'firm_admin'::app_role));
