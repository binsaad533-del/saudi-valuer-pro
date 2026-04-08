
-- Auto-advance assignment status when inspection is submitted
CREATE OR REPLACE FUNCTION public.auto_advance_on_inspection_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only when inspection status changes to 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    -- Get assignment_id
    IF NEW.assignment_id IS NOT NULL THEN
      -- Check if assignment is in inspection_pending status
      PERFORM 1 FROM public.valuation_assignments
      WHERE id = NEW.assignment_id AND status = 'inspection_pending';

      IF FOUND THEN
        -- Use the centralized RPC to advance status
        PERFORM public.update_request_status(
          NEW.assignment_id,
          'inspection_completed',
          NULL,
          'auto',
          'المعاين أكمل المعاينة الميدانية — تقدم تلقائي',
          NULL
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_advance_inspection ON public.inspections;
CREATE TRIGGER trg_auto_advance_inspection
  AFTER UPDATE ON public.inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_advance_on_inspection_submit();
