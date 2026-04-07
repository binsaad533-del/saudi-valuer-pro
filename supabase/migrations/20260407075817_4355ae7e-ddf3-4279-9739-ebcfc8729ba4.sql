-- ============================================
-- تنظيف شامل لجميع البيانات التجريبية
-- مع الحفاظ على حساب المالك: a.almalki@jsaas-group.com
-- ID: e51f2490-1d66-4351-bdc0-5aca3ed5cffe
-- ============================================

-- Disable audit log immutability trigger temporarily
DROP TRIGGER IF EXISTS prevent_audit_modification ON public.audit_logs;

-- 1. Delete child tables first (FK dependencies)
DELETE FROM public.asset_edit_logs;
DELETE FROM public.file_classifications;
DELETE FROM public.extracted_assets;
DELETE FROM public.processing_jobs;
DELETE FROM public.comparable_adjustments;
DELETE FROM public.comparable_sources;
DELETE FROM public.comparable_verifications;
DELETE FROM public.assignment_comparables;
DELETE FROM public.compliance_check_results;
DELETE FROM public.compliance_checks;
DELETE FROM public.inspection_checklist_items;
DELETE FROM public.inspection_photos;
DELETE FROM public.inspection_analysis;
DELETE FROM public.inspections;
DELETE FROM public.inspector_evaluations;
DELETE FROM public.inspector_reassignment_log;
DELETE FROM public.inspector_coverage_areas;
DELETE FROM public.inspector_profiles;
DELETE FROM public.assumptions;
DELETE FROM public.attachments;
DELETE FROM public.subject_rights;
DELETE FROM public.subjects_machinery;
DELETE FROM public.subjects;
DELETE FROM public.machinery_valuations;
DELETE FROM public.valuation_calculations;
DELETE FROM public.valuation_methods;
DELETE FROM public.reconciliation_results;
DELETE FROM public.review_findings;
DELETE FROM public.report_comments;
DELETE FROM public.report_signatures;
DELETE FROM public.report_change_log;
DELETE FROM public.report_verification_log;
DELETE FROM public.report_versions;
DELETE FROM public.report_drafts;
DELETE FROM public.reports;
DELETE FROM public.scope_of_work;
DELETE FROM public.status_history;
DELETE FROM public.portfolio_assets;
DELETE FROM public.discount_usage_log;
DELETE FROM public.invoices;
DELETE FROM public.payment_receipts;
DELETE FROM public.payment_webhook_logs;
DELETE FROM public.payments;
DELETE FROM public.request_documents;
DELETE FROM public.request_messages;
DELETE FROM public.valuation_requests WHERE true;
DELETE FROM public.valuation_assignments;
DELETE FROM public.archived_reports;
DELETE FROM public.client_merge_log;
DELETE FROM public.comparables;
DELETE FROM public.intelligence_source_links;

-- 2. Delete notifications and logs
DELETE FROM public.notification_delivery_log;
DELETE FROM public.notifications;
DELETE FROM public.notification_preferences WHERE user_id != 'e51f2490-1d66-4351-bdc0-5aca3ed5cffe';
DELETE FROM public.audit_logs;
DELETE FROM public.email_send_log;
DELETE FROM public.email_unsubscribe_tokens;
DELETE FROM public.login_attempts;
DELETE FROM public.security_alerts;
DELETE FROM public.system_events;
DELETE FROM public.system_health_checks;
DELETE FROM public.active_sessions WHERE user_id != 'e51f2490-1d66-4351-bdc0-5aca3ed5cffe';
DELETE FROM public.raqeem_audit_log;
DELETE FROM public.raqeem_corrections;
DELETE FROM public.raqeem_test_sessions;
DELETE FROM public.raqeem_performance_snapshots;
DELETE FROM public.report_templates;
DELETE FROM public.role_change_log;
DELETE FROM public.suppressed_emails;

-- 3. Delete clients
DELETE FROM public.clients;

-- 4. Delete non-owner profiles and roles
DELETE FROM public.user_roles WHERE user_id != 'e51f2490-1d66-4351-bdc0-5aca3ed5cffe';
DELETE FROM public.profiles WHERE user_id != 'e51f2490-1d66-4351-bdc0-5aca3ed5cffe';

-- 5. Delete non-owner auth users
DELETE FROM auth.users WHERE id != 'e51f2490-1d66-4351-bdc0-5aca3ed5cffe';

-- Re-create audit log immutability trigger
CREATE TRIGGER prevent_audit_modification
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();
