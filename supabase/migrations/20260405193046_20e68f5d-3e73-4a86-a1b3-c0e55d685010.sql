
-- Create merge log table
CREATE TABLE IF NOT EXISTS public.client_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_client_id uuid NOT NULL REFERENCES public.clients(id),
  source_client_id uuid NOT NULL,
  source_client_name text,
  target_client_name text,
  match_field text,
  match_value text,
  confidence_score integer,
  merged_by uuid REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_merge_log ENABLE ROW LEVEL SECURITY;

-- Only owner/admin can view merge logs
CREATE POLICY "Admin can view merge logs"
  ON public.client_merge_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'admin_coordinator')
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_client_merge_log_target ON public.client_merge_log(target_client_id);

-- Replace match function to return confidence + matched_id
CREATE OR REPLACE FUNCTION public.match_client_with_confidence(
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _name_ar text DEFAULT NULL,
  _cr_number text DEFAULT NULL,
  _org_id uuid DEFAULT NULL
)
RETURNS TABLE(matched_id uuid, confidence integer, match_field text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Priority 1: phone match (high confidence: 95)
  IF _phone IS NOT NULL AND _phone != '' THEN
    RETURN QUERY
    SELECT c.id, 95, 'phone'::text
    FROM public.clients c
    WHERE c.phone = _phone AND (_org_id IS NULL OR c.organization_id = _org_id)
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 2: email match (high confidence: 90)
  IF _email IS NOT NULL AND _email != '' THEN
    RETURN QUERY
    SELECT c.id, 90, 'email'::text
    FROM public.clients c
    WHERE c.email = _email AND (_org_id IS NULL OR c.organization_id = _org_id)
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 3: cr_number match (high confidence: 85)
  IF _cr_number IS NOT NULL AND _cr_number != '' THEN
    RETURN QUERY
    SELECT c.id, 85, 'cr_number'::text
    FROM public.clients c
    WHERE c.cr_number = _cr_number AND (_org_id IS NULL OR c.organization_id = _org_id)
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 4: exact name match (medium confidence: 60)
  IF _name_ar IS NOT NULL AND _name_ar != '' THEN
    RETURN QUERY
    SELECT c.id, 60, 'name'::text
    FROM public.clients c
    WHERE c.name_ar = _name_ar AND (_org_id IS NULL OR c.organization_id = _org_id)
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  RETURN;
END;
$$;

-- Update link function to only auto-link on high confidence (>= 80)
CREATE OR REPLACE FUNCTION public.link_portal_user_to_client(
  _user_id uuid,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _name_ar text DEFAULT NULL,
  _org_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _matched_id uuid;
  _confidence integer;
  _match_field text;
BEGIN
  -- Check if already linked
  SELECT id INTO _matched_id FROM public.clients
  WHERE portal_user_id = _user_id
  LIMIT 1;
  IF _matched_id IS NOT NULL THEN RETURN _matched_id; END IF;

  -- Try to match with confidence
  SELECT m.matched_id, m.confidence, m.match_field
  INTO _matched_id, _confidence, _match_field
  FROM public.match_client_with_confidence(_phone, _email, _name_ar, NULL, _org_id) m
  LIMIT 1;

  -- Only auto-link if confidence >= 80
  IF _matched_id IS NOT NULL AND _confidence >= 80 THEN
    UPDATE public.clients
    SET portal_user_id = _user_id,
        client_status = 'portal',
        updated_at = now()
    WHERE id = _matched_id AND portal_user_id IS NULL;
    RETURN _matched_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Update merge function to log the operation
CREATE OR REPLACE FUNCTION public.merge_client_records(
  _target_id uuid,
  _source_id uuid,
  _merged_by uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _source_name text;
  _target_name text;
BEGIN
  SELECT name_ar INTO _source_name FROM public.clients WHERE id = _source_id;
  SELECT name_ar INTO _target_name FROM public.clients WHERE id = _target_id;

  -- Move archived reports
  UPDATE public.archived_reports SET client_id = _target_id WHERE client_id = _source_id;

  -- Move valuation assignments
  UPDATE public.valuation_assignments SET client_id = _target_id WHERE client_id = _source_id;

  -- Transfer portal_user_id if source has one and target doesn't
  UPDATE public.clients SET
    portal_user_id = (SELECT portal_user_id FROM public.clients WHERE id = _source_id),
    client_status = 'portal'
  WHERE id = _target_id
    AND portal_user_id IS NULL
    AND (SELECT portal_user_id FROM public.clients WHERE id = _source_id) IS NOT NULL;

  -- Deactivate source
  UPDATE public.clients SET is_active = false, notes = COALESCE(notes, '') || ' [مدمج مع ' || _target_id::text || ']' WHERE id = _source_id;

  -- Log the merge
  INSERT INTO public.client_merge_log (target_client_id, source_client_id, source_client_name, target_client_name, merged_by, reason)
  VALUES (_target_id, _source_id, _source_name, _target_name, _merged_by, _reason);

  RETURN true;
END;
$$;
