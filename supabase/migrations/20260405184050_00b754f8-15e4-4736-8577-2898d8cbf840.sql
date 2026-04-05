CREATE TABLE public.knowledge_rebuild_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  total_documents integer NOT NULL DEFAULT 0,
  processed_documents integer NOT NULL DEFAULT 0,
  total_rules_extracted integer NOT NULL DEFAULT 0,
  total_rules_inserted integer NOT NULL DEFAULT 0,
  duplicates_removed integer NOT NULL DEFAULT 0,
  critical_rules integer NOT NULL DEFAULT 0,
  warning_rules integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT 'system'
);

ALTER TABLE public.knowledge_rebuild_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rebuild jobs"
ON public.knowledge_rebuild_jobs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert rebuild jobs"
ON public.knowledge_rebuild_jobs FOR INSERT TO authenticated
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_rebuild_jobs;