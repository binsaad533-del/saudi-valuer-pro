
-- Engagement campaigns table
CREATE TABLE public.engagement_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_name_ar TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'seasonal_reminder',
  trigger_type TEXT NOT NULL DEFAULT 'automatic',
  trigger_config JSONB DEFAULT '{}',
  message_template_ar TEXT NOT NULL,
  message_template_en TEXT,
  target_segment TEXT DEFAULT 'all',
  channel TEXT NOT NULL DEFAULT 'in_app',
  schedule_cron TEXT,
  is_active BOOLEAN DEFAULT true,
  priority TEXT DEFAULT 'medium',
  created_by UUID,
  stats JSONB DEFAULT '{"sent": 0, "opened": 0, "responded": 0, "converted": 0}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Engagement logs
CREATE TABLE public.engagement_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  client_user_id UUID,
  campaign_id UUID REFERENCES public.engagement_campaigns(id) ON DELETE SET NULL,
  campaign_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  message_ar TEXT NOT NULL,
  delivery_status TEXT DEFAULT 'pending',
  opened_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_type TEXT,
  discount_code TEXT,
  conversion_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client engagement scores
CREATE TABLE public.client_engagement_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  client_user_id UUID,
  engagement_score INTEGER DEFAULT 50,
  activity_status TEXT DEFAULT 'active',
  last_interaction_at TIMESTAMPTZ,
  last_request_at TIMESTAMPTZ,
  total_requests INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  avg_response_time_hours NUMERIC,
  preferred_channel TEXT DEFAULT 'in_app',
  preferred_contact_time TEXT,
  interests TEXT[] DEFAULT '{}',
  lifecycle_stage TEXT DEFAULT 'new',
  churn_risk_score INTEGER DEFAULT 0,
  next_recommended_action TEXT,
  next_action_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Occasion templates
CREATE TABLE public.occasion_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  occasion_key TEXT NOT NULL UNIQUE,
  occasion_name_ar TEXT NOT NULL,
  default_message_ar TEXT NOT NULL,
  hijri_month INTEGER,
  hijri_day INTEGER,
  gregorian_month INTEGER,
  gregorian_day INTEGER,
  is_active BOOLEAN DEFAULT true,
  send_days_before INTEGER DEFAULT 0,
  include_offer BOOLEAN DEFAULT false,
  offer_discount_pct NUMERIC,
  offer_validity_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Loyalty rewards
CREATE TABLE public.loyalty_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reward_name_ar TEXT NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'discount',
  discount_percentage NUMERIC,
  fixed_amount NUMERIC,
  min_requests INTEGER DEFAULT 1,
  min_revenue NUMERIC,
  applicable_services TEXT[] DEFAULT '{}',
  validity_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  auto_apply BOOLEAN DEFAULT true,
  trigger_condition JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.engagement_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_engagement_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occasion_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view campaigns" ON public.engagement_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage campaigns" ON public.engagement_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view engagement logs" ON public.engagement_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert engagement logs" ON public.engagement_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view scores" ON public.client_engagement_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage scores" ON public.client_engagement_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view occasions" ON public.occasion_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage occasions" ON public.occasion_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view rewards" ON public.loyalty_rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage rewards" ON public.loyalty_rewards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed occasion templates
INSERT INTO public.occasion_templates (occasion_key, occasion_name_ar, default_message_ar, gregorian_month, gregorian_day, hijri_month, hijri_day, is_active, include_offer, offer_discount_pct, offer_validity_days) VALUES
('eid_fitr', 'عيد الفطر المبارك', 'كل عام وأنتم بخير 🌙 بمناسبة عيد الفطر المبارك، نتمنى لكم ولعائلتكم عيداً سعيداً. يسعدنا خدمتكم دائماً في تقييم أصولكم باحترافية ودقة.', NULL, NULL, 10, 1, true, true, 10, 14),
('eid_adha', 'عيد الأضحى المبارك', 'تقبّل الله طاعتكم 🕋 بمناسبة عيد الأضحى المبارك، نسأل الله أن يعيده عليكم بالخير والبركة. نحن في خدمتكم لجميع احتياجات التقييم.', NULL, NULL, 12, 10, true, true, 10, 14),
('saudi_national_day', 'اليوم الوطني السعودي', 'كل عام والوطن بخير 🇸🇦 بمناسبة اليوم الوطني الـ94، نفخر بخدمة قطاع التقييم في المملكة العربية السعودية. دمتم ودام وطننا.', 9, 23, NULL, NULL, true, true, 15, 7),
('saudi_founding_day', 'يوم التأسيس السعودي', 'يوم التأسيس 🏰 نحتفل معكم بذكرى تأسيس الدولة السعودية الأولى عام 1727م. تاريخ عريق وإرث خالد. كل عام ومملكتنا في عزّ وازدهار.', 2, 22, NULL, NULL, true, true, 15, 7),
('ramadan', 'شهر رمضان المبارك', 'رمضان كريم 🌙 نسأل الله أن يبلّغكم الشهر الكريم بالصحة والعافية. نذكّركم بأن خدماتنا متاحة طوال الشهر الفضيل لخدمتكم.', NULL, NULL, 9, 1, true, false, NULL, NULL),
('new_year', 'رأس السنة الميلادية', 'عام جديد مبارك 🎉 نتمنى لكم عاماً مليئاً بالنجاح والتوفيق. فريقنا جاهز لمساعدتكم في تقييم أصولكم وتحقيق أهدافكم الاستثمارية.', 1, 1, NULL, NULL, true, true, 10, 14);

-- Seed default loyalty rewards
INSERT INTO public.loyalty_rewards (reward_name_ar, reward_type, discount_percentage, min_requests, is_active, trigger_condition) VALUES
('خصم العميل المتكرر', 'discount', 5, 3, true, '{"type": "repeat_client", "min_requests": 3}'),
('خصم الولاء السنوي', 'discount', 10, 5, true, '{"type": "annual_loyalty", "min_requests": 5}'),
('خصم إعادة التقييم المبكر', 'discount', 15, 1, true, '{"type": "early_renewal", "days_before_expiry": 45}'),
('خصم حزمة المحفظة', 'discount', 20, 1, true, '{"type": "portfolio_bundle", "min_assets": 5}'),
('خصم ذكرى التعامل الأولى', 'discount', 10, 1, true, '{"type": "anniversary", "years": 1}');

-- Enable realtime for engagement logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.engagement_logs;
