-- Add professional_judgment column to valuation_requests
ALTER TABLE public.valuation_requests 
ADD COLUMN IF NOT EXISTS professional_judgment jsonb DEFAULT NULL;