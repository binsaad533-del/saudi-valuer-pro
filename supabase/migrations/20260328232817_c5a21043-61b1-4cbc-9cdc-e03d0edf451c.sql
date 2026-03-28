
-- Portfolio assets table
CREATE TABLE IF NOT EXISTS public.portfolio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.valuation_requests(id) ON DELETE CASCADE,
  asset_type text NOT NULL DEFAULT 'real_estate',
  asset_category text NOT NULL DEFAULT 'land',
  asset_name_ar text NOT NULL,
  asset_name_en text,
  city_ar text,
  city_en text,
  district_ar text,
  district_en text,
  address_ar text,
  address_en text,
  land_area numeric,
  building_area numeric,
  description_ar text,
  description_en text,
  attributes jsonb DEFAULT '{}',
  ai_extracted boolean DEFAULT false,
  ai_confidence numeric,
  status text DEFAULT 'pending',
  assignment_id uuid,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients access own portfolio assets"
  ON public.portfolio_assets
  FOR ALL
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM public.valuation_requests
      WHERE client_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'firm_admin')
    OR has_role(auth.uid(), 'valuer')
  );

-- Add portfolio fields to valuation_requests
ALTER TABLE public.valuation_requests
  ADD COLUMN IF NOT EXISTS is_portfolio boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS portfolio_asset_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portfolio_discount_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portfolio_scope_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS portfolio_scope_ar text,
  ADD COLUMN IF NOT EXISTS portfolio_scope_en text;
