
-- System events table for all monitoring data
CREATE TABLE public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb DEFAULT '{}'::jsonb,
  related_entity_id text,
  related_entity_type text,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- System health checks table
CREATE TABLE public.system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text NOT NULL,
  status text NOT NULL DEFAULT 'healthy',
  response_time_ms integer,
  details jsonb DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_system_events_category ON public.system_events(category);
CREATE INDEX idx_system_events_severity ON public.system_events(severity);
CREATE INDEX idx_system_events_created ON public.system_events(created_at DESC);
CREATE INDEX idx_system_events_resolved ON public.system_events(resolved);
CREATE INDEX idx_health_checks_type ON public.system_health_checks(check_type);
CREATE INDEX idx_health_checks_checked ON public.system_health_checks(checked_at DESC);

-- RLS
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

-- Only owner can view system events
CREATE POLICY "Owner can view system events"
  ON public.system_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can insert system events"
  ON public.system_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can update system events"
  ON public.system_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can view health checks"
  ON public.system_health_checks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can insert health checks"
  ON public.system_health_checks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Allow service role (edge functions) to insert
CREATE POLICY "Service can insert system events"
  ON public.system_events FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can insert health checks"
  ON public.system_health_checks FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can select health checks"
  ON public.system_health_checks FOR SELECT TO service_role
  USING (true);
