DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own role" ON public.user_roles;

CREATE POLICY "Users and coordinators view roles" ON public.user_roles
FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'owner'::app_role)
  OR has_role(auth.uid(), 'admin_coordinator'::app_role)
);