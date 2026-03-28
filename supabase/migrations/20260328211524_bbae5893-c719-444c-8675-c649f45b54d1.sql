
-- ============================================
-- Client Portal: valuation_requests table
-- ============================================
CREATE TYPE public.request_status AS ENUM (
  'draft',
  'ai_review',
  'submitted',
  'needs_clarification',
  'under_pricing',
  'quotation_sent',
  'quotation_approved',
  'quotation_rejected',
  'awaiting_payment',
  'payment_uploaded',
  'payment_under_review',
  'partially_paid',
  'fully_paid',
  'in_production',
  'draft_report_sent',
  'client_comments',
  'final_payment_pending',
  'final_payment_uploaded',
  'final_payment_approved',
  'final_report_ready',
  'completed',
  'archived',
  'cancelled'
);

CREATE TABLE public.valuation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  reference_number TEXT,
  
  -- Property info from intake
  property_type public.property_type,
  property_description_ar TEXT,
  property_description_en TEXT,
  property_address_ar TEXT,
  property_address_en TEXT,
  property_city_ar TEXT,
  property_city_en TEXT,
  property_district_ar TEXT,
  property_district_en TEXT,
  land_area NUMERIC,
  building_area NUMERIC,
  
  -- Valuation info
  purpose public.valuation_purpose,
  basis_of_value public.basis_of_value DEFAULT 'market_value',
  intended_use_ar TEXT,
  intended_use_en TEXT,
  intended_users_ar TEXT,
  intended_users_en TEXT,
  
  -- AI intake results
  ai_intake_summary JSONB,
  ai_missing_items JSONB,
  ai_suggested_category TEXT,
  ai_complexity_level TEXT,
  ai_suggested_turnaround TEXT,
  ai_suggested_price NUMERIC,
  ai_validated BOOLEAN DEFAULT false,
  
  -- Quotation
  quotation_amount NUMERIC,
  quotation_currency TEXT DEFAULT 'SAR',
  quotation_notes_ar TEXT,
  quotation_notes_en TEXT,
  scope_of_work_ar TEXT,
  scope_of_work_en TEXT,
  fees_breakdown JSONB,
  terms_ar TEXT,
  terms_en TEXT,
  quotation_sent_at TIMESTAMPTZ,
  quotation_response_at TIMESTAMPTZ,
  
  -- Payment
  total_fees NUMERIC,
  amount_paid NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  
  -- Linked assignment (after approval)
  assignment_id UUID REFERENCES public.valuation_assignments(id),
  
  -- Status
  status public.request_status NOT NULL DEFAULT 'draft',
  
  -- Timestamps
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_valuation_requests
  BEFORE UPDATE ON public.valuation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Request documents
-- ============================================
CREATE TABLE public.request_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.valuation_requests(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- AI classification
  ai_category TEXT,
  ai_classification_confidence NUMERIC,
  ai_extracted_data JSONB,
  ai_is_relevant BOOLEAN DEFAULT true,
  ai_notes TEXT,
  
  -- Manual override
  manual_category TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Request messages (chat)
-- ============================================
CREATE TYPE public.message_sender_type AS ENUM ('client', 'admin', 'ai', 'system');

CREATE TABLE public.request_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.valuation_requests(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_type public.message_sender_type NOT NULL,
  
  content TEXT NOT NULL,
  metadata JSONB,
  
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Payment receipts
-- ============================================
CREATE TABLE public.payment_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.valuation_requests(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'SAR',
  payment_type TEXT DEFAULT 'full',
  
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE public.valuation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- Clients can see their own requests
CREATE POLICY "Clients can view own requests" ON public.valuation_requests
  FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());

-- Clients can create requests
CREATE POLICY "Clients can create requests" ON public.valuation_requests
  FOR INSERT TO authenticated
  WITH CHECK (client_user_id = auth.uid());

-- Clients can update own draft requests
CREATE POLICY "Clients can update own requests" ON public.valuation_requests
  FOR UPDATE TO authenticated
  USING (client_user_id = auth.uid());

-- Admins can view all requests in their org
CREATE POLICY "Admins view org requests" ON public.valuation_requests
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'firm_admin') OR
    has_role(auth.uid(), 'valuer') OR
    has_role(auth.uid(), 'reviewer')
  );

-- Admins can update requests
CREATE POLICY "Admins update requests" ON public.valuation_requests
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'firm_admin') OR
    has_role(auth.uid(), 'valuer')
  );

-- Request documents
CREATE POLICY "Access request documents" ON public.request_documents
  FOR ALL TO authenticated
  USING (
    request_id IN (
      SELECT id FROM public.valuation_requests
      WHERE client_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'firm_admin')
    OR has_role(auth.uid(), 'valuer')
  );

-- Request messages
CREATE POLICY "Access request messages" ON public.request_messages
  FOR ALL TO authenticated
  USING (
    request_id IN (
      SELECT id FROM public.valuation_requests
      WHERE client_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'firm_admin')
    OR has_role(auth.uid(), 'valuer')
  );

-- Payment receipts
CREATE POLICY "Access payment receipts" ON public.payment_receipts
  FOR ALL TO authenticated
  USING (
    request_id IN (
      SELECT id FROM public.valuation_requests
      WHERE client_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'firm_admin')
  );

-- ============================================
-- Storage bucket for client uploads
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-uploads', 'client-uploads', false);

-- Storage policies
CREATE POLICY "Clients can upload files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-uploads');

CREATE POLICY "Users can view own uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-uploads');

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_messages;

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_valuation_requests_client ON public.valuation_requests(client_user_id);
CREATE INDEX idx_valuation_requests_status ON public.valuation_requests(status);
CREATE INDEX idx_request_documents_request ON public.request_documents(request_id);
CREATE INDEX idx_request_messages_request ON public.request_messages(request_id);
CREATE INDEX idx_payment_receipts_request ON public.payment_receipts(request_id);
