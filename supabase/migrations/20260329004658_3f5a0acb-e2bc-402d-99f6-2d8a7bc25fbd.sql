
-- Test Sessions: Track AI test runs
CREATE TABLE public.raqeem_test_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL,
  test_type text NOT NULL DEFAULT 'accuracy',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_questions integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  accuracy_score numeric NOT NULL DEFAULT 0,
  notes text,
  tested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Performance snapshots for trend tracking
CREATE TABLE public.raqeem_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  total_corrections integer NOT NULL DEFAULT 0,
  total_knowledge_docs integer NOT NULL DEFAULT 0,
  total_rules integer NOT NULL DEFAULT 0,
  total_tests integer NOT NULL DEFAULT 0,
  avg_accuracy numeric NOT NULL DEFAULT 0,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add correction_type to corrections table
ALTER TABLE public.raqeem_corrections
  ADD COLUMN IF NOT EXISTS correction_type text DEFAULT 'reasoning';

-- Add file upload support columns to knowledge
ALTER TABLE public.raqeem_knowledge
  ADD COLUMN IF NOT EXISTS file_size integer,
  ADD COLUMN IF NOT EXISTS mime_type text;

-- Enable RLS
ALTER TABLE public.raqeem_test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raqeem_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins manage test sessions" ON public.raqeem_test_sessions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Admins manage performance snapshots" ON public.raqeem_performance_snapshots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));
