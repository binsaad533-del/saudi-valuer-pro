
-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  body_ar TEXT,
  body_en TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal',
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  related_assignment_id UUID REFERENCES public.valuation_assignments(id) ON DELETE SET NULL,
  related_request_id UUID REFERENCES public.valuation_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- SLA tracking fields on valuation_assignments
ALTER TABLE public.valuation_assignments
  ADD COLUMN IF NOT EXISTS sla_inspection_hours INTEGER DEFAULT 48,
  ADD COLUMN IF NOT EXISTS sla_report_hours INTEGER DEFAULT 72,
  ADD COLUMN IF NOT EXISTS sla_total_days INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS actual_inspection_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_report_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'on_track';

-- Report templates table
CREATE TABLE public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  asset_type TEXT NOT NULL DEFAULT 'residential',
  template_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view report templates"
  ON public.report_templates FOR SELECT
  TO authenticated
  USING (true);

-- Index for fast notification queries
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON public.notifications (created_at DESC);
