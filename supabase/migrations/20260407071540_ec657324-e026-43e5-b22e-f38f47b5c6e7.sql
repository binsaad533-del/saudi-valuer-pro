
CREATE TABLE public.report_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.valuation_requests(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('generating', 'draft', 'reviewed', 'approved', 'rejected')),
  sections JSONB NOT NULL DEFAULT '{}',
  raw_content TEXT,
  ai_model TEXT,
  generation_mode TEXT DEFAULT 'structured_sections',
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can manage report drafts"
  ON public.report_drafts FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'admin_coordinator')
  );

CREATE POLICY "Clients can view their own report drafts"
  ON public.report_drafts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.valuation_requests vr
      WHERE vr.id = report_drafts.request_id
      AND vr.client_user_id = auth.uid()
    )
  );

CREATE TRIGGER update_report_drafts_updated_at
  BEFORE UPDATE ON public.report_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
