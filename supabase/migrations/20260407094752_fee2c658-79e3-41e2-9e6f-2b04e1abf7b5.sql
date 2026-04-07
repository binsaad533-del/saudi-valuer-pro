
-- Add new enum values for the 18-status Master Status Matrix
-- Only adding values that don't already exist

DO $$
BEGIN
  -- Check and add each new enum value
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'submitted' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'submitted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'scope_generated' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'scope_generated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'scope_approved' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'scope_approved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'first_payment_confirmed' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'first_payment_confirmed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'data_collection_complete' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'data_collection_complete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'data_validated' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'data_validated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'inspection_pending' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'inspection_pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'inspection_completed' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'inspection_completed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'analysis_complete' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'analysis_complete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'professional_review' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'professional_review';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'client_review' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'client_review';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'draft_approved' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'draft_approved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'final_payment_confirmed' AND enumtypid = 'assignment_status'::regtype) THEN
    ALTER TYPE public.assignment_status ADD VALUE 'final_payment_confirmed';
  END IF;
END$$;

-- Sync trigger: mirror assignment status to valuation_requests
CREATE OR REPLACE FUNCTION public.sync_assignment_status_to_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.valuation_requests
    SET updated_at = now()
    WHERE assignment_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_assignment_status ON public.valuation_assignments;
CREATE TRIGGER trg_sync_assignment_status
  AFTER UPDATE OF status
  ON public.valuation_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_assignment_status_to_request();
