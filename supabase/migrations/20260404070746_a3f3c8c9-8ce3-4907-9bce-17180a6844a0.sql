
-- 1. Fix settings-uploads INSERT: restrict to admins
DROP POLICY IF EXISTS "Authenticated users can upload settings files" ON storage.objects;
CREATE POLICY "Admins upload settings files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'settings-uploads' AND (
      has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)
    )
  );

-- 2. Add DELETE policy for inspection-photos
CREATE POLICY "Admins or inspector delete inspection photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'inspection-photos' AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    )
  );
