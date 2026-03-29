
-- Raqeem Knowledge Base: Admin-uploaded documents
CREATE TABLE public.raqeem_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  source_type text NOT NULL DEFAULT 'document',
  file_path text,
  file_name text,
  priority integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Raqeem Corrections: Admin corrections to AI responses
CREATE TABLE public.raqeem_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_question text NOT NULL,
  original_answer text NOT NULL,
  corrected_answer text NOT NULL,
  correction_reason text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  corrected_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Raqeem Rules: Admin-defined instructions and rules
CREATE TABLE public.raqeem_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_title_ar text NOT NULL,
  rule_title_en text,
  rule_content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Raqeem Audit Log: Track all knowledge changes
CREATE TABLE public.raqeem_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  details jsonb,
  performed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.raqeem_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raqeem_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raqeem_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raqeem_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can manage knowledge
CREATE POLICY "Admins manage raqeem knowledge" ON public.raqeem_knowledge
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Admins manage raqeem corrections" ON public.raqeem_corrections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Admins manage raqeem rules" ON public.raqeem_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Admins view raqeem audit" ON public.raqeem_audit_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- All authenticated users can read active knowledge (for chat context)
CREATE POLICY "Authenticated read active knowledge" ON public.raqeem_knowledge
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated read active corrections" ON public.raqeem_corrections
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated read active rules" ON public.raqeem_rules
  FOR SELECT TO authenticated
  USING (is_active = true);
