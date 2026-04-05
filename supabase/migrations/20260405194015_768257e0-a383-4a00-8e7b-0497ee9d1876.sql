
-- Notification preferences table
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Add new columns to notifications table
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS notification_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'delivered',
  ADD COLUMN IF NOT EXISTS delivery_error text;

-- Notification delivery log for email/SMS tracking
CREATE TABLE public.notification_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own delivery logs"
  ON public.notification_delivery_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner can read all delivery logs"
  ON public.notification_delivery_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_delivery_log;
