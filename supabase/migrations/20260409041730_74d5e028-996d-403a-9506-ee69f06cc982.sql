
-- ============================================================
-- RAQEEM WATCHDOG: Omniscient Monitoring System
-- ============================================================

-- Enum for finding categories
CREATE TYPE public.watchdog_category AS ENUM (
  'technical', 'security', 'workflow', 'legal', 'financial', 'user_behavior', 'performance'
);

-- Enum for finding severity
CREATE TYPE public.watchdog_severity AS ENUM (
  'critical', 'high', 'medium', 'low', 'info'
);

-- Enum for finding status
CREATE TYPE public.watchdog_finding_status AS ENUM (
  'open', 'acknowledged', 'resolved', 'ignored', 'escalated'
);

-- Main findings table
CREATE TABLE public.raqeem_watchdog_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category watchdog_category NOT NULL,
  severity watchdog_severity NOT NULL DEFAULT 'medium',
  status watchdog_finding_status NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,
  details JSONB DEFAULT '{}',
  related_entity_type TEXT,
  related_entity_id TEXT,
  related_user_id UUID,
  fingerprint TEXT NOT NULL,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  detection_count INTEGER NOT NULL DEFAULT 1,
  auto_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on fingerprint to prevent duplicate findings
CREATE UNIQUE INDEX idx_watchdog_fingerprint ON public.raqeem_watchdog_findings (fingerprint) WHERE status NOT IN ('resolved', 'ignored');

-- Indexes for efficient querying
CREATE INDEX idx_watchdog_category ON public.raqeem_watchdog_findings (category);
CREATE INDEX idx_watchdog_severity ON public.raqeem_watchdog_findings (severity);
CREATE INDEX idx_watchdog_status ON public.raqeem_watchdog_findings (status);
CREATE INDEX idx_watchdog_last_detected ON public.raqeem_watchdog_findings (last_detected_at DESC);

-- Scan history table
CREATE TABLE public.raqeem_watchdog_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_type TEXT NOT NULL DEFAULT 'full',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  findings_created INTEGER DEFAULT 0,
  findings_updated INTEGER DEFAULT 0,
  findings_auto_resolved INTEGER DEFAULT 0,
  categories_scanned TEXT[] DEFAULT '{}',
  errors JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_watchdog_scans_started ON public.raqeem_watchdog_scans (started_at DESC);

-- Owner daily digest preferences
CREATE TABLE public.raqeem_watchdog_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  daily_digest_enabled BOOLEAN DEFAULT true,
  instant_alerts_enabled BOOLEAN DEFAULT true,
  alert_severity_threshold watchdog_severity DEFAULT 'high',
  categories_enabled watchdog_category[] DEFAULT ARRAY['technical','security','workflow','legal','financial','user_behavior','performance']::watchdog_category[],
  scan_interval_minutes INTEGER DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.raqeem_watchdog_settings (id) VALUES (1);

-- Enable RLS
ALTER TABLE public.raqeem_watchdog_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raqeem_watchdog_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raqeem_watchdog_settings ENABLE ROW LEVEL SECURITY;

-- RLS: Only owner/admin can view findings
CREATE POLICY "Owners can view watchdog findings"
ON public.raqeem_watchdog_findings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update watchdog findings"
ON public.raqeem_watchdog_findings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "System can insert watchdog findings"
ON public.raqeem_watchdog_findings FOR INSERT TO authenticated
WITH CHECK (true);

-- Scans
CREATE POLICY "Owners can view watchdog scans"
ON public.raqeem_watchdog_scans FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "System can insert watchdog scans"
ON public.raqeem_watchdog_scans FOR INSERT TO authenticated
WITH CHECK (true);

-- Settings
CREATE POLICY "Owners can view watchdog settings"
ON public.raqeem_watchdog_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update watchdog settings"
ON public.raqeem_watchdog_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Trigger for updated_at
CREATE TRIGGER update_watchdog_findings_updated_at
BEFORE UPDATE ON public.raqeem_watchdog_findings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_watchdog_settings_updated_at
BEFORE UPDATE ON public.raqeem_watchdog_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
