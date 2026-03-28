
-- Add status tracking to inspections (richer than boolean completed)
ALTER TABLE public.inspections 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'assigned',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gps_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_saved_data jsonb;

-- Inspection checklist items
CREATE TABLE IF NOT EXISTS public.inspection_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  category text NOT NULL,
  label_ar text NOT NULL,
  label_en text,
  is_checked boolean DEFAULT false,
  is_required boolean DEFAULT true,
  value text,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access checklist via inspection"
  ON public.inspection_checklist_items FOR ALL TO authenticated
  USING (
    inspection_id IN (
      SELECT i.id FROM inspections i
      JOIN valuation_assignments a ON i.assignment_id = a.id
      WHERE a.organization_id = get_user_org_id(auth.uid())
    )
    OR inspection_id IN (
      SELECT id FROM inspections WHERE inspector_id = auth.uid()
    )
  );

-- Inspection photos table
CREATE TABLE IF NOT EXISTS public.inspection_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  category text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  caption_ar text,
  caption_en text,
  latitude numeric,
  longitude numeric,
  taken_at timestamptz DEFAULT now(),
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access photos via inspection"
  ON public.inspection_photos FOR ALL TO authenticated
  USING (
    inspection_id IN (
      SELECT i.id FROM inspections i
      JOIN valuation_assignments a ON i.assignment_id = a.id
      WHERE a.organization_id = get_user_org_id(auth.uid())
    )
    OR inspection_id IN (
      SELECT id FROM inspections WHERE inspector_id = auth.uid()
    )
  );

-- Storage bucket for inspection photos
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Inspectors upload photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inspection-photos');

CREATE POLICY "Authenticated read inspection photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'inspection-photos');
