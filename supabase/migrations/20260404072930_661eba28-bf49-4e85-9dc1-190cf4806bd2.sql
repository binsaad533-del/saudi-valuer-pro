
-- Add valuation_mode to valuation_requests
ALTER TABLE public.valuation_requests 
ADD COLUMN IF NOT EXISTS valuation_mode text NOT NULL DEFAULT 'field';

-- Add valuation_mode to valuation_assignments  
ALTER TABLE public.valuation_assignments
ADD COLUMN IF NOT EXISTS valuation_mode text NOT NULL DEFAULT 'field';

-- Add desktop_disclaimer_accepted to valuation_requests (client acknowledgment)
ALTER TABLE public.valuation_requests
ADD COLUMN IF NOT EXISTS desktop_disclaimer_accepted boolean DEFAULT false;

-- Add desktop_evidence_notes to valuation_assignments (evaluator's evidence justification)
ALTER TABLE public.valuation_assignments
ADD COLUMN IF NOT EXISTS desktop_evidence_notes text;
