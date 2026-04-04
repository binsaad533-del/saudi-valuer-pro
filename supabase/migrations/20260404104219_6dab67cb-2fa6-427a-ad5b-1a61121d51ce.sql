ALTER TABLE public.valuation_requests
  ADD COLUMN IF NOT EXISTS discipline text DEFAULT 'real_estate',
  ADD COLUMN IF NOT EXISTS purpose_ar text,
  ADD COLUMN IF NOT EXISTS value_basis_ar text,
  ADD COLUMN IF NOT EXISTS valuation_date date,
  ADD COLUMN IF NOT EXISTS client_name_ar text,
  ADD COLUMN IF NOT EXISTS client_id_number text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS intended_user_ar text,
  ADD COLUMN IF NOT EXISTS asset_data jsonb;