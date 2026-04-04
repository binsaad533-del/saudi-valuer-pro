
-- 1. Fix archived_reports SELECT policy: restrict by organization
DROP POLICY IF EXISTS "authenticated_select_archived_reports" ON public.archived_reports;
CREATE POLICY "authenticated_select_archived_reports" ON public.archived_reports
  FOR SELECT TO authenticated
  USING (
    organization_id = get_user_org_id(auth.uid())
    OR uploaded_by = auth.uid()
    OR client_id IN (SELECT c.id FROM clients c WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- 2. Fix raqeem_knowledge: restrict write to owner/admin
DROP POLICY IF EXISTS "Authenticated users manage raqeem knowledge" ON public.raqeem_knowledge;
CREATE POLICY "Admins manage raqeem knowledge" ON public.raqeem_knowledge
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));

-- 3. Fix raqeem_rules: restrict write to owner/admin
DROP POLICY IF EXISTS "Authenticated users manage raqeem rules" ON public.raqeem_rules;
CREATE POLICY "Admins manage raqeem rules" ON public.raqeem_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));

-- 4. Fix raqeem_corrections: restrict write to owner/admin
DROP POLICY IF EXISTS "Authenticated users manage raqeem corrections" ON public.raqeem_corrections;
CREATE POLICY "Admins manage raqeem corrections" ON public.raqeem_corrections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));

-- 5. Fix report_templates SELECT: restrict by organization
DROP POLICY IF EXISTS "Authenticated users can view report templates" ON public.report_templates;
CREATE POLICY "Org members can view report templates" ON public.report_templates
  FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- 6. Fix discount_codes SELECT: restrict to admins only
DROP POLICY IF EXISTS "Authenticated users can read active codes" ON public.discount_codes;
CREATE POLICY "Admins can read discount codes" ON public.discount_codes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role) OR has_role(auth.uid(), 'financial_manager'::app_role));

-- 7. Fix storage: attachments/reports/signatures - restrict by org
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
CREATE POLICY "Org members can view attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    OR (bucket_id IN ('attachments', 'reports', 'signatures') AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'financial_manager'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    ))
  );

-- 8. Fix storage: inspection-photos - restrict to org/inspector
DROP POLICY IF EXISTS "Authenticated read inspection photos" ON storage.objects;
CREATE POLICY "Org or inspector read inspection photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inspection-photos' AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    )
  );

-- 9. Fix storage: client-uploads - restrict to own uploads or admins
DROP POLICY IF EXISTS "Users can view own uploads" ON storage.objects;
CREATE POLICY "Users can view own uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-uploads' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
    )
  );

-- 10. Fix function search_path for email queue functions
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;
