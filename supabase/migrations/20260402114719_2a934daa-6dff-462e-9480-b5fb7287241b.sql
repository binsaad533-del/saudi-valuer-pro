
-- Add taqeem_machinery field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS taqeem_membership_machinery text;

-- Create organization_settings table for report/system/integration settings
CREATE TABLE public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(organization_id, category)
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Owner/admin can read their org settings
CREATE POLICY "Users can read own org settings" ON public.organization_settings
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Owner can write org settings
CREATE POLICY "Owner can manage org settings" ON public.organization_settings
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND public.has_role(auth.uid(), 'owner')
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND public.has_role(auth.uid(), 'owner')
);

-- Create storage bucket for settings uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('settings-uploads', 'settings-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to settings-uploads
CREATE POLICY "Authenticated users can upload settings files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'settings-uploads');

CREATE POLICY "Anyone can view settings files" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'settings-uploads');

CREATE POLICY "Users can update own settings files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'settings-uploads');

CREATE POLICY "Users can delete own settings files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'settings-uploads');
