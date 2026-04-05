
-- Asset edit audit log for traceability
CREATE TABLE IF NOT EXISTS public.asset_edit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.extracted_assets(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.processing_jobs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_edit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own edit logs"
  ON public.asset_edit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own edit logs"
  ON public.asset_edit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Add request_id index on processing_jobs if not exists
CREATE INDEX IF NOT EXISTS idx_processing_jobs_request_id ON public.processing_jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id ON public.processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_extracted_assets_job_id ON public.extracted_assets(job_id);
CREATE INDEX IF NOT EXISTS idx_file_classifications_job_id ON public.file_classifications(job_id);
CREATE INDEX IF NOT EXISTS idx_asset_edit_logs_asset_id ON public.asset_edit_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_edit_logs_job_id ON public.asset_edit_logs(job_id);
