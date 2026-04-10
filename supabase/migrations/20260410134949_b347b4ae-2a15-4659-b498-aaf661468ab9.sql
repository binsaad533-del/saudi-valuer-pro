
-- Document Analysis Pipeline Results
CREATE TABLE public.document_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES public.valuation_requests(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES public.valuation_assignments(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id),
  analyzed_by UUID,
  
  -- Stage 1-3: Ingest/Classify/Extract
  source_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  file_classifications JSONB DEFAULT '[]'::jsonb,
  extracted_metrics JSONB DEFAULT '{}'::jsonb,
  
  -- Stage 4: Validate
  validation_results JSONB DEFAULT '{}'::jsonb,
  consistency_passed BOOLEAN DEFAULT false,
  anomalies JSONB DEFAULT '[]'::jsonb,
  
  -- Stage 5: Map to Valuation
  recommended_methodology TEXT,
  methodology_justification TEXT,
  methodology_mapping JSONB DEFAULT '{}'::jsonb,
  
  -- Stage 6: Compliance
  compliance_status JSONB DEFAULT '{}'::jsonb,
  ivs_alignment TEXT,
  taqeem_alignment TEXT,
  accounting_standards TEXT,
  
  -- Stage 7: Executive Synthesis
  executive_brief JSONB DEFAULT '{}'::jsonb,
  key_metrics JSONB DEFAULT '{}'::jsonb,
  
  -- Stage 8: Gaps
  identified_gaps JSONB DEFAULT '[]'::jsonb,
  gap_impact_summary TEXT,
  
  -- Stage 9: Recommendations
  recommendations JSONB DEFAULT '[]'::jsonb,
  required_decision TEXT,
  
  -- Meta
  pipeline_version TEXT DEFAULT 'v1',
  ai_model_used TEXT,
  processing_duration_ms INTEGER,
  confidence_score NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_document_analyses_assignment ON public.document_analyses(assignment_id);
CREATE INDEX idx_document_analyses_request ON public.document_analyses(request_id);

-- RLS
ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view analyses"
  ON public.document_analyses FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert analyses"
  ON public.document_analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_document_analyses_updated_at
  BEFORE UPDATE ON public.document_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
