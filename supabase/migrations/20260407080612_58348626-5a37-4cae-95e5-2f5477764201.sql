
ALTER TABLE public.report_drafts 
  ADD COLUMN IF NOT EXISTS client_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_comments text;
