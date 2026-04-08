-- Add missing columns that the code expects
ALTER TABLE public.raqeem_agent_context
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS confidence_score numeric,
  ADD COLUMN IF NOT EXISTS chat_history jsonb DEFAULT '[]'::jsonb;

-- Add unique constraint on assignment_id for upsert to work
ALTER TABLE public.raqeem_agent_context
  ADD CONSTRAINT raqeem_agent_context_assignment_id_key UNIQUE (assignment_id);