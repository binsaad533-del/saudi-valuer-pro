
-- Add client_id column to valuation_requests
ALTER TABLE public.valuation_requests 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_valuation_requests_client_id ON public.valuation_requests(client_id);

-- Backfill: Create client records from existing requests that have client_name_ar
-- First insert unique clients
INSERT INTO public.clients (name_ar, phone, email, organization_id, client_type, client_status)
SELECT DISTINCT ON (COALESCE(vr.client_name_ar, p.full_name_ar, p.phone))
  COALESCE(vr.client_name_ar, p.full_name_ar, p.phone, 'عميل غير معرف') as name_ar,
  COALESCE(NULLIF(vr.client_phone, ''), p.phone) as phone,
  COALESCE(NULLIF(vr.client_email, ''), p.email) as email,
  '52bbe5b4-9de2-4a8d-a156-cbfebed01686'::uuid as organization_id,
  'individual' as client_type,
  'potential' as client_status
FROM public.valuation_requests vr
LEFT JOIN public.profiles p ON vr.client_user_id = p.user_id
WHERE vr.client_id IS NULL;

-- Now link requests to their clients by matching name/phone
UPDATE public.valuation_requests vr
SET client_id = c.id
FROM public.clients c
WHERE vr.client_id IS NULL
  AND (
    (vr.client_name_ar IS NOT NULL AND vr.client_name_ar != '' AND c.name_ar = vr.client_name_ar)
    OR (vr.client_phone IS NOT NULL AND vr.client_phone != '' AND c.phone = vr.client_phone)
  );

-- Link remaining requests (those with no client_name but with client_user_id via profiles)
UPDATE public.valuation_requests vr
SET client_id = c.id
FROM public.profiles p, public.clients c
WHERE vr.client_id IS NULL
  AND vr.client_user_id = p.user_id
  AND (c.phone = p.phone OR c.name_ar = COALESCE(p.full_name_ar, p.phone));
