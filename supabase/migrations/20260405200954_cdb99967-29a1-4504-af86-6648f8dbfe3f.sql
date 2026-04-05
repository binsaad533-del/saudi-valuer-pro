
-- Payment gateway settings table
CREATE TABLE IF NOT EXISTS public.payment_gateway_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'hyperpay',
  is_active boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'test',
  entity_id text,
  entity_id_mada text,
  entity_id_applepay text,
  access_token text,
  enabled_methods text[] NOT NULL DEFAULT ARRAY['mada','visa','mastercard'],
  callback_url text,
  return_url text,
  failure_url text,
  webhook_secret text,
  configuration jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.payment_gateway_settings (provider, is_active, environment)
VALUES ('hyperpay', false, 'test')
ON CONFLICT DO NOTHING;

-- Add HyperPay checkout ID to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS hyperpay_checkout_id text;

-- RLS
ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view gateway settings"
  ON public.payment_gateway_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update gateway settings"
  ON public.payment_gateway_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert gateway settings"
  ON public.payment_gateway_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Updated_at trigger
CREATE TRIGGER update_payment_gateway_settings_updated_at
  BEFORE UPDATE ON public.payment_gateway_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
