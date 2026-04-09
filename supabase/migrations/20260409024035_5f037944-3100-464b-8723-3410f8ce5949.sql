
-- Client memory for Raqeem persistent intelligence
CREATE TABLE public.raqeem_client_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL,
  preferred_property_types TEXT[] DEFAULT '{}',
  preferred_cities TEXT[] DEFAULT '{}',
  communication_style TEXT DEFAULT 'balanced',
  total_requests INTEGER DEFAULT 0,
  completed_requests INTEGER DEFAULT 0,
  topics_of_interest TEXT[] DEFAULT '{}',
  last_interaction_summary TEXT,
  ai_notes TEXT,
  frequent_questions TEXT[] DEFAULT '{}',
  avg_response_satisfaction NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_user_id)
);

ALTER TABLE public.raqeem_client_memory ENABLE ROW LEVEL SECURITY;

-- Client can read their own memory
CREATE POLICY "Clients can view own memory"
  ON public.raqeem_client_memory FOR SELECT
  USING (auth.uid() = client_user_id);

-- Service role handles inserts/updates (via edge functions)
CREATE POLICY "Service can manage memory"
  ON public.raqeem_client_memory FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update timestamp
CREATE TRIGGER update_raqeem_client_memory_updated_at
  BEFORE UPDATE ON public.raqeem_client_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
