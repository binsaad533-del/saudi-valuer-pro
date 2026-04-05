
-- Login attempts tracking
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_email ON public.login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_user ON public.login_attempts(user_id, created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view login attempts"
ON public.login_attempts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Security alerts
CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL, -- suspicious_login, brute_force, critical_change, system_error
  severity text NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  title text NOT NULL,
  description text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_alerts_unread ON public.security_alerts(is_read, created_at DESC);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage security alerts"
ON public.security_alerts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Active sessions tracking
CREATE TABLE public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_info text,
  ip_address text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sessions, owners see all"
ON public.active_sessions FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'owner')
);

CREATE POLICY "Users manage own sessions"
ON public.active_sessions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Soft delete: add deleted_at to key tables
ALTER TABLE public.valuation_assignments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Function to detect brute force and create alert
CREATE OR REPLACE FUNCTION public.check_brute_force()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_failures integer;
BEGIN
  IF NEW.success = false THEN
    SELECT COUNT(*) INTO recent_failures
    FROM public.login_attempts
    WHERE email = NEW.email
      AND success = false
      AND created_at > now() - interval '15 minutes';

    IF recent_failures >= 5 THEN
      INSERT INTO public.security_alerts (alert_type, severity, title, description, metadata)
      VALUES (
        'brute_force',
        'high',
        'محاولات دخول متكررة فاشلة',
        'تم رصد ' || (recent_failures + 1) || ' محاولة فاشلة للبريد: ' || NEW.email,
        jsonb_build_object('email', NEW.email, 'ip', NEW.ip_address, 'attempts', recent_failures + 1)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_brute_force
AFTER INSERT ON public.login_attempts
FOR EACH ROW
EXECUTE FUNCTION public.check_brute_force();
