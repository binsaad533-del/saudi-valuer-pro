
-- Fix security definer views by setting them to SECURITY INVOKER
ALTER VIEW public.v_assignment_pipeline SET (security_invoker = on);
ALTER VIEW public.v_recent_assignments SET (security_invoker = on);
ALTER VIEW public.v_compliance_summary SET (security_invoker = on);
ALTER VIEW public.v_review_summary SET (security_invoker = on);
