
-- Add client_status and portal_user_id to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_status text NOT NULL DEFAULT 'potential',
  ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add constraint for valid statuses
ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check CHECK (client_status IN ('potential', 'verified', 'portal'));

-- Index for fast matching
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_portal_user ON public.clients(portal_user_id) WHERE portal_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_cr_number ON public.clients(cr_number) WHERE cr_number IS NOT NULL;

-- Function to find matching client by phone, email, or cr_number
CREATE OR REPLACE FUNCTION public.match_client_record(
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _name_ar text DEFAULT NULL,
  _cr_number text DEFAULT NULL,
  _org_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  matched_id uuid;
BEGIN
  -- Priority 1: phone match
  IF _phone IS NOT NULL AND _phone != '' THEN
    SELECT id INTO matched_id FROM public.clients
    WHERE phone = _phone AND (_org_id IS NULL OR organization_id = _org_id)
    LIMIT 1;
    IF matched_id IS NOT NULL THEN RETURN matched_id; END IF;
  END IF;

  -- Priority 2: email match
  IF _email IS NOT NULL AND _email != '' THEN
    SELECT id INTO matched_id FROM public.clients
    WHERE email = _email AND (_org_id IS NULL OR organization_id = _org_id)
    LIMIT 1;
    IF matched_id IS NOT NULL THEN RETURN matched_id; END IF;
  END IF;

  -- Priority 3: cr_number match (companies)
  IF _cr_number IS NOT NULL AND _cr_number != '' THEN
    SELECT id INTO matched_id FROM public.clients
    WHERE cr_number = _cr_number AND (_org_id IS NULL OR organization_id = _org_id)
    LIMIT 1;
    IF matched_id IS NOT NULL THEN RETURN matched_id; END IF;
  END IF;

  -- Priority 4: exact name match
  IF _name_ar IS NOT NULL AND _name_ar != '' THEN
    SELECT id INTO matched_id FROM public.clients
    WHERE name_ar = _name_ar AND (_org_id IS NULL OR organization_id = _org_id)
    LIMIT 1;
    IF matched_id IS NOT NULL THEN RETURN matched_id; END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- Function to link a portal user to an existing client record
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
  matched_id uuid;
BEGIN
  -- Check if already linked
  SELECT id INTO matched_id FROM public.clients
  WHERE portal_user_id = _user_id
  LIMIT 1;
  IF matched_id IS NOT NULL THEN RETURN matched_id; END IF;

  -- Try to match existing record
  matched_id := public.match_client_record(_phone, _email, _name_ar, NULL, _org_id);

  IF matched_id IS NOT NULL THEN
    -- Link and upgrade status
    UPDATE public.clients
    SET portal_user_id = _user_id,
        client_status = 'portal',
        updated_at = now()
    WHERE id = matched_id AND portal_user_id IS NULL;
    RETURN matched_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Function to find duplicate client records
CREATE OR REPLACE FUNCTION public.find_duplicate_clients(_org_id uuid)
RETURNS TABLE(client_id_1 uuid, client_id_2 uuid, match_field text, match_value text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Phone duplicates
  RETURN QUERY
  SELECT c1.id, c2.id, 'phone'::text, c1.phone
  FROM public.clients c1
  JOIN public.clients c2 ON c1.phone = c2.phone AND c1.id < c2.id
  WHERE c1.organization_id = _org_id
    AND c1.phone IS NOT NULL AND c1.phone != '';

  -- Email duplicates
  RETURN QUERY
  SELECT c1.id, c2.id, 'email'::text, c1.email
  FROM public.clients c1
  JOIN public.clients c2 ON c1.email = c2.email AND c1.id < c2.id
  WHERE c1.organization_id = _org_id
    AND c1.email IS NOT NULL AND c1.email != ''
    AND NOT EXISTS (
      SELECT 1 FROM public.clients a
      JOIN public.clients b ON a.phone = b.phone AND a.id < b.id
      WHERE a.id = c1.id AND b.id = c2.id AND a.phone IS NOT NULL
    );

  -- CR number duplicates
  RETURN QUERY
  SELECT c1.id, c2.id, 'cr_number'::text, c1.cr_number
  FROM public.clients c1
  JOIN public.clients c2 ON c1.cr_number = c2.cr_number AND c1.id < c2.id
  WHERE c1.organization_id = _org_id
    AND c1.cr_number IS NOT NULL AND c1.cr_number != '';
END;
$$;

-- Merge function: move all references from source to target, then deactivate source
CREATE OR REPLACE FUNCTION public.merge_client_records(_target_id uuid, _source_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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

  RETURN true;
END;
$$;
