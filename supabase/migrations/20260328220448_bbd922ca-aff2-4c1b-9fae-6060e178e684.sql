
-- Fix overly permissive INSERT policy on payment_webhook_logs
DROP POLICY "Service insert webhook logs" ON public.payment_webhook_logs;

-- Only admins and authenticated users creating related payments can insert logs
CREATE POLICY "Authenticated insert webhook logs" ON public.payment_webhook_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'firm_admin'::app_role) OR
    payment_id IN (
      SELECT p.id FROM public.payments p
      JOIN public.valuation_requests vr ON p.request_id = vr.id
      WHERE vr.client_user_id = auth.uid()
    )
  );
