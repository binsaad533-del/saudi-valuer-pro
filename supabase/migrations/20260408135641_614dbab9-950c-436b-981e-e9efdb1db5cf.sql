-- Drop the unique constraint first
ALTER TABLE public.raqeem_agent_context DROP CONSTRAINT IF EXISTS raqeem_agent_context_assignment_id_key;

-- Change assignment_id from uuid to text
ALTER TABLE public.raqeem_agent_context ALTER COLUMN assignment_id TYPE text USING assignment_id::text;

-- Re-add unique constraint
ALTER TABLE public.raqeem_agent_context ADD CONSTRAINT raqeem_agent_context_assignment_id_key UNIQUE (assignment_id);