
-- Step 1: Drop ALL policies that depend on app_role enum
DROP POLICY IF EXISTS "Super admins can manage all orgs" ON public.organizations;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage glossary" ON public.glossary_terms;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins view org requests" ON public.valuation_requests;
DROP POLICY IF EXISTS "Admins update requests" ON public.valuation_requests;
DROP POLICY IF EXISTS "Access request documents" ON public.request_documents;
DROP POLICY IF EXISTS "Access request messages" ON public.request_messages;
DROP POLICY IF EXISTS "Access payment receipts" ON public.payment_receipts;
DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
DROP POLICY IF EXISTS "Admins view webhook logs" ON public.payment_webhook_logs;
DROP POLICY IF EXISTS "Authenticated insert webhook logs" ON public.payment_webhook_logs;
DROP POLICY IF EXISTS "Clients access own report comments" ON public.report_comments;
DROP POLICY IF EXISTS "Admins manage inspector profiles" ON public.inspector_profiles;
DROP POLICY IF EXISTS "Admins manage reassignment log" ON public.inspector_reassignment_log;
DROP POLICY IF EXISTS "Admins manage cities" ON public.cities;
DROP POLICY IF EXISTS "Admins manage districts" ON public.districts;
DROP POLICY IF EXISTS "Admins manage coverage" ON public.inspector_coverage_areas;
DROP POLICY IF EXISTS "Admins can view verification log" ON public.report_verification_log;
DROP POLICY IF EXISTS "Clients access own portfolio assets" ON public.portfolio_assets;
DROP POLICY IF EXISTS "Admins view raqeem audit" ON public.raqeem_audit_log;
DROP POLICY IF EXISTS "Admins manage test sessions" ON public.raqeem_test_sessions;
DROP POLICY IF EXISTS "Admins manage performance snapshots" ON public.raqeem_performance_snapshots;
DROP POLICY IF EXISTS "Admins manage role change log" ON public.role_change_log;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage evaluations" ON public.inspector_evaluations;

-- Step 2: Drop the has_role function
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Step 3: Migrate user_roles column to text temporarily
ALTER TABLE public.user_roles ADD COLUMN role_text text;
UPDATE public.user_roles SET role_text = CASE
  WHEN role::text = 'super_admin' THEN 'owner'
  WHEN role::text = 'firm_admin' THEN 'admin_coordinator'
  WHEN role::text = 'valuer' THEN 'owner'
  WHEN role::text = 'reviewer' THEN 'owner'
  WHEN role::text = 'auditor' THEN 'financial_manager'
  WHEN role::text = 'inspector' THEN 'inspector'
  WHEN role::text = 'client' THEN 'client'
  ELSE 'client'
END;
ALTER TABLE public.user_roles DROP COLUMN role;

-- Step 4: Drop old enum, create new one
DROP TYPE public.app_role;
CREATE TYPE public.app_role AS ENUM ('owner', 'financial_manager', 'admin_coordinator', 'inspector', 'client');

-- Step 5: Add role column back with new enum
ALTER TABLE public.user_roles ADD COLUMN role public.app_role NOT NULL DEFAULT 'client';
UPDATE public.user_roles SET role = role_text::app_role;
ALTER TABLE public.user_roles DROP COLUMN role_text;

-- Step 6: Recreate has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Step 7: Recreate ALL RLS policies with new roles
CREATE POLICY "Owner can manage all orgs" ON public.organizations FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner manages all user roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can manage glossary" ON public.glossary_terms FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role) OR has_role(auth.uid(), 'financial_manager'::app_role));
CREATE POLICY "Admins view org requests" ON public.valuation_requests FOR SELECT TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role) OR has_role(auth.uid(), 'financial_manager'::app_role));
CREATE POLICY "Admins update requests" ON public.valuation_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Access request documents" ON public.request_documents FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role) OR (request_id IN (SELECT id FROM valuation_requests WHERE client_user_id = auth.uid())));
CREATE POLICY "Access request messages" ON public.request_messages FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role) OR (request_id IN (SELECT id FROM valuation_requests WHERE client_user_id = auth.uid())));
CREATE POLICY "Access payment receipts" ON public.payment_receipts FOR ALL TO authenticated USING ((request_id IN (SELECT id FROM valuation_requests WHERE client_user_id = auth.uid())) OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'financial_manager'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Admins manage payments" ON public.payments FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'financial_manager'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Admins view webhook logs" ON public.payment_webhook_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'financial_manager'::app_role));
CREATE POLICY "Authenticated insert webhook logs" ON public.payment_webhook_logs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'financial_manager'::app_role) OR (payment_id IN (SELECT p.id FROM payments p JOIN valuation_requests vr ON p.request_id = vr.id WHERE vr.client_user_id = auth.uid())));
CREATE POLICY "Access report comments" ON public.report_comments FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role) OR (request_id IN (SELECT id FROM valuation_requests WHERE client_user_id = auth.uid())));
CREATE POLICY "Admins manage inspector profiles" ON public.inspector_profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Admins manage reassignment log" ON public.inspector_reassignment_log FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Admins manage cities" ON public.cities FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Admins manage districts" ON public.districts FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Admins manage coverage" ON public.inspector_coverage_areas FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Admins can view verification log" ON public.report_verification_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Clients access own portfolio assets" ON public.portfolio_assets FOR ALL TO authenticated USING ((request_id IN (SELECT id FROM valuation_requests WHERE client_user_id = auth.uid())) OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Owner views raqeem audit" ON public.raqeem_audit_log FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner manages test sessions" ON public.raqeem_test_sessions FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner manages performance snapshots" ON public.raqeem_performance_snapshots FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner manages role change log" ON public.role_change_log FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
CREATE POLICY "Admins manage evaluations" ON public.inspector_evaluations FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));
