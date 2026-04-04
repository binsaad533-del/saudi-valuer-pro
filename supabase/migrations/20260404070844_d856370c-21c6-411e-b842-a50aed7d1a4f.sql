
-- 1. Allow clients to read their own reports
CREATE POLICY "Clients can view own reports" ON public.reports
  FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT vr.assignment_id FROM valuation_requests vr
      WHERE vr.client_user_id = auth.uid() AND vr.assignment_id IS NOT NULL
    )
  );

-- 2. Allow financial_manager to read client-uploads
DROP POLICY IF EXISTS "Users can view own uploads" ON storage.objects;
CREATE POLICY "Users can view own uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-uploads' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'financial_manager'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    )
  );

-- 3. Allow clients to download their report PDFs from storage
DROP POLICY IF EXISTS "Org members can view attachments" ON storage.objects;
CREATE POLICY "Org members and clients view attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    OR (bucket_id IN ('attachments', 'reports', 'signatures') AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'financial_manager'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    ))
    OR (bucket_id = 'reports' AND EXISTS (
      SELECT 1 FROM valuation_requests vr
      JOIN valuation_assignments va ON va.id = vr.assignment_id
      WHERE vr.client_user_id = auth.uid()
    ))
  );

-- 4. Allow clients to read attachments for their assignments
CREATE POLICY "Clients can view own attachments" ON public.attachments
  FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT vr.assignment_id FROM valuation_requests vr
      WHERE vr.client_user_id = auth.uid() AND vr.assignment_id IS NOT NULL
    )
  );
