
-- Expert findings table
CREATE TABLE public.raqeem_expert_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar TEXT NOT NULL CHECK (pillar IN ('architecture','workflow','performance','security','reporting')),
  severity TEXT NOT NULL CHECK (severity IN ('critical','warning','info','healthy')),
  title_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  fix_suggestion_ar TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','fixed','ignored')),
  file_path TEXT,
  code_snippet TEXT,
  metadata JSONB DEFAULT '{}',
  scan_batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.raqeem_expert_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view expert findings"
ON public.raqeem_expert_findings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update expert findings"
ON public.raqeem_expert_findings FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Service can insert expert findings"
ON public.raqeem_expert_findings FOR INSERT TO authenticated WITH CHECK (true);

-- Expert scans tracking table
CREATE TABLE public.raqeem_expert_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type TEXT NOT NULL DEFAULT 'full',
  total_findings INT DEFAULT 0,
  critical_count INT DEFAULT 0,
  warning_count INT DEFAULT 0,
  info_count INT DEFAULT 0,
  healthy_count INT DEFAULT 0,
  health_score NUMERIC(5,2) DEFAULT 0,
  duration_ms INT DEFAULT 0,
  triggered_by TEXT DEFAULT 'manual',
  summary_ar TEXT,
  pillar_scores JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.raqeem_expert_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view expert scans"
ON public.raqeem_expert_scans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service can insert expert scans"
ON public.raqeem_expert_scans FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX idx_expert_findings_pillar ON public.raqeem_expert_findings(pillar);
CREATE INDEX idx_expert_findings_severity ON public.raqeem_expert_findings(severity);
CREATE INDEX idx_expert_findings_status ON public.raqeem_expert_findings(status);
CREATE INDEX idx_expert_findings_batch ON public.raqeem_expert_findings(scan_batch_id);
CREATE INDEX idx_expert_scans_created ON public.raqeem_expert_scans(created_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_expert_findings_updated_at
BEFORE UPDATE ON public.raqeem_expert_findings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
