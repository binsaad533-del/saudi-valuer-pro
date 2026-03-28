
-- Add payment structure columns to valuation_requests
ALTER TABLE public.valuation_requests 
  ADD COLUMN IF NOT EXISTS payment_structure text DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS first_payment_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS first_payment_percentage numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS draft_report_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS final_report_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quotation_approved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS production_started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;
