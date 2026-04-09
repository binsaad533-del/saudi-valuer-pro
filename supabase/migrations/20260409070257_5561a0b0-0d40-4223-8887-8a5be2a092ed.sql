
CREATE TABLE public.raqeem_tech_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('security', 'performance', 'automation', 'commerce', 'code_quality', 'database')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title TEXT NOT NULL,
  description TEXT,
  recommendation TEXT,
  auto_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  scan_type TEXT NOT NULL DEFAULT 'scheduled' CHECK (scan_type IN ('realtime', 'scheduled', 'manual')),
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.raqeem_tech_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view tech findings"
ON public.raqeem_tech_findings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update tech findings"
ON public.raqeem_tech_findings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE INDEX idx_tech_findings_category ON public.raqeem_tech_findings(category);
CREATE INDEX idx_tech_findings_severity ON public.raqeem_tech_findings(severity) WHERE is_active = true;
CREATE INDEX idx_tech_findings_active ON public.raqeem_tech_findings(is_active, created_at DESC);

CREATE TRIGGER update_raqeem_tech_findings_updated_at
  BEFORE UPDATE ON public.raqeem_tech_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.raqeem_system_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('edge_function', 'database', 'storage', 'auth', 'api', 'revenue')),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC,
  unit TEXT,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.raqeem_system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view system metrics"
ON public.raqeem_system_metrics FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE INDEX idx_system_metrics_type ON public.raqeem_system_metrics(metric_type, recorded_at DESC);
