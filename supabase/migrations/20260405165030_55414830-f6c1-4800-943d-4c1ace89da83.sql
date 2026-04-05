
-- Processing Jobs table
CREATE TABLE public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','uploading','classifying','extracting','deduplicating','merging','ready','failed','cancelled')),
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  total_assets_found INTEGER NOT NULL DEFAULT 0,
  duplicates_found INTEGER NOT NULL DEFAULT 0,
  low_confidence_count INTEGER NOT NULL DEFAULT 0,
  missing_fields_count INTEGER NOT NULL DEFAULT 0,
  current_message TEXT,
  error_message TEXT,
  file_manifest JSONB DEFAULT '[]'::jsonb,
  processing_log JSONB DEFAULT '[]'::jsonb,
  discipline TEXT DEFAULT 'real_estate',
  description TEXT,
  ai_summary JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extracted Assets table
CREATE TABLE public.extracted_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.processing_jobs(id) ON DELETE CASCADE NOT NULL,
  asset_index INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'real_estate' CHECK (asset_type IN ('real_estate','machinery_equipment')),
  category TEXT,
  subcategory TEXT,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT DEFAULT 'unknown',
  confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  asset_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_files JSONB DEFAULT '[]'::jsonb,
  source_evidence TEXT,
  duplicate_group TEXT,
  duplicate_status TEXT DEFAULT 'unique' CHECK (duplicate_status IN ('unique','potential_duplicate','confirmed_duplicate','merged')),
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending','approved','needs_review','rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  missing_fields TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- File Classifications table
CREATE TABLE public.file_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.processing_jobs(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  document_category TEXT NOT NULL DEFAULT 'other',
  document_purpose TEXT,
  language TEXT DEFAULT 'ar',
  relevance TEXT DEFAULT 'medium' CHECK (relevance IN ('high','medium','low')),
  contains_assets BOOLEAN DEFAULT false,
  extracted_info TEXT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending','processing','completed','failed','skipped')),
  error_message TEXT,
  confidence INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_processing_jobs_user ON public.processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_status ON public.processing_jobs(status);
CREATE INDEX idx_extracted_assets_job ON public.extracted_assets(job_id);
CREATE INDEX idx_extracted_assets_review ON public.extracted_assets(review_status);
CREATE INDEX idx_extracted_assets_duplicate ON public.extracted_assets(duplicate_status);
CREATE INDEX idx_file_classifications_job ON public.file_classifications(job_id);

-- Updated_at triggers
CREATE TRIGGER update_processing_jobs_updated_at BEFORE UPDATE ON public.processing_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_extracted_assets_updated_at BEFORE UPDATE ON public.extracted_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_classifications ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see own jobs, admins can see all
CREATE POLICY "Users view own processing jobs" ON public.processing_jobs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'));
CREATE POLICY "Users create own processing jobs" ON public.processing_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own processing jobs" ON public.processing_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'));

-- RLS: Assets follow job ownership
CREATE POLICY "Users view own extracted assets" ON public.extracted_assets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));
CREATE POLICY "Users insert own extracted assets" ON public.extracted_assets FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));
CREATE POLICY "Users update own extracted assets" ON public.extracted_assets FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));
CREATE POLICY "Users delete own extracted assets" ON public.extracted_assets FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));

-- RLS: File classifications follow job ownership
CREATE POLICY "Users view own file classifications" ON public.file_classifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));
CREATE POLICY "Users insert own file classifications" ON public.file_classifications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));
CREATE POLICY "Users update own file classifications" ON public.file_classifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));

-- Enable realtime for processing jobs (for live status tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE public.processing_jobs;
