DROP POLICY IF EXISTS "Admins manage archived reports" ON public.archived_reports;
DROP POLICY IF EXISTS "Clients view their archived reports" ON public.archived_reports;

CREATE POLICY "authenticated_select_archived_reports" ON public.archived_reports
FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_archived_reports" ON public.archived_reports
FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)
);

CREATE POLICY "authenticated_update_archived_reports" ON public.archived_reports
FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)
);

CREATE POLICY "authenticated_delete_archived_reports" ON public.archived_reports
FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)
);