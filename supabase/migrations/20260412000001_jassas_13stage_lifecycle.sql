-- =============================================================================
-- Migration: Jassas 13-Stage Lifecycle
-- 1. Add 13-stage values to assignment_status + request_status enums
-- 2. Add request_id to valuation_assignments (bidirectional link)
-- 3. Add portal_user_id to clients (identify portal users)
-- 4. Auto-create valuation_assignment on valuation_request insert (BEFORE trigger)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend assignment_status enum with 13-stage values
-- ---------------------------------------------------------------------------
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_1_processing';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_2_client_review';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_3_owner_scope';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_4_client_scope';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'pending_payment_1';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_5_inspection';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_6_owner_draft';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_7_client_draft';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'pending_payment_2';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'signing';
-- 'issued' and 'archived' already exist — skip

-- ---------------------------------------------------------------------------
-- 2. Extend request_status enum with 13-stage values
--    (used by workflow-engine when syncing request status for client portal)
-- ---------------------------------------------------------------------------
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_1_processing';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_2_client_review';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_3_owner_scope';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_4_client_scope';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'pending_payment_1';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_5_inspection';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_6_owner_draft';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_7_client_draft';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'pending_payment_2';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'signing';
-- 'completed' and 'archived' already exist — skip

-- ---------------------------------------------------------------------------
-- 3. Add request_id to valuation_assignments (bidirectional link)
-- ---------------------------------------------------------------------------
ALTER TABLE public.valuation_assignments
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.valuation_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_request_id
  ON public.valuation_assignments(request_id);

-- ---------------------------------------------------------------------------
-- 4. Add portal_user_id to clients (links a portal auth.user to a client record)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_portal_user
  ON public.clients(portal_user_id);

-- ---------------------------------------------------------------------------
-- 5. Trigger function: auto-create valuation_assignment when a request is inserted
--
--    Strategy (BEFORE INSERT — runs before the row is committed so we can
--    set NEW.assignment_id in the same transaction):
--
--    a) Resolve organization_id — single-tenant: use the single active org.
--    b) Find or create a client record linked to the portal user.
--    c) Insert a new valuation_assignment with status = 'draft'.
--    d) Set NEW.assignment_id so the request row already carries the link.
--    e) On any failure, raise a WARNING and continue (never block the insert).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_create_assignment_from_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id        UUID;
  v_client_id     UUID;
  v_seq_num       INTEGER;
  v_asgn_id       UUID;
  v_user_name_ar  TEXT;
  v_valuation_mode TEXT;
BEGIN
  -- Skip if assignment already set (manual override)
  IF NEW.assignment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- ── a) Resolve organization ───────────────────────────────────────────────
  -- Try user's own profile org first; fall back to the single active org.
  SELECT p.organization_id INTO v_org_id
  FROM public.profiles p
  WHERE p.user_id = NEW.client_user_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE WARNING '[auto_create_assignment] No organization found — skipping assignment creation for request %', NEW.id;
    RETURN NEW;
  END IF;

  -- ── b) Find or create client record ──────────────────────────────────────
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE portal_user_id = NEW.client_user_id
    AND organization_id = v_org_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    -- Get the user's display name from profiles
    SELECT COALESCE(full_name_ar, 'عميل') INTO v_user_name_ar
    FROM public.profiles
    WHERE user_id = NEW.client_user_id
    LIMIT 1;

    INSERT INTO public.clients (
      organization_id,
      portal_user_id,
      name_ar,
      client_type,
      created_by
    ) VALUES (
      v_org_id,
      NEW.client_user_id,
      COALESCE(v_user_name_ar, 'عميل'),
      'individual',
      NEW.client_user_id
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- ── c) Generate sequential_number (per-org) ───────────────────────────────
  SELECT COALESCE(MAX(sequential_number), 0) + 1 INTO v_seq_num
  FROM public.valuation_assignments
  WHERE organization_id = v_org_id;

  -- ── d) Resolve valuation_mode (desktop vs field) ──────────────────────────
  v_valuation_mode := COALESCE(NEW.valuation_mode, 'desktop');

  -- ── e) Insert assignment ──────────────────────────────────────────────────
  INSERT INTO public.valuation_assignments (
    organization_id,
    request_id,
    reference_number,
    sequential_number,
    client_id,
    status,
    property_type,
    purpose,
    valuation_mode,
    basis_of_value,
    report_language,
    created_by
  ) VALUES (
    v_org_id,
    NEW.id,                                              -- request_id (NEW.id is UUID set by DEFAULT before BEFORE trigger)
    NEW.reference_number,
    v_seq_num,
    v_client_id,
    'draft'::public.assignment_status,
    'residential'::public.property_type,                -- sensible default; owner updates in stage_3
    COALESCE(NEW.purpose, 'sale_purchase'::public.valuation_purpose),
    v_valuation_mode,
    'market_value'::public.basis_of_value,
    'ar'::public.report_language,
    NEW.client_user_id
  )
  RETURNING id INTO v_asgn_id;

  -- ── f) Back-link: stamp assignment_id onto the request row ───────────────
  NEW.assignment_id := v_asgn_id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never block request creation — log and continue
  RAISE WARNING '[auto_create_assignment] Failed for request % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists, then recreate
DROP TRIGGER IF EXISTS trg_auto_create_assignment ON public.valuation_requests;

CREATE TRIGGER trg_auto_create_assignment
  BEFORE INSERT ON public.valuation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_assignment_from_request();

-- ---------------------------------------------------------------------------
-- 6. Back-fill existing requests that have no assignment_id
--    (runs once, safe to re-run — skips already-linked rows)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r          RECORD;
  v_org_id   UUID;
  v_client_id UUID;
  v_seq_num  INTEGER;
  v_asgn_id  UUID;
BEGIN
  FOR r IN
    SELECT vr.id, vr.client_user_id, vr.reference_number, vr.purpose, vr.valuation_mode
    FROM public.valuation_requests vr
    WHERE vr.assignment_id IS NULL
    ORDER BY vr.created_at
  LOOP
    -- org
    SELECT COALESCE(
      (SELECT organization_id FROM public.profiles WHERE user_id = r.client_user_id LIMIT 1),
      (SELECT id FROM public.organizations WHERE is_active = true ORDER BY created_at LIMIT 1)
    ) INTO v_org_id;

    IF v_org_id IS NULL THEN CONTINUE; END IF;

    -- client
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE portal_user_id = r.client_user_id AND organization_id = v_org_id LIMIT 1;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (organization_id, portal_user_id, name_ar, client_type, created_by)
      VALUES (
        v_org_id, r.client_user_id,
        COALESCE((SELECT full_name_ar FROM public.profiles WHERE user_id = r.client_user_id LIMIT 1), 'عميل'),
        'individual', r.client_user_id
      ) RETURNING id INTO v_client_id;
    END IF;

    -- seq
    SELECT COALESCE(MAX(sequential_number), 0) + 1 INTO v_seq_num
    FROM public.valuation_assignments WHERE organization_id = v_org_id;

    -- insert assignment
    INSERT INTO public.valuation_assignments (
      organization_id, request_id, reference_number, sequential_number,
      client_id, status, property_type, purpose, valuation_mode,
      basis_of_value, report_language, created_by
    ) VALUES (
      v_org_id, r.id, r.reference_number, v_seq_num,
      v_client_id, 'draft'::public.assignment_status,
      'residential'::public.property_type,
      COALESCE(r.purpose, 'sale_purchase'::public.valuation_purpose),
      COALESCE(r.valuation_mode, 'desktop'),
      'market_value'::public.basis_of_value, 'ar'::public.report_language,
      r.client_user_id
    ) RETURNING id INTO v_asgn_id;

    -- back-link
    UPDATE public.valuation_requests SET assignment_id = v_asgn_id WHERE id = r.id;

    RAISE NOTICE 'Back-filled assignment % for request %', v_asgn_id, r.id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS: allow owners/admins to read assignments via request_id
-- ---------------------------------------------------------------------------
-- (existing RLS on valuation_assignments already covers organization_id check)
-- No additional policy needed.

-- ---------------------------------------------------------------------------
-- Done
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.valuation_assignments.request_id IS
  'Bidirectional link back to valuation_requests. Set automatically by trg_auto_create_assignment.';

COMMENT ON COLUMN public.clients.portal_user_id IS
  'auth.users.id of the portal (client-facing) user linked to this client record.';
