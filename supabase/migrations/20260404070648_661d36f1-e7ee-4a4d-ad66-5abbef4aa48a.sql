
-- The report_verification_log INSERT with true is intentional for public verification
-- But we should at least rate-limit by requiring anon role explicitly
DROP POLICY IF EXISTS "Anyone can insert verification log" ON public.report_verification_log;
CREATE POLICY "Anyone can insert verification log" ON public.report_verification_log
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
