
-- Create payments table for online payment tracking
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.valuation_requests(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.valuation_assignments(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  payment_stage text NOT NULL DEFAULT 'first' CHECK (payment_stage IN ('first', 'final', 'full')),
  payment_method text CHECK (payment_method IN ('mada', 'visa', 'mastercard', 'applepay', 'manual', NULL)),
  gateway_name text NOT NULL DEFAULT 'moyasar',
  transaction_id text,
  gateway_response_json jsonb,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'manual_review')),
  payment_reference text,
  checkout_url text,
  callback_url text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  notes text,
  is_mock boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Clients can view their own payments
CREATE POLICY "Clients view own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (
    request_id IN (
      SELECT id FROM public.valuation_requests WHERE client_user_id = auth.uid()
    )
  );

-- Clients can create payments for their requests
CREATE POLICY "Clients create payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    request_id IN (
      SELECT id FROM public.valuation_requests WHERE client_user_id = auth.uid()
    )
  );

-- Admins can do everything with payments
CREATE POLICY "Admins manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'firm_admin'::app_role)
  );

-- Create payment_webhook_logs table
CREATE TABLE public.payment_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id),
  event_type text NOT NULL,
  raw_payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processing_result text,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view webhook logs" ON public.payment_webhook_logs
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'firm_admin'::app_role)
  );

-- Allow edge functions to insert webhook logs (service role)
CREATE POLICY "Service insert webhook logs" ON public.payment_webhook_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime for payments
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
