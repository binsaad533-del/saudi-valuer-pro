
-- Raqeem Agent Context: persistent memory per assignment across workflow stages
CREATE TABLE public.raqeem_agent_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL,
  stage TEXT NOT NULL DEFAULT 'intake',
  context_data JSONB NOT NULL DEFAULT '{}',
  observations TEXT[] DEFAULT '{}',
  pending_actions TEXT[] DEFAULT '{}',
  risk_flags TEXT[] DEFAULT '{}',
  last_insight TEXT,
  conversation_summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, stage)
);

-- Enable RLS
ALTER TABLE public.raqeem_agent_context ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write (admin users manage assignments)
CREATE POLICY "Authenticated users can read agent context"
  ON public.raqeem_agent_context FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert agent context"
  ON public.raqeem_agent_context FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update agent context"
  ON public.raqeem_agent_context FOR UPDATE
  TO authenticated USING (true);

-- Index for fast lookups
CREATE INDEX idx_raqeem_agent_context_assignment ON public.raqeem_agent_context(assignment_id);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.raqeem_agent_context;
