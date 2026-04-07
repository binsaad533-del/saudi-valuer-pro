
-- 1. Create request_audit_log table
CREATE TABLE IF NOT EXISTS public.request_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.valuation_requests(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  old_status text NOT NULL,
  new_status text NOT NULL,
  user_id uuid,
  action_type text NOT NULL DEFAULT 'normal' CHECK (action_type IN ('normal', 'simulated', 'bypass', 'auto')),
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_request_audit_log_request ON public.request_audit_log(request_id);
CREATE INDEX idx_request_audit_log_assignment ON public.request_audit_log(assignment_id);
CREATE INDEX idx_request_audit_log_created ON public.request_audit_log(created_at DESC);

-- RLS
ALTER TABLE public.request_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit logs"
  ON public.request_audit_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "System can insert audit logs"
  ON public.request_audit_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- Immutability: prevent updates and deletes
CREATE TRIGGER prevent_audit_log_edit
  BEFORE UPDATE OR DELETE ON public.request_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 2. Central transition function
CREATE OR REPLACE FUNCTION public.update_request_status(
  _assignment_id uuid,
  _new_status text,
  _user_id uuid DEFAULT NULL,
  _action_type text DEFAULT 'normal',
  _reason text DEFAULT NULL,
  _bypass_justification text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_status text;
  _request_id uuid;
  _is_allowed boolean := false;
  _allowed_targets text[];
  _is_payment_gate boolean := false;
  _payment_ok boolean := false;
  _result jsonb;
BEGIN
  -- Get current status
  SELECT status INTO _current_status
  FROM public.valuation_assignments
  WHERE id = _assignment_id
  FOR UPDATE;

  IF _current_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الملف غير موجود');
  END IF;

  -- Get linked request
  SELECT id INTO _request_id
  FROM public.valuation_requests
  WHERE assignment_id = _assignment_id
  LIMIT 1;

  -- Define ALLOWED_TRANSITIONS (18-status matrix)
  _allowed_targets := CASE _current_status
    WHEN 'draft' THEN ARRAY['submitted']
    WHEN 'submitted' THEN ARRAY['scope_generated']
    WHEN 'scope_generated' THEN ARRAY['scope_approved']
    WHEN 'scope_approved' THEN ARRAY['first_payment_confirmed']
    WHEN 'first_payment_confirmed' THEN ARRAY['data_collection_open']
    WHEN 'data_collection_open' THEN ARRAY['data_collection_complete']
    WHEN 'data_collection_complete' THEN ARRAY['inspection_pending', 'data_validated']
    WHEN 'inspection_pending' THEN ARRAY['inspection_completed']
    WHEN 'inspection_completed' THEN ARRAY['data_validated']
    WHEN 'data_validated' THEN ARRAY['analysis_complete']
    WHEN 'analysis_complete' THEN ARRAY['professional_review']
    WHEN 'professional_review' THEN ARRAY['draft_report_ready']
    WHEN 'draft_report_ready' THEN ARRAY['client_review']
    WHEN 'client_review' THEN ARRAY['draft_approved', 'professional_review']
    WHEN 'draft_approved' THEN ARRAY['final_payment_confirmed']
    WHEN 'final_payment_confirmed' THEN ARRAY['issued']
    WHEN 'issued' THEN ARRAY['archived']
    WHEN 'archived' THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;

  -- Check if transition is allowed
  _is_allowed := _new_status = ANY(_allowed_targets);

  IF NOT _is_allowed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('انتقال غير مسموح: %s → %s', _current_status, _new_status)
    );
  END IF;

  -- Payment Gate: first_payment_confirmed
  IF _new_status = 'first_payment_confirmed' THEN
    _is_payment_gate := true;
    SELECT EXISTS(
      SELECT 1 FROM public.payments
      WHERE request_id = _request_id
        AND payment_stage IN ('first', 'full')
        AND payment_status = 'paid'
    ) INTO _payment_ok;

    IF NOT _payment_ok AND _action_type != 'bypass' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'يجب تأكيد الدفعة الأولى (50%) قبل الانتقال'
      );
    END IF;

    IF NOT _payment_ok AND _action_type = 'bypass' THEN
      IF _bypass_justification IS NULL OR length(trim(_bypass_justification)) < 10 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'يجب كتابة مبرر واضح (10 أحرف) لتجاوز بوابة الدفع'
        );
      END IF;
    END IF;
  END IF;

  -- Payment Gate: final_payment_confirmed
  IF _new_status = 'final_payment_confirmed' THEN
    _is_payment_gate := true;
    SELECT EXISTS(
      SELECT 1 FROM public.payments
      WHERE request_id = _request_id
        AND payment_stage IN ('final', 'full')
        AND payment_status = 'paid'
    ) INTO _payment_ok;

    IF NOT _payment_ok AND _action_type != 'bypass' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'يجب تأكيد الدفعة النهائية (100%) قبل الإصدار'
      );
    END IF;

    IF NOT _payment_ok AND _action_type = 'bypass' THEN
      IF _bypass_justification IS NULL OR length(trim(_bypass_justification)) < 10 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'يجب كتابة مبرر واضح (10 أحرف) لتجاوز بوابة الدفع'
        );
      END IF;
    END IF;
  END IF;

  -- Apply the transition
  UPDATE public.valuation_assignments
  SET status = _new_status, updated_at = now()
  WHERE id = _assignment_id;

  -- Apply locks
  IF _new_status = 'first_payment_confirmed' THEN
    UPDATE public.valuation_assignments
    SET updated_at = now()
    WHERE id = _assignment_id;
    -- Client data lock is enforced by checking status >= first_payment_confirmed
  END IF;

  IF _new_status IN ('issued', 'archived') THEN
    UPDATE public.valuation_assignments
    SET is_locked = true, updated_at = now()
    WHERE id = _assignment_id;
  END IF;

  -- Log to request_audit_log
  INSERT INTO public.request_audit_log (
    request_id, assignment_id, old_status, new_status,
    user_id, action_type, reason, metadata
  ) VALUES (
    _request_id, _assignment_id, _current_status, _new_status,
    _user_id, _action_type, COALESCE(_reason, _bypass_justification),
    jsonb_build_object(
      'payment_gate', _is_payment_gate,
      'payment_verified', _payment_ok,
      'bypass_used', (_action_type = 'bypass'),
      'bypass_justification', _bypass_justification
    )
  );

  -- Also log to existing audit_logs table
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, assignment_id,
    old_data, new_data, description
  ) VALUES (
    COALESCE(_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'status_change',
    'valuation_assignments',
    _assignment_id::text,
    _assignment_id::text,
    jsonb_build_object('status', _current_status),
    jsonb_build_object('status', _new_status),
    format('تغيير حالة: %s → %s | نوع: %s%s',
      _current_status, _new_status, _action_type,
      CASE WHEN _reason IS NOT NULL THEN ' | السبب: ' || _reason ELSE '' END
    )
  );

  RETURN jsonb_build_object('success', true, 'old_status', _current_status, 'new_status', _new_status);
END;
$$;

-- 3. Lock enforcement: prevent client data edits after first_payment_confirmed
CREATE OR REPLACE FUNCTION public.enforce_post_payment_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _assignment_status text;
  _locked_statuses text[] := ARRAY[
    'first_payment_confirmed', 'data_collection_open', 'data_collection_complete',
    'inspection_pending', 'inspection_completed', 'data_validated',
    'analysis_complete', 'professional_review', 'draft_report_ready',
    'client_review', 'draft_approved', 'final_payment_confirmed',
    'issued', 'archived'
  ];
BEGIN
  -- Check assignment status
  SELECT va.status INTO _assignment_status
  FROM public.valuation_assignments va
  JOIN public.valuation_requests vr ON vr.assignment_id = va.id
  WHERE vr.id = COALESCE(NEW.id, OLD.id);

  IF _assignment_status = ANY(_locked_statuses) THEN
    -- Allow only specific safe fields to be updated
    IF TG_OP = 'UPDATE' THEN
      -- Block changes to core client/asset fields after payment
      IF NEW.valuation_type IS DISTINCT FROM OLD.valuation_type
        OR NEW.asset_type IS DISTINCT FROM OLD.asset_type
        OR NEW.purpose IS DISTINCT FROM OLD.purpose THEN
        RAISE EXCEPTION 'لا يمكن تعديل بيانات الطلب الأساسية بعد تأكيد الدفع';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_request_post_payment_lock
  BEFORE UPDATE ON public.valuation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_post_payment_lock();
