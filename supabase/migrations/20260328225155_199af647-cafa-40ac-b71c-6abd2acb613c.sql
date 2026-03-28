
-- Add new status values to the existing assignment_status enum
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'client_submitted';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'under_ai_review';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'awaiting_client_info';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'priced';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'awaiting_payment_initial';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'payment_received_initial';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'inspection_required';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'inspection_assigned';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'inspection_in_progress';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'inspection_submitted';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'valuation_in_progress';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'draft_report_ready';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'under_client_review';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'revision_in_progress';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'awaiting_final_payment';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'final_payment_received';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'report_issued';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'closed';

-- Also add to request_status enum for valuation_requests
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'client_submitted';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'under_ai_review';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'awaiting_client_info';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'priced';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'awaiting_payment_initial';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'payment_received_initial';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'inspection_required';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'inspection_assigned';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'inspection_in_progress';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'inspection_submitted';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'valuation_in_progress';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'draft_report_ready';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'under_client_review';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'revision_in_progress';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'awaiting_final_payment';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'final_payment_received';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'report_issued';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'closed';
