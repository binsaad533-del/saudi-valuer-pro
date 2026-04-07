
-- ═══════════════════════════════════════════════════════════════
-- 1. Enhanced update_request_status with Simulation Mode
-- 2. Prevent direct status UPDATE trigger
-- 3. Enhanced post-payment lock (including asset_data)
-- 4. Full read-only after archived
-- ═══════════════════════════════════════════════════════════════

-- Drop and recreate the function with simulation support
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
AS $function$
DECLARE
  _current_status text;
  _request_id uuid;
  _is_allowed boolean := false;
  _allowed_targets text[];
  _is_payment_gate boolean := false;
  _payment_ok boolean := false;
BEGIN
  -- Get current status with row lock
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

  -- ══ ALLOWED_TRANSITIONS (18-status matrix) ══
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

  _is_allowed := _new_status = ANY(_allowed_targets);

  IF NOT _is_allowed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('انتقال غير مسموح: %s → %s', _current_status, _new_status)
    );
  END IF;

  -- ══ Payment Gate: first_payment_confirmed ══
  IF _new_status = 'first_payment_confirmed' THEN
    _is_payment_gate := true;

    -- SIMULATED mode: skip payment check entirely
    IF _action_type = 'simulated' THEN
      _payment_ok := true;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM public.payments
        WHERE request_id = _request_id
          AND payment_stage IN ('first', 'full')
          AND payment_status = 'paid'
      ) INTO _payment_ok;
    END IF;

    IF NOT _payment_ok AND _action_type = 'bypass' THEN
      IF _bypass_justification IS NULL OR length(trim(_bypass_justification)) < 10 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'يجب كتابة مبرر واضح (10 أحرف على الأقل) لتجاوز بوابة الدفع'
        );
      END IF;
      _payment_ok := true; -- bypass accepted
    END IF;

    IF NOT _payment_ok THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'يجب تأكيد الدفعة الأولى (50%) قبل الانتقال'
      );
    END IF;
  END IF;

  -- ══ Payment Gate: final_payment_confirmed ══
  IF _new_status = 'final_payment_confirmed' THEN
    _is_payment_gate := true;

    IF _action_type = 'simulated' THEN
      _payment_ok := true;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM public.payments
        WHERE request_id = _request_id
          AND payment_stage IN ('final', 'full')
          AND payment_status = 'paid'
      ) INTO _payment_ok;
    END IF;

    IF NOT _payment_ok AND _action_type = 'bypass' THEN
      IF _bypass_justification IS NULL OR length(trim(_bypass_justification)) < 10 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'يجب كتابة مبرر واضح (10 أحرف على الأقل) لتجاوز بوابة الدفع'
        );
      END IF;
      _payment_ok := true;
    END IF;

    IF NOT _payment_ok THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'يجب تأكيد الدفعة النهائية (100%) قبل الإصدار'
      );
    END IF;
  END IF;

  -- ══ Apply the transition ══
  UPDATE public.valuation_assignments
  SET status = _new_status, updated_at = now()
  WHERE id = _assignment_id;

  -- ══ Apply locks ══
  IF _new_status IN ('issued', 'archived') THEN
    UPDATE public.valuation_assignments
    SET is_locked = true, updated_at = now()
    WHERE id = _assignment_id;
  END IF;

  -- ══ Log to request_audit_log ══
  INSERT INTO public.request_audit_log (
    request_id, assignment_id, old_status, new_status,
    user_id, action_type, reason, metadata
  ) VALUES (
    _request_id, _assignment_id, _current_status, _new_status,
    _user_id, _action_type, COALESCE(_reason, _bypass_justification),
    jsonb_build_object(
      'payment_gate', _is_payment_gate,
      'payment_verified', _payment_ok,
      'simulated', (_action_type = 'simulated'),
      'bypass_used', (_action_type = 'bypass'),
      'bypass_justification', _bypass_justification
    )
  );

  -- ══ Also log to audit_logs ══
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
    jsonb_build_object('status', _new_status, 'action_type', _action_type, 'simulated', (_action_type = 'simulated')),
    format('تغيير حالة: %s → %s | نوع: %s%s',
      _current_status, _new_status, _action_type,
      CASE WHEN _reason IS NOT NULL THEN ' | السبب: ' || _reason ELSE '' END
    )
  );

  RETURN jsonb_build_object('success', true, 'old_status', _current_status, 'new_status', _new_status);
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Prevent direct status UPDATE on valuation_assignments
--    Only update_request_status (SECURITY DEFINER) can change status
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_direct_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow if called from a SECURITY DEFINER context (i.e. our function)
  -- We detect this by checking if current_setting is set by our function
  IF current_setting('app.allow_status_change', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- If status changed, block it
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'تغيير الحالة مباشرة غير مسموح. يجب استخدام update_request_status()';
  END IF;

  RETURN NEW;
END;
$function$;

-- Update the main function to set the session variable before status update
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
AS $function$
DECLARE
  _current_status text;
  _request_id uuid;
  _is_allowed boolean := false;
  _allowed_targets text[];
  _is_payment_gate boolean := false;
  _payment_ok boolean := false;
BEGIN
  -- Set session var to allow our status change through the trigger
  PERFORM set_config('app.allow_status_change', 'true', true);

  SELECT status INTO _current_status
  FROM public.valuation_assignments
  WHERE id = _assignment_id
  FOR UPDATE;

  IF _current_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الملف غير موجود');
  END IF;

  SELECT id INTO _request_id
  FROM public.valuation_requests
  WHERE assignment_id = _assignment_id
  LIMIT 1;

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
    IF _action_type = 'simulated' THEN
      _payment_ok := true;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM public.payments
        WHERE request_id = _request_id
          AND payment_stage IN ('first', 'full')
          AND payment_status = 'paid'
      ) INTO _payment_ok;
    END IF;

    IF NOT _payment_ok AND _action_type = 'bypass' THEN
      IF _bypass_justification IS NULL OR length(trim(_bypass_justification)) < 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'يجب كتابة مبرر واضح (10 أحرف على الأقل) لتجاوز بوابة الدفع');
      END IF;
      _payment_ok := true;
    END IF;

    IF NOT _payment_ok THEN
      RETURN jsonb_build_object('success', false, 'error', 'يجب تأكيد الدفعة الأولى (50%) قبل الانتقال');
    END IF;
  END IF;

  -- Payment Gate: final_payment_confirmed
  IF _new_status = 'final_payment_confirmed' THEN
    _is_payment_gate := true;
    IF _action_type = 'simulated' THEN
      _payment_ok := true;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM public.payments
        WHERE request_id = _request_id
          AND payment_stage IN ('final', 'full')
          AND payment_status = 'paid'
      ) INTO _payment_ok;
    END IF;

    IF NOT _payment_ok AND _action_type = 'bypass' THEN
      IF _bypass_justification IS NULL OR length(trim(_bypass_justification)) < 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'يجب كتابة مبرر واضح (10 أحرف على الأقل) لتجاوز بوابة الدفع');
      END IF;
      _payment_ok := true;
    END IF;

    IF NOT _payment_ok THEN
      RETURN jsonb_build_object('success', false, 'error', 'يجب تأكيد الدفعة النهائية (100%) قبل الإصدار');
    END IF;
  END IF;

  -- Apply status change
  UPDATE public.valuation_assignments
  SET status = _new_status, updated_at = now()
  WHERE id = _assignment_id;

  -- Apply locks
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
      'simulated', (_action_type = 'simulated'),
      'bypass_used', (_action_type = 'bypass'),
      'bypass_justification', _bypass_justification
    )
  );

  -- Log to audit_logs
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, assignment_id,
    old_data, new_data, description
  ) VALUES (
    COALESCE(_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'status_change', 'valuation_assignments',
    _assignment_id::text, _assignment_id::text,
    jsonb_build_object('status', _current_status),
    jsonb_build_object('status', _new_status, 'action_type', _action_type, 'simulated', (_action_type = 'simulated')),
    format('تغيير حالة: %s → %s | نوع: %s%s',
      _current_status, _new_status, _action_type,
      CASE WHEN _reason IS NOT NULL THEN ' | السبب: ' || _reason ELSE '' END
    )
  );

  -- Reset session var
  PERFORM set_config('app.allow_status_change', 'false', true);

  RETURN jsonb_build_object('success', true, 'old_status', _current_status, 'new_status', _new_status);
END;
$function$;

-- Create the trigger to prevent direct status updates
DROP TRIGGER IF EXISTS trg_prevent_direct_status_update ON public.valuation_assignments;
CREATE TRIGGER trg_prevent_direct_status_update
  BEFORE UPDATE ON public.valuation_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_status_update();

-- ═══════════════════════════════════════════════════════════════
-- 3. Enhanced post-payment lock (block asset_data too)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_post_payment_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  SELECT va.status INTO _assignment_status
  FROM public.valuation_assignments va
  JOIN public.valuation_requests vr ON vr.assignment_id = va.id
  WHERE vr.id = COALESCE(NEW.id, OLD.id);

  IF _assignment_status = ANY(_locked_statuses) THEN
    IF TG_OP = 'UPDATE' THEN
      -- Block core fields + asset_data after payment
      IF NEW.valuation_type IS DISTINCT FROM OLD.valuation_type
        OR NEW.asset_type IS DISTINCT FROM OLD.asset_type
        OR NEW.purpose IS DISTINCT FROM OLD.purpose
        OR NEW.asset_data::text IS DISTINCT FROM OLD.asset_data::text THEN
        RAISE EXCEPTION 'لا يمكن تعديل بيانات الطلب الأساسية بعد تأكيد الدفع';
      END IF;
    END IF;

    -- Full read-only after archived
    IF _assignment_status = 'archived' THEN
      RAISE EXCEPTION 'الطلب مؤرشف — لا يمكن إجراء أي تعديل';
    END IF;

    -- Block all updates after issued (except payment-related metadata)
    IF _assignment_status = 'issued' THEN
      IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
        -- Allow only updated_at changes from other triggers
        NULL;
      ELSE
        RAISE EXCEPTION 'التقرير صادر — لا يمكن تعديل بيانات الطلب';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on valuation_requests
DROP TRIGGER IF EXISTS trg_enforce_post_payment_lock ON public.valuation_requests;
CREATE TRIGGER trg_enforce_post_payment_lock
  BEFORE UPDATE ON public.valuation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_post_payment_lock();
