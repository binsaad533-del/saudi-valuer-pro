
-- Drop overly permissive policy
DROP POLICY IF EXISTS "Service can manage memory" ON public.raqeem_client_memory;

-- More restrictive: authenticated users can only insert/update their own
CREATE POLICY "Users can insert own memory"
  ON public.raqeem_client_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_user_id);

CREATE POLICY "Users can update own memory"
  ON public.raqeem_client_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_user_id);
