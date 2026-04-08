
CREATE OR REPLACE FUNCTION public.update_request_status(_assignment_id uuid, _new_status text, _user_id uuid DEFAULT NULL::uuid, _action_type text DEFAULT 'normal'::text, _reason text DEFAULT NULL::text, _bypass_justification text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current_status text; _request_id uuid; _allowed_targets text[];
  _is_payment_gate boolean := false; _payment_ok boolean := false;
  _user_role text := 'unknown'; _role_allowed boolean := false;
  _valid_statuses text[] := ARRAY['draft','submitted','scope_generated','scope_approved','first_payment_confirmed','data_collection_open','data_collection_complete','inspection_pending','inspection_completed','data_validated','analysis_complete','professional_review','draft_report_ready','client_review','draft_approved','final_payment_confirmed','issued','archived','cancelled'];
BEGIN
  IF NOT (_new_status = ANY(_valid_statuses)) THEN
    RETURN jsonb_build_object('success', false, 'error', format('حالة غير صالحة: %s', _new_status));
  END IF;

  PERFORM set_config('app.allow_status_change', 'true', true);
  PERFORM set_config('app.system_update', 'true', true);

  SELECT status::text INTO _current_status FROM public.valuation_assignments WHERE id = _assignment_id FOR UPDATE;
  IF _current_status IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'الملف غير موجود'); END IF;

  SELECT id INTO _request_id FROM public.valuation_requests WHERE assignment_id = _assignment_id LIMIT 1;

  _allowed_targets := CASE _current_status
    WHEN 'draft' THEN ARRAY['submitted','cancelled']
    WHEN 'submitted' THEN ARRAY['scope_generated','cancelled']
    WHEN 'scope_generated' THEN ARRAY['scope_approved','cancelled']
    WHEN 'scope_approved' THEN ARRAY['first_payment_confirmed']
    WHEN 'first_payment_confirmed' THEN ARRAY['data_collection_open']
    WHEN 'data_collection_open' THEN ARRAY['data_collection_complete']
    WHEN 'data_collection_complete' THEN ARRAY['inspection_pending','data_validated']
    WHEN 'inspection_pending' THEN ARRAY['inspection_completed']
    WHEN 'inspection_completed' THEN ARRAY['data_validated']
    WHEN 'data_validated' THEN ARRAY['analysis_complete']
    WHEN 'analysis_complete' THEN ARRAY['professional_review']
    WHEN 'professional_review' THEN ARRAY['draft_report_ready']
    WHEN 'draft_report_ready' THEN ARRAY['client_review']
    WHEN 'client_review' THEN ARRAY['draft_approved','professional_review']
    WHEN 'draft_approved' THEN ARRAY['final_payment_confirmed']
    WHEN 'final_payment_confirmed' THEN ARRAY['issued']
    WHEN 'issued' THEN ARRAY['archived']
    WHEN 'archived' THEN ARRAY[]::text[]
    WHEN 'cancelled' THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[] END;

  IF NOT (_new_status = ANY(_allowed_targets)) THEN
    RETURN jsonb_build_object('success', false, 'error', format('انتقال غير مسموح: %s → %s', _current_status, _new_status));
  END IF;

  IF _user_id IS NOT NULL THEN SELECT role::text INTO _user_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1; END IF;
  IF _action_type IN ('auto','simulated') THEN _role_allowed := true;
  ELSIF _user_role IN ('owner','admin') THEN _role_allowed := true;
  ELSIF _user_role = 'client' THEN _role_allowed := ((_current_status='draft' AND _new_status='submitted') OR (_current_status='scope_generated' AND _new_status='scope_approved') OR (_current_status='client_review' AND _new_status='draft_approved') OR (_new_status='cancelled' AND _current_status IN ('draft','submitted','scope_generated')));
  ELSIF _user_role = 'inspector' THEN _role_allowed := (_current_status='inspection_pending' AND _new_status='inspection_completed');
  ELSIF _user_role = 'financial_manager' THEN _role_allowed := (_new_status IN ('first_payment_confirmed','final_payment_confirmed'));
  ELSE _role_allowed := false; END IF;

  IF NOT _role_allowed THEN
    RETURN jsonb_build_object('success', false, 'error', format('الدور "%s" غير مصرح بالانتقال: %s → %s', _user_role, _current_status, _new_status));
  END IF;

  IF _new_status = 'first_payment_confirmed' THEN
    _is_payment_gate := true;
    IF _action_type = 'simulated' THEN _payment_ok := true;
    ELSE SELECT EXISTS(SELECT 1 FROM public.payments WHERE request_id=_request_id AND payment_stage IN ('first','full') AND payment_status='paid') INTO _payment_ok; END IF;
    IF NOT _payment_ok AND _action_type = 'bypass' THEN
      IF _bypass_justification IS NULL OR length(trim(_bypass_justification)) < 10 THEN RETURN jsonb_build_object('success', false, 'error', 'يجب كتابة مبرر واضح (10 أحرف على الأقل) لتجاوز بوابة الدفع'); END IF;
      _payment_ok := true;
    END IF;
    IF NOT _payment_ok THEN RETURN jsonb_build_object('success', false, 'error', 'يجب تأكيد الدفعة الأولى (50%) قبل الانتقال'); END IF;
  END IF;

  IF _new_status = 'final_payment_confirmed' THEN
    _is_payment_gate := true;
    IF _action_type = 'simulated' THEN _payment_ok := true;
    ELSE SELECT EXISTS(SELECT 1 FROM public.payments WHERE request_id=_request_id AND payment_stage IN ('final','full') AND payment_status='paid') INTO _payment_ok; END IF;
    IF NOT _payment_ok AND _action_type = 'bypass' THEN
      IF _bypass_justification IS NULL OR length(trim(_bypass_justification)) < 10 THEN RETURN jsonb_build_object('success', false, 'error', 'يجب كتابة مبرر واضح (10 أحرف على الأقل) لتجاوز بوابة الدفع'); END IF;
      _payment_ok := true;
    END IF;
    IF NOT _payment_ok THEN RETURN jsonb_build_object('success', false, 'error', 'يجب تأكيد الدفعة النهائية (100%) قبل الإصدار'); END IF;
  END IF;

  IF _new_status = 'issued' AND _current_status != 'final_payment_confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إصدار التقرير إلا بعد تأكيد الدفعة النهائية');
  END IF;

  UPDATE public.valuation_assignments SET status = _new_status::assignment_status, updated_at = now() WHERE id = _assignment_id;
  IF _new_status IN ('issued','archived') THEN UPDATE public.valuation_assignments SET is_locked = true, updated_at = now() WHERE id = _assignment_id; END IF;

  INSERT INTO public.request_audit_log (request_id, assignment_id, old_status, new_status, user_id, action_type, reason, metadata)
  VALUES (_request_id, _assignment_id, _current_status, _new_status, _user_id, _action_type, COALESCE(_reason, _bypass_justification),
    jsonb_build_object('payment_gate',_is_payment_gate,'payment_verified',_payment_ok,'simulated',(_action_type='simulated'),'bypass_used',(_action_type='bypass'),'bypass_justification',_bypass_justification,'user_role',_user_role,'validated_at',now()::text));

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, assignment_id, old_data, new_data, description, user_role)
  VALUES (COALESCE(_user_id,'00000000-0000-0000-0000-000000000000'::uuid), 'status_change', 'valuation_assignments',
    _assignment_id, _assignment_id,
    jsonb_build_object('status',_current_status),
    jsonb_build_object('status',_new_status,'action_type',_action_type,'simulated',(_action_type='simulated'),'role',_user_role),
    format('تغيير حالة: %s → %s | دور: %s | نوع: %s%s', _current_status, _new_status, _user_role, _action_type, CASE WHEN _reason IS NOT NULL THEN ' | السبب: '||_reason ELSE '' END),
    _user_role);

  PERFORM set_config('app.allow_status_change', 'false', true);
  PERFORM set_config('app.system_update', 'false', true);

  RETURN jsonb_build_object('success', true, 'old_status', _current_status, 'new_status', _new_status, 'role', _user_role);
END; $function$
