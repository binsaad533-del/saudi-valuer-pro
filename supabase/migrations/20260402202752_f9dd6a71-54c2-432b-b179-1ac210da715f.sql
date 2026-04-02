
DROP POLICY "Owners can manage discount codes" ON public.discount_codes;

CREATE POLICY "Owners can manage discount codes"
  ON public.discount_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner')
  );
