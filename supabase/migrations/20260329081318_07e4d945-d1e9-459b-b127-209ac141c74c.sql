
-- Drop restrictive admin-only policies on raqeem tables
DROP POLICY IF EXISTS "Admins manage raqeem rules" ON public.raqeem_rules;
DROP POLICY IF EXISTS "Authenticated read active rules" ON public.raqeem_rules;
DROP POLICY IF EXISTS "Admins manage raqeem corrections" ON public.raqeem_corrections;
DROP POLICY IF EXISTS "Authenticated read active corrections" ON public.raqeem_corrections;
DROP POLICY IF EXISTS "Admins manage raqeem knowledge" ON public.raqeem_knowledge;
DROP POLICY IF EXISTS "Authenticated read active knowledge" ON public.raqeem_knowledge;

-- Allow any authenticated user full access to raqeem tables
CREATE POLICY "Authenticated users manage raqeem rules"
  ON public.raqeem_rules FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users manage raqeem corrections"
  ON public.raqeem_corrections FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users manage raqeem knowledge"
  ON public.raqeem_knowledge FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Also allow anon SELECT so the edge function (raqeem-chat) can read
CREATE POLICY "Anon read raqeem rules"
  ON public.raqeem_rules FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Anon read raqeem corrections"
  ON public.raqeem_corrections FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Anon read raqeem knowledge"
  ON public.raqeem_knowledge FOR SELECT TO anon
  USING (is_active = true);
