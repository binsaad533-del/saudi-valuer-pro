
-- 1. Fix client-uploads INSERT: scope to user's own folder
DROP POLICY IF EXISTS "Clients can upload files" ON storage.objects;
CREATE POLICY "Clients can upload files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-uploads' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Fix attachments/signatures INSERT: restrict to admin/inspector roles
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Staff can upload attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('attachments', 'signatures') AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    )
  );

-- 3. Fix inspection-photos INSERT: restrict to inspectors
DROP POLICY IF EXISTS "Inspectors upload photos" ON storage.objects;
CREATE POLICY "Inspectors upload photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos' AND has_role(auth.uid(), 'inspector'::app_role)
  );

-- 4. Fix settings-uploads UPDATE/DELETE: restrict to admins
DROP POLICY IF EXISTS "Users can delete own settings files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own settings files" ON storage.objects;
CREATE POLICY "Admins manage settings files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'settings-uploads' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)))
  WITH CHECK (bucket_id = 'settings-uploads' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)));

CREATE POLICY "Admins delete settings files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'settings-uploads' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)));

-- 5. Remove anonymous access to raqeem tables
DROP POLICY IF EXISTS "Anon read raqeem knowledge" ON public.raqeem_knowledge;
DROP POLICY IF EXISTS "Anon read raqeem rules" ON public.raqeem_rules;
DROP POLICY IF EXISTS "Anon read raqeem corrections" ON public.raqeem_corrections;

-- Add authenticated-only read policies for raqeem
CREATE POLICY "Authenticated read raqeem knowledge" ON public.raqeem_knowledge
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Authenticated read raqeem rules" ON public.raqeem_rules
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Authenticated read raqeem corrections" ON public.raqeem_corrections
  FOR SELECT TO authenticated USING (is_active = true);
