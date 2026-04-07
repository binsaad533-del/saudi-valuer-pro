
-- 1. Add payment_mode to valuation_requests (test = default for trial launch)
ALTER TABLE public.valuation_requests
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'test';

-- 2. Add is_test flag to invoices for clear differentiation
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT true;

-- 3. Add payment_mode to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'test';

-- 4. DB function: auto-unlock assignment after first payment confirmed
CREATE OR REPLACE FUNCTION public.auto_unlock_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _assignment_id uuid;
  _request_id uuid;
BEGIN
  -- Only act on status change to 'paid'
  IF NEW.payment_status != 'paid' OR OLD.payment_status = 'paid' THEN
    RETURN NEW;
  END IF;

  _assignment_id := NEW.assignment_id;
  _request_id := NEW.request_id;

  -- FIRST PAYMENT: unlock task and advance workflow
  IF NEW.payment_stage = 'first' THEN
    -- Update request payment_status
    UPDATE public.valuation_requests
    SET payment_status = 'first_payment_received',
        amount_paid = COALESCE(amount_paid, 0) + NEW.amount,
        production_started_at = COALESCE(production_started_at, now()),
        updated_at = now()
    WHERE id = _request_id;

    -- Unlock the assignment if linked
    IF _assignment_id IS NOT NULL THEN
      UPDATE public.valuation_assignments
      SET is_locked = false, updated_at = now()
      WHERE id = _assignment_id AND is_locked = true;
    END IF;

    -- Log in audit
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, assignment_id, description, new_data)
    VALUES (
      COALESCE(NEW.created_by, NEW.reviewed_by, '00000000-0000-0000-0000-000000000000'),
      'status_change',
      'payments',
      NEW.id::text,
      _assignment_id::text,
      'تأكيد الدفعة الأولى (' || NEW.payment_type || ') - فتح قفل المهمة تلقائياً',
      jsonb_build_object(
        'payment_mode', CASE WHEN NEW.is_mock THEN 'test' ELSE 'production' END,
        'amount', NEW.amount,
        'stage', NEW.payment_stage,
        'auto_unlock', true
      )
    );

  -- FINAL PAYMENT: mark fully paid
  ELSIF NEW.payment_stage = 'final' THEN
    UPDATE public.valuation_requests
    SET payment_status = 'fully_paid',
        amount_paid = COALESCE(amount_paid, 0) + NEW.amount,
        updated_at = now()
    WHERE id = _request_id;

    -- Log in audit
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, assignment_id, description, new_data)
    VALUES (
      COALESCE(NEW.created_by, NEW.reviewed_by, '00000000-0000-0000-0000-000000000000'),
      'status_change',
      'payments',
      NEW.id::text,
      _assignment_id::text,
      'تأكيد الدفعة النهائية (' || NEW.payment_type || ') - المهمة مدفوعة بالكامل',
      jsonb_build_object(
        'payment_mode', CASE WHEN NEW.is_mock THEN 'test' ELSE 'production' END,
        'amount', NEW.amount,
        'stage', NEW.payment_stage,
        'fully_paid', true
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Trigger on payments table
DROP TRIGGER IF EXISTS trg_auto_unlock_after_payment ON public.payments;
CREATE TRIGGER trg_auto_unlock_after_payment
  AFTER UPDATE OF payment_status
  ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_unlock_after_payment();

-- 6. Also trigger on INSERT with status=paid (for test payments that are instantly confirmed)
DROP TRIGGER IF EXISTS trg_auto_unlock_after_payment_insert ON public.payments;
CREATE TRIGGER trg_auto_unlock_after_payment_insert
  AFTER INSERT
  ON public.payments
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid')
  EXECUTE FUNCTION public.auto_unlock_after_payment();
