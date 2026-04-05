
-- Enhance discount_codes table
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'percentage';
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS fixed_amount numeric DEFAULT 0;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS min_order_amount numeric DEFAULT 0;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS max_uses_per_client integer DEFAULT NULL;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS applicable_services text[] DEFAULT NULL;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) DEFAULT NULL;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS first_time_only boolean DEFAULT false;

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  assignment_id uuid REFERENCES public.valuation_assignments(id),
  client_id uuid REFERENCES public.clients(id),
  organization_id uuid REFERENCES public.organizations(id),
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_code_id uuid REFERENCES public.discount_codes(id),
  vat_percentage numeric NOT NULL DEFAULT 15,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  payment_status text NOT NULL DEFAULT 'draft',
  due_date date,
  paid_at timestamptz,
  sent_at timestamptz,
  notes_ar text,
  notes_en text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Auto-generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_prefix TEXT;
  next_seq INTEGER;
BEGIN
  year_prefix := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1 INTO next_seq
  FROM public.invoices
  WHERE invoice_number LIKE 'INV-' || year_prefix || '-%';
  NEW.invoice_number := 'INV-' || year_prefix || '-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_number ON public.invoices;
CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.generate_invoice_number();

-- Pricing rules table
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL UNIQUE,
  label_ar text NOT NULL,
  label_en text,
  base_fee numeric NOT NULL DEFAULT 3500,
  inspection_fee numeric NOT NULL DEFAULT 500,
  complexity_multiplier numeric NOT NULL DEFAULT 1.0,
  income_analysis_fee numeric NOT NULL DEFAULT 0,
  description_ar text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- Commercial settings (single row)
CREATE TABLE IF NOT EXISTS public.commercial_settings (
  id integer PRIMARY KEY DEFAULT 1,
  report_release_policy text NOT NULL DEFAULT 'anytime',
  vat_percentage numeric NOT NULL DEFAULT 15,
  allow_partial_payment boolean NOT NULL DEFAULT false,
  default_payment_terms_ar text DEFAULT 'الدفع مطلوب خلال 7 أيام من تاريخ إصدار عرض السعر',
  default_validity_days integer NOT NULL DEFAULT 14,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.commercial_settings ENABLE ROW LEVEL SECURITY;

-- Discount usage log
CREATE TABLE IF NOT EXISTS public.discount_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id),
  client_id uuid REFERENCES public.clients(id),
  assignment_id uuid REFERENCES public.valuation_assignments(id),
  discount_applied numeric NOT NULL DEFAULT 0,
  used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_usage_log ENABLE ROW LEVEL SECURITY;

-- Insert default pricing rules
INSERT INTO public.pricing_rules (service_type, label_ar, label_en, base_fee, inspection_fee, income_analysis_fee)
VALUES
  ('real_estate', 'تقييم عقاري', 'Real Estate Valuation', 3500, 500, 1000),
  ('machinery', 'تقييم آلات ومعدات', 'Machinery & Equipment', 4000, 750, 0),
  ('mixed', 'تقييم مختلط', 'Mixed Valuation', 5000, 750, 1000),
  ('revaluation', 'إعادة تقييم', 'Revaluation', 2000, 0, 0),
  ('report_copy', 'نسخة تقرير / تحديث', 'Report Copy / Update', 500, 0, 0)
ON CONFLICT (service_type) DO NOTHING;

-- Insert default commercial settings
INSERT INTO public.commercial_settings (id, report_release_policy, vat_percentage)
VALUES (1, 'anytime', 15)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for invoices
CREATE POLICY "Owner and financial can manage invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'financial_manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

-- RLS for pricing_rules
CREATE POLICY "Anyone authenticated can view pricing rules"
  ON public.pricing_rules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owner can manage pricing rules"
  ON public.pricing_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- RLS for commercial_settings
CREATE POLICY "Anyone authenticated can view commercial settings"
  ON public.commercial_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owner can manage commercial settings"
  ON public.commercial_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- RLS for discount_usage_log
CREATE POLICY "Owner can view discount usage"
  ON public.discount_usage_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Authenticated can insert discount usage"
  ON public.discount_usage_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- Validate discount code function
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  _code text,
  _client_id uuid DEFAULT NULL,
  _service_type text DEFAULT NULL,
  _order_amount numeric DEFAULT 0
)
RETURNS TABLE(
  is_valid boolean,
  discount_id uuid,
  discount_type text,
  discount_value numeric,
  calculated_discount numeric,
  rejection_reason text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dc record;
  _client_usage integer;
  _is_first_time boolean;
BEGIN
  -- Find the code
  SELECT * INTO _dc FROM public.discount_codes WHERE code = UPPER(_code) LIMIT 1;
  
  IF _dc IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::numeric, 0::numeric, 'كود الخصم غير موجود'::text;
    RETURN;
  END IF;

  IF NOT _dc.is_active THEN
    RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'كود الخصم غير نشط'::text;
    RETURN;
  END IF;

  IF _dc.expires_at IS NOT NULL AND _dc.expires_at < now() THEN
    RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'كود الخصم منتهي الصلاحية'::text;
    RETURN;
  END IF;

  IF _dc.max_uses IS NOT NULL AND _dc.current_uses >= _dc.max_uses THEN
    RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'تم استنفاد عدد الاستخدامات المسموحة'::text;
    RETURN;
  END IF;

  -- Per-client usage check
  IF _dc.max_uses_per_client IS NOT NULL AND _client_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _client_usage FROM public.discount_usage_log
    WHERE discount_code_id = _dc.id AND client_id = _client_id;
    IF _client_usage >= _dc.max_uses_per_client THEN
      RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'تم تجاوز حد الاستخدام لهذا العميل'::text;
      RETURN;
    END IF;
  END IF;

  -- Client restriction
  IF _dc.client_id IS NOT NULL AND _dc.client_id != _client_id THEN
    RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'كود الخصم مخصص لعميل آخر'::text;
    RETURN;
  END IF;

  -- Service restriction
  IF _dc.applicable_services IS NOT NULL AND array_length(_dc.applicable_services, 1) > 0 THEN
    IF _service_type IS NULL OR NOT (_service_type = ANY(_dc.applicable_services)) THEN
      RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'كود الخصم لا ينطبق على هذه الخدمة'::text;
      RETURN;
    END IF;
  END IF;

  -- Min order amount
  IF _dc.min_order_amount > 0 AND _order_amount < _dc.min_order_amount THEN
    RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 
      'الحد الأدنى للطلب هو ' || _dc.min_order_amount || ' ر.س'::text;
    RETURN;
  END IF;

  -- First-time client check
  IF _dc.first_time_only AND _client_id IS NOT NULL THEN
    SELECT NOT EXISTS(
      SELECT 1 FROM public.valuation_assignments
      WHERE client_id = _client_id AND status NOT IN ('new','cancelled')
      LIMIT 1
    ) INTO _is_first_time;
    IF NOT _is_first_time THEN
      RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'كود الخصم للعملاء الجدد فقط'::text;
      RETURN;
    END IF;
  END IF;

  -- Calculate discount
  IF _dc.discount_type = 'fixed_amount' THEN
    RETURN QUERY SELECT true, _dc.id, 'fixed_amount'::text, _dc.fixed_amount, 
      LEAST(_dc.fixed_amount, _order_amount), NULL::text;
  ELSE
    RETURN QUERY SELECT true, _dc.id, 'percentage'::text, _dc.discount_percentage, 
      ROUND(_order_amount * _dc.discount_percentage / 100, 2), NULL::text;
  END IF;
END;
$$;
