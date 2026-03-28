
-- Report revision comments table
CREATE TABLE public.report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.valuation_requests(id),
  assignment_id uuid REFERENCES public.valuation_assignments(id),
  author_id uuid,
  author_type text NOT NULL DEFAULT 'client' CHECK (author_type IN ('client', 'admin', 'valuer', 'reviewer', 'system')),
  section_key text,
  comment_text text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  report_version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;

-- Clients can view/create comments on their own requests
CREATE POLICY "Clients access own report comments" ON public.report_comments
  FOR ALL TO authenticated
  USING (
    request_id IN (SELECT id FROM valuation_requests WHERE client_user_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'firm_admin')
    OR has_role(auth.uid(), 'valuer')
    OR has_role(auth.uid(), 'reviewer')
  );

-- Report change log table
CREATE TABLE public.report_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  version_from integer NOT NULL,
  version_to integer NOT NULL,
  change_type text NOT NULL DEFAULT 'revision' CHECK (change_type IN ('revision', 'client_comment', 'internal_correction', 'post_issuance_correction', 'addendum')),
  changed_by uuid,
  change_summary_ar text,
  change_summary_en text,
  related_comment_id uuid REFERENCES public.report_comments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access report change log" ON public.report_change_log
  FOR ALL TO authenticated
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      JOIN valuation_assignments a ON r.assignment_id = a.id
      WHERE a.organization_id = get_user_org_id(auth.uid())
    )
    OR report_id IN (
      SELECT r.id FROM reports r
      JOIN valuation_assignments a ON r.assignment_id = a.id
      JOIN valuation_requests vr ON vr.assignment_id = a.id
      WHERE vr.client_user_id = auth.uid()
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_report_comments_updated_at
  BEFORE UPDATE ON public.report_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
