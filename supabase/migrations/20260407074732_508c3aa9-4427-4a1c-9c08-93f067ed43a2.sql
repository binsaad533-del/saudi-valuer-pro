
-- Add new SOW workflow statuses
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'sow_generated';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'sow_sent';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'sow_approved';

-- Add inspection_type and SOW signing columns
ALTER TABLE public.valuation_requests
  ADD COLUMN IF NOT EXISTS inspection_type text DEFAULT 'field',
  ADD COLUMN IF NOT EXISTS sow_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sow_assumptions_ar text,
  ADD COLUMN IF NOT EXISTS sow_special_assumptions_ar text,
  ADD COLUMN IF NOT EXISTS conflict_of_interest_checked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS conflict_of_interest_result text;
