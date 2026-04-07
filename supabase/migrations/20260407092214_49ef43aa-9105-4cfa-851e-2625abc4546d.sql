
CREATE OR REPLACE FUNCTION public.notify_inspector_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.inspector_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.inspector_id IS NOT DISTINCT FROM NEW.inspector_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id, title_ar, body_ar, category, priority,
    notification_type, channel, delivery_status,
    action_url, related_assignment_id
  ) VALUES (
    NEW.inspector_id,
    'معاينة جديدة مسندة إليك',
    'تم إسناد مهمة معاينة جديدة إليك. يرجى مراجعة التفاصيل والتخطيط للزيارة.',
    'inspection', 'critical',
    'new_inspection_assigned', 'in_app', 'delivered',
    '/inspector', NEW.assignment_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_inspector_on_assignment
  AFTER INSERT OR UPDATE OF inspector_id
  ON public.inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_inspector_on_assignment();
