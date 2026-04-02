
-- Create archived_reports table
CREATE TABLE public.archived_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID REFERENCES public.clients(id),
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  report_number TEXT,
  report_title_ar TEXT,
  report_title_en TEXT,
  report_type TEXT DEFAULT 'real_estate',
  report_date DATE,
  property_type TEXT,
  property_city_ar TEXT,
  property_district_ar TEXT,
  property_address_ar TEXT,
  client_name_ar TEXT,
  ai_extracted_data JSONB DEFAULT '{}'::jsonb,
  ai_confidence NUMERIC DEFAULT 0,
  is_indexed BOOLEAN DEFAULT false,
  notes TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.archived_reports ENABLE ROW LEVEL SECURITY;

-- Org members (owner + coordinator) can manage
CREATE POLICY "Admins manage archived reports"
  ON public.archived_reports FOR ALL
  TO authenticated
  USING (
    (organization_id = get_user_org_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  )
  WITH CHECK (
    (organization_id = get_user_org_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  );

-- Clients can view reports linked to them
CREATE POLICY "Clients view their archived reports"
  ON public.archived_reports FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('archived-reports', 'archived-reports', false);

-- Storage policies
CREATE POLICY "Admins upload archived reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'archived-reports' 
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  );

CREATE POLICY "Admins read archived reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'archived-reports' 
    AND (
      has_role(auth.uid(), 'owner'::app_role) 
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR auth.uid() IN (
        SELECT u.id FROM auth.users u
        JOIN public.clients c ON c.email = u.email
        JOIN public.archived_reports ar ON ar.client_id = c.id
        WHERE ar.file_path LIKE '%' || name
      )
    )
  );

CREATE POLICY "Admins delete archived reports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'archived-reports' 
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  );

-- Updated_at trigger
CREATE TRIGGER update_archived_reports_updated_at
  BEFORE UPDATE ON public.archived_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
