
-- Add new columns to audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_role text;

-- Add new enum values for audit_action
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'upload';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'merge';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'link';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'generate';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'override';

-- Block UPDATE and DELETE on audit_logs (read-only after insert)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Drop existing policies and recreate stricter ones
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.audit_logs;

-- Owner and financial_manager can read
CREATE POLICY "Owner and financial can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

-- Any authenticated user can insert (to log their own actions)
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE policies (enforced by trigger too)
