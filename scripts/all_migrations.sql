-- ============================================================
-- MIGRATION: supabase/migrations/20260328204625_e72fd0f2-5ecd-4863-aed5-97955356d7af.sql
-- ============================================================

-- ============================================================
-- jsaas-valuation: Core Database Schema
-- Regulated Saudi Real Estate Valuation Platform
-- ============================================================

-- ==================== ENUMS ====================

CREATE TYPE public.app_role AS ENUM ('super_admin', 'firm_admin', 'valuer', 'reviewer', 'client', 'auditor');

CREATE TYPE public.assignment_status AS ENUM (
  'draft', 'intake', 'scope_definition', 'data_collection',
  'inspection', 'analysis', 'valuation', 'reconciliation',
  'draft_report', 'internal_review', 'revision', 'final_approval',
  'issued', 'archived', 'rejected', 'returned'
);

CREATE TYPE public.property_type AS ENUM (
  'residential', 'commercial', 'land', 'income_producing',
  'development', 'expropriation', 'mixed_use', 'industrial',
  'agricultural', 'hospitality'
);

CREATE TYPE public.valuation_purpose AS ENUM (
  'sale_purchase', 'mortgage', 'financial_reporting', 'insurance',
  'taxation', 'expropriation', 'litigation', 'investment',
  'lease_renewal', 'internal_decision', 'regulatory', 'other'
);

CREATE TYPE public.basis_of_value AS ENUM (
  'market_value', 'fair_value', 'investment_value',
  'equitable_value', 'liquidation_value', 'synergistic_value', 'other'
);

CREATE TYPE public.valuation_approach AS ENUM (
  'sales_comparison', 'income', 'cost', 'residual',
  'profits', 'discounted_cash_flow'
);

CREATE TYPE public.report_type AS ENUM (
  'short_form', 'full_narrative', 'internal_draft', 'review_report', 'compliance_checklist'
);

CREATE TYPE public.report_language AS ENUM ('ar', 'en', 'bilingual');

CREATE TYPE public.review_finding_severity AS ENUM ('critical', 'major', 'minor', 'observation');

CREATE TYPE public.adjustment_type AS ENUM (
  'location', 'area', 'age', 'condition', 'quality',
  'floor_level', 'view', 'parking', 'date', 'zoning',
  'access', 'shape', 'frontage', 'services', 'other'
);

CREATE TYPE public.attachment_category AS ENUM (
  'title_deed', 'building_permit', 'lease_contract', 'photo',
  'site_plan', 'map', 'coordinates', 'municipal_doc', 'zoning',
  'financial_statement', 'comparable_evidence', 'inspection_report',
  'identity_doc', 'other'
);

CREATE TYPE public.audit_action AS ENUM (
  'create', 'update', 'delete', 'status_change', 'lock',
  'unlock', 'sign', 'approve', 'reject', 'return',
  'view', 'export', 'login', 'logout'
);

-- ==================== UTILITY FUNCTION ====================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ==================== 1. ORGANIZATIONS ====================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  license_number TEXT,
  taqeem_registration TEXT,
  cr_number TEXT,
  address_ar TEXT,
  address_en TEXT,
  city_ar TEXT,
  city_en TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ==================== 2. PROFILES ====================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  full_name_ar TEXT NOT NULL,
  full_name_en TEXT,
  email TEXT,
  phone TEXT,
  title_ar TEXT,
  title_en TEXT,
  taqeem_membership TEXT,
  license_number TEXT,
  specialization TEXT,
  avatar_url TEXT,
  signature_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  preferred_language TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ==================== 3. USER ROLES ====================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, organization_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles
  WHERE user_id = _user_id LIMIT 1
$$;

-- ==================== 4. CLIENTS ====================

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  client_type TEXT NOT NULL DEFAULT 'individual',
  id_type TEXT,
  id_number TEXT,
  cr_number TEXT,
  email TEXT,
  phone TEXT,
  address_ar TEXT,
  address_en TEXT,
  city_ar TEXT,
  city_en TEXT,
  contact_person_ar TEXT,
  contact_person_en TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- ==================== 5. VALUATION ASSIGNMENTS ====================

CREATE TABLE public.valuation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  reference_number TEXT NOT NULL UNIQUE,
  sequential_number INTEGER NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  status assignment_status NOT NULL DEFAULT 'draft',
  property_type property_type NOT NULL,
  purpose valuation_purpose NOT NULL,
  basis_of_value basis_of_value NOT NULL DEFAULT 'market_value',
  report_language report_language NOT NULL DEFAULT 'ar',
  intended_use_ar TEXT,
  intended_use_en TEXT,
  intended_users_ar TEXT,
  intended_users_en TEXT,
  valuation_date DATE,
  report_date DATE,
  issue_date DATE,
  engagement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_valuer_id UUID REFERENCES auth.users(id),
  assigned_reviewer_id UUID REFERENCES auth.users(id),
  priority TEXT DEFAULT 'normal',
  fee_amount NUMERIC(12,2),
  fee_currency TEXT DEFAULT 'SAR',
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  qr_verification_code TEXT UNIQUE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.valuation_assignments ENABLE ROW LEVEL SECURITY;

-- ==================== 6. SCOPE OF WORK ====================

CREATE TABLE public.scope_of_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  scope_description_ar TEXT,
  scope_description_en TEXT,
  extent_of_investigation_ar TEXT,
  extent_of_investigation_en TEXT,
  nature_of_information_ar TEXT,
  nature_of_information_en TEXT,
  data_sources_ar TEXT,
  data_sources_en TEXT,
  restrictions_ar TEXT,
  restrictions_en TEXT,
  limitations_ar TEXT,
  limitations_en TEXT,
  reliance_on_others_ar TEXT,
  reliance_on_others_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scope_of_work ENABLE ROW LEVEL SECURITY;

-- ==================== 7. SUBJECTS (Properties) ====================

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  title_deed_number TEXT,
  plan_number TEXT,
  plot_number TEXT,
  property_type property_type NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  legal_description_ar TEXT,
  legal_description_en TEXT,
  address_ar TEXT,
  address_en TEXT,
  city_ar TEXT,
  city_en TEXT,
  district_ar TEXT,
  district_en TEXT,
  region_ar TEXT,
  region_en TEXT,
  zip_code TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  land_area NUMERIC(14,2),
  land_area_unit TEXT DEFAULT 'sqm',
  building_area NUMERIC(14,2),
  building_area_unit TEXT DEFAULT 'sqm',
  number_of_floors INTEGER,
  year_built INTEGER,
  building_condition TEXT,
  zoning_ar TEXT,
  zoning_en TEXT,
  current_use_ar TEXT,
  current_use_en TEXT,
  permitted_use_ar TEXT,
  permitted_use_en TEXT,
  number_of_units INTEGER,
  parking_spaces INTEGER,
  frontage NUMERIC(8,2),
  depth NUMERIC(8,2),
  shape_ar TEXT,
  shape_en TEXT,
  topography_ar TEXT,
  topography_en TEXT,
  utilities_ar TEXT,
  utilities_en TEXT,
  access_roads_ar TEXT,
  access_roads_en TEXT,
  annual_income NUMERIC(14,2),
  occupancy_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- ==================== 8. SUBJECT RIGHTS ====================

CREATE TABLE public.subject_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  right_type_ar TEXT NOT NULL,
  right_type_en TEXT,
  holder_ar TEXT,
  holder_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  registration_number TEXT,
  registration_date DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subject_rights ENABLE ROW LEVEL SECURITY;

-- ==================== 9. ASSUMPTIONS ====================

CREATE TABLE public.assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  is_special BOOLEAN NOT NULL DEFAULT false,
  assumption_ar TEXT NOT NULL,
  assumption_en TEXT,
  justification_ar TEXT,
  justification_en TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;

-- ==================== 10. INSPECTIONS ====================

CREATE TABLE public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES auth.users(id),
  inspection_date DATE NOT NULL,
  inspection_time TIME,
  duration_minutes INTEGER,
  type TEXT DEFAULT 'internal_external',
  access_granted BOOLEAN DEFAULT true,
  weather_conditions TEXT,
  notes_ar TEXT,
  notes_en TEXT,
  findings_ar TEXT,
  findings_en TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- ==================== 11. MARKET ZONES ====================

CREATE TABLE public.market_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  city_ar TEXT,
  city_en TEXT,
  region_ar TEXT,
  region_en TEXT,
  zone_type TEXT,
  avg_price_per_sqm NUMERIC(10,2),
  trend TEXT DEFAULT 'stable',
  description_ar TEXT,
  description_en TEXT,
  boundary_geojson JSONB,
  last_updated DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_zones ENABLE ROW LEVEL SECURITY;

-- ==================== 12. COMPARABLES ====================

CREATE TABLE public.comparables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  property_type property_type NOT NULL,
  transaction_type TEXT DEFAULT 'sale',
  transaction_date DATE,
  price NUMERIC(14,2),
  price_per_sqm NUMERIC(10,2),
  currency TEXT DEFAULT 'SAR',
  address_ar TEXT,
  address_en TEXT,
  city_ar TEXT,
  city_en TEXT,
  district_ar TEXT,
  district_en TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  land_area NUMERIC(14,2),
  building_area NUMERIC(14,2),
  year_built INTEGER,
  condition TEXT,
  zoning_ar TEXT,
  zoning_en TEXT,
  number_of_floors INTEGER,
  number_of_units INTEGER,
  description_ar TEXT,
  description_en TEXT,
  confidence_score NUMERIC(3,2) DEFAULT 0.00,
  is_verified BOOLEAN DEFAULT false,
  market_zone_id UUID REFERENCES public.market_zones(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comparables ENABLE ROW LEVEL SECURITY;

-- ==================== 13. COMPARABLE SOURCES ====================

CREATE TABLE public.comparable_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparable_id UUID NOT NULL REFERENCES public.comparables(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_name_ar TEXT,
  source_name_en TEXT,
  reference_number TEXT,
  source_date DATE,
  url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comparable_sources ENABLE ROW LEVEL SECURITY;

-- ==================== 14. COMPARABLE VERIFICATIONS ====================

CREATE TABLE public.comparable_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparable_id UUID NOT NULL REFERENCES public.comparables(id) ON DELETE CASCADE,
  verified_by UUID NOT NULL REFERENCES auth.users(id),
  verification_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT,
  result TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comparable_verifications ENABLE ROW LEVEL SECURITY;

-- ==================== 15. ASSIGNMENT COMPARABLES (link) ====================

CREATE TABLE public.assignment_comparables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  comparable_id UUID NOT NULL REFERENCES public.comparables(id),
  rank INTEGER DEFAULT 0,
  weight NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  UNIQUE(assignment_id, comparable_id)
);

ALTER TABLE public.assignment_comparables ENABLE ROW LEVEL SECURITY;

-- ==================== 16. COMPARABLE ADJUSTMENTS ====================

CREATE TABLE public.comparable_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_comparable_id UUID NOT NULL REFERENCES public.assignment_comparables(id) ON DELETE CASCADE,
  adjustment_type adjustment_type NOT NULL,
  label_ar TEXT NOT NULL,
  label_en TEXT,
  subject_value TEXT,
  comparable_value TEXT,
  adjustment_percentage NUMERIC(8,4),
  adjustment_amount NUMERIC(14,2),
  justification_ar TEXT,
  justification_en TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comparable_adjustments ENABLE ROW LEVEL SECURITY;

-- ==================== 17. VALUATION METHODS ====================

CREATE TABLE public.valuation_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  approach valuation_approach NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_used BOOLEAN DEFAULT true,
  reason_for_use_ar TEXT,
  reason_for_use_en TEXT,
  reason_for_rejection_ar TEXT,
  reason_for_rejection_en TEXT,
  weight_in_reconciliation NUMERIC(5,2) DEFAULT 0,
  concluded_value NUMERIC(16,2),
  currency TEXT DEFAULT 'SAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.valuation_methods ENABLE ROW LEVEL SECURITY;

-- ==================== 18. VALUATION CALCULATIONS ====================

CREATE TABLE public.valuation_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_id UUID NOT NULL REFERENCES public.valuation_methods(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  label_ar TEXT NOT NULL,
  label_en TEXT,
  input_data JSONB,
  formula TEXT,
  result_value NUMERIC(16,2),
  result_unit TEXT,
  explanation_ar TEXT,
  explanation_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.valuation_calculations ENABLE ROW LEVEL SECURITY;

-- ==================== 19. RECONCILIATION ====================

CREATE TABLE public.reconciliation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  final_value NUMERIC(16,2) NOT NULL,
  final_value_text_ar TEXT,
  final_value_text_en TEXT,
  currency TEXT DEFAULT 'SAR',
  reasoning_ar TEXT NOT NULL,
  reasoning_en TEXT,
  confidence_level TEXT,
  value_range_low NUMERIC(16,2),
  value_range_high NUMERIC(16,2),
  highest_best_use_ar TEXT,
  highest_best_use_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_results ENABLE ROW LEVEL SECURITY;

-- ==================== 20. REVIEW FINDINGS ====================

CREATE TABLE public.review_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  finding_type TEXT NOT NULL,
  severity review_finding_severity NOT NULL DEFAULT 'observation',
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description_ar TEXT NOT NULL,
  description_en TEXT,
  recommendation_ar TEXT,
  recommendation_en TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.review_findings ENABLE ROW LEVEL SECURITY;

-- ==================== 21. COMPLIANCE CHECKS ====================

CREATE TABLE public.compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  check_code TEXT NOT NULL,
  check_name_ar TEXT NOT NULL,
  check_name_en TEXT,
  category TEXT NOT NULL,
  is_passed BOOLEAN DEFAULT false,
  is_mandatory BOOLEAN DEFAULT true,
  checked_by UUID REFERENCES auth.users(id),
  checked_at TIMESTAMPTZ,
  notes TEXT,
  auto_checked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;

-- ==================== 22. REPORTS ====================

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  report_type report_type NOT NULL DEFAULT 'full_narrative',
  language report_language NOT NULL DEFAULT 'ar',
  version INTEGER NOT NULL DEFAULT 1,
  title_ar TEXT,
  title_en TEXT,
  content_ar JSONB,
  content_en JSONB,
  cover_page JSONB,
  generated_by TEXT DEFAULT 'system',
  status TEXT DEFAULT 'draft',
  pdf_url TEXT,
  pdf_url_en TEXT,
  pdf_url_bilingual TEXT,
  is_final BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ==================== 23. REPORT VERSIONS ====================

CREATE TABLE public.report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_snapshot JSONB NOT NULL,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;

-- ==================== 24. REPORT SIGNATURES ====================

CREATE TABLE public.report_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES auth.users(id),
  signer_name_ar TEXT NOT NULL DEFAULT 'احمد المالكي',
  signer_name_en TEXT NOT NULL DEFAULT 'Ahmed Al-Malki',
  signer_title_ar TEXT,
  signer_title_en TEXT,
  signer_license TEXT,
  signature_image_url TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  is_valid BOOLEAN DEFAULT true,
  UNIQUE(report_id, signer_id)
);

ALTER TABLE public.report_signatures ENABLE ROW LEVEL SECURITY;

-- ==================== 25. ATTACHMENTS ====================

CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  comparable_id UUID REFERENCES public.comparables(id) ON DELETE CASCADE,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE,
  category attachment_category NOT NULL DEFAULT 'other',
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  description_ar TEXT,
  description_en TEXT,
  extracted_data JSONB,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- ==================== 26. GLOSSARY ====================

CREATE TABLE public.glossary_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_ar TEXT NOT NULL,
  term_en TEXT NOT NULL,
  definition_ar TEXT NOT NULL,
  definition_en TEXT,
  category TEXT,
  source TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.glossary_terms ENABLE ROW LEVEL SECURITY;

-- ==================== 27. AUDIT LOGS ====================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action audit_action NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  assignment_id UUID REFERENCES public.valuation_assignments(id),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==================== 28. WORKFLOW STATUS HISTORY ====================

CREATE TABLE public.status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  from_status assignment_status,
  to_status assignment_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- ==================== TRIGGERS ====================

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.valuation_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scope_updated_at BEFORE UPDATE ON public.scope_of_work FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_market_zones_updated_at BEFORE UPDATE ON public.market_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comparables_updated_at BEFORE UPDATE ON public.comparables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_methods_updated_at BEFORE UPDATE ON public.valuation_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reconciliation_updated_at BEFORE UPDATE ON public.reconciliation_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_review_findings_updated_at BEFORE UPDATE ON public.review_findings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_compliance_updated_at BEFORE UPDATE ON public.compliance_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== INDEXES ====================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_org_id ON public.profiles(organization_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_org_id ON public.user_roles(organization_id);
CREATE INDEX idx_clients_org_id ON public.clients(organization_id);
CREATE INDEX idx_assignments_org_id ON public.valuation_assignments(organization_id);
CREATE INDEX idx_assignments_client_id ON public.valuation_assignments(client_id);
CREATE INDEX idx_assignments_status ON public.valuation_assignments(status);
CREATE INDEX idx_assignments_valuer ON public.valuation_assignments(assigned_valuer_id);
CREATE INDEX idx_assignments_reviewer ON public.valuation_assignments(assigned_reviewer_id);
CREATE INDEX idx_assignments_ref ON public.valuation_assignments(reference_number);
CREATE INDEX idx_assignments_date ON public.valuation_assignments(valuation_date);
CREATE INDEX idx_assignments_property_type ON public.valuation_assignments(property_type);
CREATE INDEX idx_subjects_assignment ON public.subjects(assignment_id);
CREATE INDEX idx_subjects_city ON public.subjects(city_ar);
CREATE INDEX idx_subjects_district ON public.subjects(district_ar);
CREATE INDEX idx_comparables_org ON public.comparables(organization_id);
CREATE INDEX idx_comparables_city ON public.comparables(city_ar);
CREATE INDEX idx_comparables_type ON public.comparables(property_type);
CREATE INDEX idx_comparables_date ON public.comparables(transaction_date);
CREATE INDEX idx_comparables_zone ON public.comparables(market_zone_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_assignment ON public.audit_logs(assignment_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_status_history_assignment ON public.status_history(assignment_id);
CREATE INDEX idx_attachments_assignment ON public.attachments(assignment_id);
CREATE INDEX idx_review_findings_assignment ON public.review_findings(assignment_id);
CREATE INDEX idx_compliance_assignment ON public.compliance_checks(assignment_id);
CREATE INDEX idx_reports_assignment ON public.reports(assignment_id);

-- ==================== LOCK PROTECTION TRIGGER ====================

CREATE OR REPLACE FUNCTION public.prevent_locked_assignment_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true AND NEW.is_locked = true THEN
    RAISE EXCEPTION 'Cannot modify a locked assignment. Unlock first.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER protect_locked_assignments
  BEFORE UPDATE ON public.valuation_assignments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_assignment_edit();

-- ==================== SEQUENTIAL NUMBER FUNCTION ====================

CREATE OR REPLACE FUNCTION public.generate_reference_number()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_seq INTEGER;
BEGIN
  year_prefix := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(sequential_number), 0) + 1 INTO next_seq
  FROM public.valuation_assignments
  WHERE reference_number LIKE 'VAL-' || year_prefix || '-%';

  NEW.sequential_number := next_seq;
  NEW.reference_number := 'VAL-' || year_prefix || '-' || LPAD(next_seq::TEXT, 4, '0');
  NEW.qr_verification_code := encode(gen_random_bytes(16), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER auto_reference_number
  BEFORE INSERT ON public.valuation_assignments
  FOR EACH ROW EXECUTE FUNCTION public.generate_reference_number();

-- ==================== RLS POLICIES ====================

-- Organizations: members can view their own org
CREATE POLICY "Users can view their organization" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Super admins can manage all orgs" ON public.organizations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Profiles
CREATE POLICY "Users can view profiles in their org" ON public.profiles
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User Roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Clients
CREATE POLICY "Org members can view clients" ON public.clients
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members can manage clients" ON public.clients
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- Assignments: org-scoped
CREATE POLICY "Org members can view assignments" ON public.valuation_assignments
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Valuers can create assignments" ON public.valuation_assignments
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Valuers can update own assignments" ON public.valuation_assignments
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- Assignment-related tables: access through assignment org
CREATE POLICY "Access scope via assignment" ON public.scope_of_work
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access subjects via assignment" ON public.subjects
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access rights via subject" ON public.subject_rights
  FOR ALL TO authenticated
  USING (subject_id IN (SELECT s.id FROM public.subjects s JOIN public.valuation_assignments a ON s.assignment_id = a.id WHERE a.organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access assumptions via assignment" ON public.assumptions
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access inspections via assignment" ON public.inspections
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Org members access market zones" ON public.market_zones
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members access comparables" ON public.comparables
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Access comparable sources" ON public.comparable_sources
  FOR ALL TO authenticated
  USING (comparable_id IN (SELECT id FROM public.comparables WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access comparable verifications" ON public.comparable_verifications
  FOR ALL TO authenticated
  USING (comparable_id IN (SELECT id FROM public.comparables WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access assignment comparables" ON public.assignment_comparables
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access comparable adjustments" ON public.comparable_adjustments
  FOR ALL TO authenticated
  USING (assignment_comparable_id IN (
    SELECT ac.id FROM public.assignment_comparables ac
    JOIN public.valuation_assignments a ON ac.assignment_id = a.id
    WHERE a.organization_id = public.get_user_org_id(auth.uid())
  ));

CREATE POLICY "Access valuation methods" ON public.valuation_methods
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access valuation calculations" ON public.valuation_calculations
  FOR ALL TO authenticated
  USING (method_id IN (
    SELECT vm.id FROM public.valuation_methods vm
    JOIN public.valuation_assignments a ON vm.assignment_id = a.id
    WHERE a.organization_id = public.get_user_org_id(auth.uid())
  ));

CREATE POLICY "Access reconciliation" ON public.reconciliation_results
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access review findings" ON public.review_findings
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access compliance checks" ON public.compliance_checks
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access reports" ON public.reports
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

CREATE POLICY "Access report versions" ON public.report_versions
  FOR ALL TO authenticated
  USING (report_id IN (
    SELECT r.id FROM public.reports r
    JOIN public.valuation_assignments a ON r.assignment_id = a.id
    WHERE a.organization_id = public.get_user_org_id(auth.uid())
  ));

CREATE POLICY "Access report signatures" ON public.report_signatures
  FOR ALL TO authenticated
  USING (report_id IN (
    SELECT r.id FROM public.reports r
    JOIN public.valuation_assignments a ON r.assignment_id = a.id
    WHERE a.organization_id = public.get_user_org_id(auth.uid())
  ));

CREATE POLICY "Access attachments" ON public.attachments
  FOR ALL TO authenticated
  USING (
    assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid()))
    OR comparable_id IN (SELECT id FROM public.comparables WHERE organization_id = public.get_user_org_id(auth.uid()))
  );

-- Glossary: public read
CREATE POLICY "Anyone can read glossary" ON public.glossary_terms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage glossary" ON public.glossary_terms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'firm_admin'));

-- Audit logs: read by admins, insert by all
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'firm_admin') OR public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Authenticated users can create audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Status history
CREATE POLICY "Access status history" ON public.status_history
  FOR ALL TO authenticated
  USING (assignment_id IN (SELECT id FROM public.valuation_assignments WHERE organization_id = public.get_user_org_id(auth.uid())));

-- ==================== STORAGE BUCKETS ====================

INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

CREATE POLICY "Authenticated users can upload attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('attachments', 'signatures'));

CREATE POLICY "Authenticated users can view attachments" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id IN ('attachments', 'reports', 'signatures', 'logos'));

CREATE POLICY "Public can view logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

-- ============================================================
-- MIGRATION: supabase/migrations/20260328204646_4640f895-a03a-4f62-93c1-39d95ac3ac86.sql
-- ============================================================

-- Fix overly permissive audit log insert policy
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated users can create audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- MIGRATION: supabase/migrations/20260328204744_2a4235ab-82f4-4f30-aae8-20de73c392a4.sql
-- ============================================================

-- ==================== DASHBOARD & REPORTING VIEWS ====================

-- Assignment pipeline summary
CREATE OR REPLACE VIEW public.v_assignment_pipeline AS
SELECT
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count
FROM public.valuation_assignments
GROUP BY status;

-- Recent assignments with details
CREATE OR REPLACE VIEW public.v_recent_assignments AS
SELECT
  a.id, a.reference_number, a.status, a.property_type, a.purpose,
  a.valuation_date, a.created_at, a.priority, a.is_locked,
  c.name_ar as client_name_ar, c.name_en as client_name_en,
  s.city_ar as property_city, s.district_ar as property_district,
  s.land_area,
  p_valuer.full_name_ar as valuer_name_ar,
  p_reviewer.full_name_ar as reviewer_name_ar,
  r.final_value
FROM public.valuation_assignments a
LEFT JOIN public.clients c ON a.client_id = c.id
LEFT JOIN public.subjects s ON s.assignment_id = a.id
LEFT JOIN public.profiles p_valuer ON a.assigned_valuer_id = p_valuer.user_id
LEFT JOIN public.profiles p_reviewer ON a.assigned_reviewer_id = p_reviewer.user_id
LEFT JOIN public.reconciliation_results r ON r.assignment_id = a.id
ORDER BY a.created_at DESC;

-- Compliance summary per assignment
CREATE OR REPLACE VIEW public.v_compliance_summary AS
SELECT
  assignment_id,
  COUNT(*) as total_checks,
  COUNT(*) FILTER (WHERE is_passed = true) as passed,
  COUNT(*) FILTER (WHERE is_passed = false AND is_mandatory = true) as mandatory_failures,
  CASE
    WHEN COUNT(*) FILTER (WHERE is_passed = false AND is_mandatory = true) = 0 THEN true
    ELSE false
  END as ready_for_issuance
FROM public.compliance_checks
GROUP BY assignment_id;

-- Review findings summary
CREATE OR REPLACE VIEW public.v_review_summary AS
SELECT
  assignment_id,
  COUNT(*) as total_findings,
  COUNT(*) FILTER (WHERE severity = 'critical' AND is_resolved = false) as open_critical,
  COUNT(*) FILTER (WHERE severity = 'major' AND is_resolved = false) as open_major,
  COUNT(*) FILTER (WHERE is_resolved = true) as resolved,
  CASE
    WHEN COUNT(*) FILTER (WHERE severity IN ('critical', 'major') AND is_resolved = false) = 0 THEN true
    ELSE false
  END as review_clear
FROM public.review_findings
GROUP BY assignment_id;

-- ============================================================
-- MIGRATION: supabase/migrations/20260328204804_ce89c780-48bc-46a9-8002-184508e0140d.sql
-- ============================================================

-- Fix security definer views by setting them to SECURITY INVOKER
ALTER VIEW public.v_assignment_pipeline SET (security_invoker = on);
ALTER VIEW public.v_recent_assignments SET (security_invoker = on);
ALTER VIEW public.v_compliance_summary SET (security_invoker = on);
ALTER VIEW public.v_review_summary SET (security_invoker = on);

-- ============================================================
-- MIGRATION: supabase/migrations/20260328211524_bbae5893-c719-444c-8675-c649f45b54d1.sql
-- ============================================================

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

-- ============================================================
-- MIGRATION: supabase/migrations/20260328212833_de0d20ab-fbd8-4ff2-b805-f015b3d7f73c.sql
-- ============================================================

-- Add payment structure columns to valuation_requests
ALTER TABLE public.valuation_requests 
  ADD COLUMN IF NOT EXISTS payment_structure text DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS first_payment_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS first_payment_percentage numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS draft_report_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS final_report_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quotation_approved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS production_started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- ============================================================
-- MIGRATION: supabase/migrations/20260328220429_bb68287d-5f86-4401-bfd5-b079554a86c3.sql
-- ============================================================

-- Create payments table for online payment tracking
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.valuation_requests(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.valuation_assignments(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  payment_stage text NOT NULL DEFAULT 'first' CHECK (payment_stage IN ('first', 'final', 'full')),
  payment_method text CHECK (payment_method IN ('mada', 'visa', 'mastercard', 'applepay', 'manual', NULL)),
  gateway_name text NOT NULL DEFAULT 'moyasar',
  transaction_id text,
  gateway_response_json jsonb,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'manual_review')),
  payment_reference text,
  checkout_url text,
  callback_url text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  notes text,
  is_mock boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Clients can view their own payments
CREATE POLICY "Clients view own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (
    request_id IN (
      SELECT id FROM public.valuation_requests WHERE client_user_id = auth.uid()
    )
  );

-- Clients can create payments for their requests
CREATE POLICY "Clients create payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    request_id IN (
      SELECT id FROM public.valuation_requests WHERE client_user_id = auth.uid()
    )
  );

-- Admins can do everything with payments
CREATE POLICY "Admins manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'firm_admin'::app_role)
  );

-- Create payment_webhook_logs table
CREATE TABLE public.payment_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id),
  event_type text NOT NULL,
  raw_payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processing_result text,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view webhook logs" ON public.payment_webhook_logs
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'firm_admin'::app_role)
  );

-- Allow edge functions to insert webhook logs (service role)
CREATE POLICY "Service insert webhook logs" ON public.payment_webhook_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime for payments
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

-- ============================================================
-- MIGRATION: supabase/migrations/20260328220448_bbd922ca-aff2-4c1b-9fae-6060e178e684.sql
-- ============================================================

-- Fix overly permissive INSERT policy on payment_webhook_logs
DROP POLICY "Service insert webhook logs" ON public.payment_webhook_logs;

-- Only admins and authenticated users creating related payments can insert logs
CREATE POLICY "Authenticated insert webhook logs" ON public.payment_webhook_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'firm_admin'::app_role) OR
    payment_id IN (
      SELECT p.id FROM public.payments p
      JOIN public.valuation_requests vr ON p.request_id = vr.id
      WHERE vr.client_user_id = auth.uid()
    )
  );

-- ============================================================
-- MIGRATION: supabase/migrations/20260328222121_6c617150-d70b-47c6-9bd1-653139cd9dc8.sql
-- ============================================================

-- Report revision comments table
CREATE TABLE public.report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.valuation_requests(id),
  assignment_id uuid REFERENCES public.valuation_assignments(id),
  author_id uuid,
  author_type text NOT NULL DEFAULT 'client' CHECK (author_type IN ('client', 'admin', 'valuer', 'reviewer', 'system')),
  section_key text,
  comment_text text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  report_version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;

-- Clients can view/create comments on their own requests
CREATE POLICY "Clients access own report comments" ON public.report_comments
  FOR ALL TO authenticated
  USING (
    request_id IN (SELECT id FROM valuation_requests WHERE client_user_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'firm_admin')
    OR has_role(auth.uid(), 'valuer')
    OR has_role(auth.uid(), 'reviewer')
  );

-- Report change log table
CREATE TABLE public.report_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  version_from integer NOT NULL,
  version_to integer NOT NULL,
  change_type text NOT NULL DEFAULT 'revision' CHECK (change_type IN ('revision', 'client_comment', 'internal_correction', 'post_issuance_correction', 'addendum')),
  changed_by uuid,
  change_summary_ar text,
  change_summary_en text,
  related_comment_id uuid REFERENCES public.report_comments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access report change log" ON public.report_change_log
  FOR ALL TO authenticated
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      JOIN valuation_assignments a ON r.assignment_id = a.id
      WHERE a.organization_id = get_user_org_id(auth.uid())
    )
    OR report_id IN (
      SELECT r.id FROM reports r
      JOIN valuation_assignments a ON r.assignment_id = a.id
      JOIN valuation_requests vr ON vr.assignment_id = a.id
      WHERE vr.client_user_id = auth.uid()
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_report_comments_updated_at
  BEFORE UPDATE ON public.report_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION: supabase/migrations/20260328223658_cbf97002-68ab-4fbc-8701-216d8c718df5.sql
-- ============================================================

-- Inspector profiles table
CREATE TABLE public.inspector_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  cities_ar text[] DEFAULT '{}',
  cities_en text[] DEFAULT '{}',
  regions_ar text[] DEFAULT '{}',
  regions_en text[] DEFAULT '{}',
  availability_status text NOT NULL DEFAULT 'available',
  max_concurrent_tasks integer DEFAULT 5,
  current_workload integer DEFAULT 0,
  specializations text[] DEFAULT '{}',
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.inspector_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inspector profiles" ON public.inspector_profiles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Inspectors view own profile" ON public.inspector_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Add assigned_inspector_id to valuation_assignments
ALTER TABLE public.valuation_assignments
  ADD COLUMN assigned_inspector_id uuid REFERENCES auth.users(id);

-- Inspector reassignment log
CREATE TABLE public.inspector_reassignment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  previous_inspector_id uuid,
  new_inspector_id uuid NOT NULL,
  reason text,
  reassigned_by uuid NOT NULL,
  inspection_was_started boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspector_reassignment_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reassignment log" ON public.inspector_reassignment_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Inspectors view own reassignments" ON public.inspector_reassignment_log
  FOR SELECT TO authenticated
  USING (previous_inspector_id = auth.uid() OR new_inspector_id = auth.uid());

-- Update trigger for inspector_profiles
CREATE TRIGGER update_inspector_profiles_updated_at
  BEFORE UPDATE ON public.inspector_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION: supabase/migrations/20260328224149_69841c28-5ac0-4c3f-952c-e7c7d3a26f2f.sql
-- ============================================================

-- Reference cities table for Saudi Arabia
CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  region_ar text,
  region_en text,
  latitude numeric,
  longitude numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read cities" ON public.cities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cities" ON public.cities FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- Districts table
CREATE TABLE public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  latitude numeric,
  longitude numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read districts" ON public.districts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage districts" ON public.districts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- Inspector coverage areas (links inspectors to cities/districts with optional GPS radius)
CREATE TABLE public.inspector_coverage_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector_profile_id uuid NOT NULL REFERENCES public.inspector_profiles(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL,
  coverage_radius_km numeric DEFAULT 50,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inspector_profile_id, city_id, district_id)
);

ALTER TABLE public.inspector_coverage_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coverage" ON public.inspector_coverage_areas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));
CREATE POLICY "Inspectors view own coverage" ON public.inspector_coverage_areas FOR SELECT TO authenticated
  USING (inspector_profile_id IN (SELECT id FROM public.inspector_profiles WHERE user_id = auth.uid()));

-- Add GPS and performance fields to inspector_profiles
ALTER TABLE public.inspector_profiles
  ADD COLUMN IF NOT EXISTS home_latitude numeric,
  ADD COLUMN IF NOT EXISTS home_longitude numeric,
  ADD COLUMN IF NOT EXISTS avg_response_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_completion_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_score numeric DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS total_completed integer DEFAULT 0;

-- Seed major Saudi cities
INSERT INTO public.cities (name_ar, name_en, region_ar, region_en, latitude, longitude) VALUES
  ('الرياض', 'Riyadh', 'منطقة الرياض', 'Riyadh Region', 24.7136, 46.6753),
  ('جدة', 'Jeddah', 'منطقة مكة المكرمة', 'Makkah Region', 21.4858, 39.1925),
  ('مكة المكرمة', 'Makkah', 'منطقة مكة المكرمة', 'Makkah Region', 21.3891, 39.8579),
  ('المدينة المنورة', 'Madinah', 'منطقة المدينة المنورة', 'Madinah Region', 24.4539, 39.6142),
  ('الدمام', 'Dammam', 'المنطقة الشرقية', 'Eastern Province', 26.3927, 49.9777),
  ('الخبر', 'Khobar', 'المنطقة الشرقية', 'Eastern Province', 26.2172, 50.1971),
  ('الظهران', 'Dhahran', 'المنطقة الشرقية', 'Eastern Province', 26.2361, 50.0393),
  ('بريدة', 'Buraidah', 'منطقة القصيم', 'Qassim Region', 26.3260, 43.9750),
  ('تبوك', 'Tabuk', 'منطقة تبوك', 'Tabuk Region', 28.3838, 36.5550),
  ('أبها', 'Abha', 'منطقة عسير', 'Asir Region', 18.2164, 42.5053),
  ('خميس مشيط', 'Khamis Mushait', 'منطقة عسير', 'Asir Region', 18.3063, 42.7353),
  ('الطائف', 'Taif', 'منطقة مكة المكرمة', 'Makkah Region', 21.2703, 40.4158),
  ('حائل', 'Hail', 'منطقة حائل', 'Hail Region', 27.5114, 41.7208),
  ('نجران', 'Najran', 'منطقة نجران', 'Najran Region', 17.4933, 44.1277),
  ('جازان', 'Jazan', 'منطقة جازان', 'Jazan Region', 16.8892, 42.5611),
  ('ينبع', 'Yanbu', 'منطقة المدينة المنورة', 'Madinah Region', 24.0895, 38.0618),
  ('الجبيل', 'Jubail', 'المنطقة الشرقية', 'Eastern Province', 27.0046, 49.6225),
  ('الأحساء', 'Al Ahsa', 'المنطقة الشرقية', 'Eastern Province', 25.3648, 49.5876);

-- Haversine distance function for GPS matching
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians((lon2 - lon1) / 2)), 2)
  ))
$$;

-- ============================================================
-- MIGRATION: supabase/migrations/20260328224210_2aeac3bf-3767-4e9b-bdde-19cf8070030c.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians((lon2 - lon1) / 2)), 2)
  ))
$$;

-- ============================================================
-- MIGRATION: supabase/migrations/20260328224702_d9bfab5c-a75d-4f3c-a443-89cac951245e.sql
-- ============================================================

-- Add status tracking to inspections (richer than boolean completed)
ALTER TABLE public.inspections 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'assigned',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gps_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_saved_data jsonb;

-- Inspection checklist items
CREATE TABLE IF NOT EXISTS public.inspection_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  category text NOT NULL,
  label_ar text NOT NULL,
  label_en text,
  is_checked boolean DEFAULT false,
  is_required boolean DEFAULT true,
  value text,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access checklist via inspection"
  ON public.inspection_checklist_items FOR ALL TO authenticated
  USING (
    inspection_id IN (
      SELECT i.id FROM inspections i
      JOIN valuation_assignments a ON i.assignment_id = a.id
      WHERE a.organization_id = get_user_org_id(auth.uid())
    )
    OR inspection_id IN (
      SELECT id FROM inspections WHERE inspector_id = auth.uid()
    )
  );

-- Inspection photos table
CREATE TABLE IF NOT EXISTS public.inspection_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  category text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  caption_ar text,
  caption_en text,
  latitude numeric,
  longitude numeric,
  taken_at timestamptz DEFAULT now(),
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access photos via inspection"
  ON public.inspection_photos FOR ALL TO authenticated
  USING (
    inspection_id IN (
      SELECT i.id FROM inspections i
      JOIN valuation_assignments a ON i.assignment_id = a.id
      WHERE a.organization_id = get_user_org_id(auth.uid())
    )
    OR inspection_id IN (
      SELECT id FROM inspections WHERE inspector_id = auth.uid()
    )
  );

-- Storage bucket for inspection photos
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Inspectors upload photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inspection-photos');

CREATE POLICY "Authenticated read inspection photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'inspection-photos');

-- ============================================================
-- MIGRATION: supabase/migrations/20260328225155_199af647-cafa-40ac-b71c-6abd2acb613c.sql
-- ============================================================

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

-- ============================================================
-- MIGRATION: supabase/migrations/20260328225626_6dc7ab64-9dcc-4b77-8ef2-7a8c530c7423.sql
-- ============================================================

-- Inspection analysis results table
CREATE TABLE public.inspection_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  
  -- AI extracted condition data
  condition_rating text DEFAULT 'good',
  condition_score numeric DEFAULT 5.0,
  finishing_level text DEFAULT 'standard',
  quality_score numeric DEFAULT 5.0,
  maintenance_level text DEFAULT 'average',
  environment_quality text DEFAULT 'good',
  
  -- Detailed findings
  visible_defects jsonb DEFAULT '[]'::jsonb,
  risk_flags jsonb DEFAULT '[]'::jsonb,
  adjustment_factors jsonb DEFAULT '{}'::jsonb,
  
  -- Photo analysis
  photo_analysis jsonb DEFAULT '[]'::jsonb,
  
  -- Combined structured output
  checklist_summary jsonb DEFAULT '{}'::jsonb,
  inspector_notes_summary text,
  
  -- AI reasoning
  ai_reasoning_ar text,
  ai_reasoning_en text,
  ai_model_used text,
  ai_confidence numeric DEFAULT 0.8,
  
  -- Depreciation inputs for valuation
  physical_depreciation_pct numeric DEFAULT 0,
  functional_obsolescence_pct numeric DEFAULT 0,
  external_obsolescence_pct numeric DEFAULT 0,
  condition_adjustment_pct numeric DEFAULT 0,
  
  -- Override
  is_overridden boolean DEFAULT false,
  override_by uuid,
  override_at timestamptz,
  override_notes text,
  original_ai_data jsonb,
  
  -- Status
  status text DEFAULT 'pending' NOT NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(inspection_id)
);

-- RLS
ALTER TABLE public.inspection_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access inspection analysis via assignment"
ON public.inspection_analysis FOR ALL TO authenticated
USING (
  assignment_id IN (
    SELECT id FROM public.valuation_assignments 
    WHERE organization_id = get_user_org_id(auth.uid())
  )
  OR
  inspection_id IN (
    SELECT id FROM public.inspections WHERE inspector_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_inspection_analysis_updated_at
  BEFORE UPDATE ON public.inspection_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION: supabase/migrations/20260328230443_22542ce6-41b2-45af-8f04-9bd5797a3755.sql
-- ============================================================

-- Add signature_hash to report_signatures
ALTER TABLE public.report_signatures ADD COLUMN IF NOT EXISTS signature_hash text;

-- Add locked fields to reports table
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS locked_by uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS superseded_by uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS previous_version_id uuid;

-- Add signature_hash to reports for quick verification
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS signature_hash text;

-- Create trigger to prevent editing locked reports
CREATE OR REPLACE FUNCTION public.prevent_locked_report_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.is_locked = true AND OLD.is_final = true THEN
    -- Allow only superseded_by to be set
    IF NEW.superseded_by IS DISTINCT FROM OLD.superseded_by THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a locked final report. Create a new version instead.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_report_edit ON public.reports;
CREATE TRIGGER trg_prevent_locked_report_edit
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_report_edit();

-- Create trigger to prevent editing locked assignment data
CREATE OR REPLACE FUNCTION public.prevent_locked_assignment_data_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  is_assignment_locked boolean;
BEGIN
  SELECT va.is_locked INTO is_assignment_locked
  FROM public.valuation_assignments va
  WHERE va.id = COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  IF is_assignment_locked = true THEN
    RAISE EXCEPTION 'Cannot modify data for a locked assignment. The report has been issued.';
  END IF;
  RETURN NEW;
END;
$$;

-- Protect subjects from edits when assignment is locked
DROP TRIGGER IF EXISTS trg_lock_subjects ON public.subjects;
CREATE TRIGGER trg_lock_subjects
  BEFORE UPDATE OR DELETE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_assignment_data_edit();

-- Protect valuation_methods from edits when assignment is locked
DROP TRIGGER IF EXISTS trg_lock_valuation_methods ON public.valuation_methods;
CREATE TRIGGER trg_lock_valuation_methods
  BEFORE UPDATE OR DELETE ON public.valuation_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_assignment_data_edit();

-- Protect reconciliation_results from edits when assignment is locked
DROP TRIGGER IF EXISTS trg_lock_reconciliation ON public.reconciliation_results;
CREATE TRIGGER trg_lock_reconciliation
  BEFORE UPDATE OR DELETE ON public.reconciliation_results
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_assignment_data_edit();

-- Create report_verification_log for tracking public verifications
CREATE TABLE IF NOT EXISTS public.report_verification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  ip_address text,
  user_agent text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL DEFAULT 'valid'
);

ALTER TABLE public.report_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert verification log"
  ON public.report_verification_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view verification log"
  ON public.report_verification_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'firm_admin'::app_role));

-- ============================================================
-- MIGRATION: supabase/migrations/20260328231151_eeda30e8-b01e-4a14-86bf-33e6b7dc41cb.sql
-- ============================================================

-- Create valuation_type enum
CREATE TYPE public.valuation_type AS ENUM ('real_estate', 'machinery', 'mixed');

-- Add valuation_type to valuation_assignments
ALTER TABLE public.valuation_assignments ADD COLUMN IF NOT EXISTS valuation_type public.valuation_type NOT NULL DEFAULT 'real_estate';

-- Add valuation_type to valuation_requests
ALTER TABLE public.valuation_requests ADD COLUMN IF NOT EXISTS valuation_type public.valuation_type DEFAULT 'real_estate';

-- Create subjects_machinery table
CREATE TABLE IF NOT EXISTS public.subjects_machinery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  asset_name_ar text NOT NULL,
  asset_name_en text,
  asset_category text NOT NULL DEFAULT 'general',
  manufacturer text,
  model text,
  serial_number text,
  year_manufactured integer,
  year_installed integer,
  condition text DEFAULT 'good',
  condition_score numeric,
  remaining_useful_life integer,
  total_useful_life integer DEFAULT 15,
  original_cost numeric,
  replacement_cost numeric,
  capacity text,
  specifications jsonb DEFAULT '{}',
  location_ar text,
  location_en text,
  description_ar text,
  description_en text,
  photo_urls text[] DEFAULT '{}',
  is_operational boolean DEFAULT true,
  depreciation_method text DEFAULT 'straight_line',
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects_machinery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access machinery subjects via assignment"
  ON public.subjects_machinery
  FOR ALL
  TO authenticated
  USING (
    assignment_id IN (
      SELECT id FROM public.valuation_assignments
      WHERE organization_id = get_user_org_id(auth.uid())
    )
  );

-- Lock trigger for machinery subjects
DROP TRIGGER IF EXISTS trg_lock_subjects_machinery ON public.subjects_machinery;
CREATE TRIGGER trg_lock_subjects_machinery
  BEFORE UPDATE OR DELETE ON public.subjects_machinery
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_assignment_data_edit();

-- Create machinery valuation methods table for separate calc results
CREATE TABLE IF NOT EXISTS public.machinery_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  subject_machinery_id uuid NOT NULL,
  approach text NOT NULL DEFAULT 'cost',
  replacement_cost_new numeric,
  physical_depreciation_pct numeric DEFAULT 0,
  functional_obsolescence_pct numeric DEFAULT 0,
  economic_obsolescence_pct numeric DEFAULT 0,
  concluded_value numeric DEFAULT 0,
  market_comparable_value numeric,
  income_value numeric,
  weight_cost numeric DEFAULT 0.7,
  weight_market numeric DEFAULT 0.2,
  weight_income numeric DEFAULT 0.1,
  final_value numeric DEFAULT 0,
  audit_trail jsonb DEFAULT '[]',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.machinery_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access machinery valuations via assignment"
  ON public.machinery_valuations
  FOR ALL
  TO authenticated
  USING (
    assignment_id IN (
      SELECT id FROM public.valuation_assignments
      WHERE organization_id = get_user_org_id(auth.uid())
    )
  );

-- ============================================================
-- MIGRATION: supabase/migrations/20260328232817_c5a21043-61b1-4cbc-9cdc-e03d0edf451c.sql
-- ============================================================

-- Portfolio assets table
CREATE TABLE IF NOT EXISTS public.portfolio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.valuation_requests(id) ON DELETE CASCADE,
  asset_type text NOT NULL DEFAULT 'real_estate',
  asset_category text NOT NULL DEFAULT 'land',
  asset_name_ar text NOT NULL,
  asset_name_en text,
  city_ar text,
  city_en text,
  district_ar text,
  district_en text,
  address_ar text,
  address_en text,
  land_area numeric,
  building_area numeric,
  description_ar text,
  description_en text,
  attributes jsonb DEFAULT '{}',
  ai_extracted boolean DEFAULT false,
  ai_confidence numeric,
  status text DEFAULT 'pending',
  assignment_id uuid,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients access own portfolio assets"
  ON public.portfolio_assets
  FOR ALL
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM public.valuation_requests
      WHERE client_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'firm_admin')
    OR has_role(auth.uid(), 'valuer')
  );

-- Add portfolio fields to valuation_requests
ALTER TABLE public.valuation_requests
  ADD COLUMN IF NOT EXISTS is_portfolio boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS portfolio_asset_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portfolio_discount_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portfolio_scope_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS portfolio_scope_ar text,
  ADD COLUMN IF NOT EXISTS portfolio_scope_en text;

-- ============================================================
-- MIGRATION: supabase/migrations/20260328233726_553daf61-f183-4781-916a-080ce210ac8a.sql
-- ============================================================

-- Add report lifecycle fields
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- Add assignment_type and retrospective fields to valuation_assignments
DO $$ BEGIN
  CREATE TYPE public.assignment_type AS ENUM ('new', 'revaluation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.valuation_assignments
  ADD COLUMN IF NOT EXISTS assignment_type text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS previous_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS valuation_date date,
  ADD COLUMN IF NOT EXISTS is_retrospective boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retrospective_note_ar text,
  ADD COLUMN IF NOT EXISTS retrospective_note_en text;

-- Add version_type to report_versions for tracking change reason
ALTER TABLE public.report_versions
  ADD COLUMN IF NOT EXISTS version_type text DEFAULT 'revision',
  ADD COLUMN IF NOT EXISTS reason_ar text,
  ADD COLUMN IF NOT EXISTS reason_en text;

-- ============================================================
-- MIGRATION: supabase/migrations/20260329004005_e62d4a88-5a16-474b-9332-64ef0bb5208c.sql
-- ============================================================

-- Raqeem Knowledge Base: Admin-uploaded documents
CREATE TABLE public.raqeem_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  source_type text NOT NULL DEFAULT 'document',
  file_path text,
  file_name text,
  priority integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Raqeem Corrections: Admin corrections to AI responses
CREATE TABLE public.raqeem_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_question text NOT NULL,
  original_answer text NOT NULL,
  corrected_answer text NOT NULL,
  correction_reason text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  corrected_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Raqeem Rules: Admin-defined instructions and rules
CREATE TABLE public.raqeem_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_title_ar text NOT NULL,
  rule_title_en text,
  rule_content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Raqeem Audit Log: Track all knowledge changes
CREATE TABLE public.raqeem_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  details jsonb,
  performed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.raqeem_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raqeem_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raqeem_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raqeem_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can manage knowledge
CREATE POLICY "Admins manage raqeem knowledge" ON public.raqeem_knowledge
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Admins manage raqeem corrections" ON public.raqeem_corrections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Admins manage raqeem rules" ON public.raqeem_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Admins view raqeem audit" ON public.raqeem_audit_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- All authenticated users can read active knowledge (for chat context)
CREATE POLICY "Authenticated read active knowledge" ON public.raqeem_knowledge
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated read active corrections" ON public.raqeem_corrections
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated read active rules" ON public.raqeem_rules
  FOR SELECT TO authenticated
  USING (is_active = true);

-- ============================================================
-- MIGRATION: supabase/migrations/20260329004658_3f5a0acb-e2bc-402d-99f6-2d8a7bc25fbd.sql
-- ============================================================

-- Test Sessions: Track AI test runs
CREATE TABLE public.raqeem_test_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL,
  test_type text NOT NULL DEFAULT 'accuracy',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_questions integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  accuracy_score numeric NOT NULL DEFAULT 0,
  notes text,
  tested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Performance snapshots for trend tracking
CREATE TABLE public.raqeem_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  total_corrections integer NOT NULL DEFAULT 0,
  total_knowledge_docs integer NOT NULL DEFAULT 0,
  total_rules integer NOT NULL DEFAULT 0,
  total_tests integer NOT NULL DEFAULT 0,
  avg_accuracy numeric NOT NULL DEFAULT 0,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add correction_type to corrections table
ALTER TABLE public.raqeem_corrections
  ADD COLUMN IF NOT EXISTS correction_type text DEFAULT 'reasoning';

-- Add file upload support columns to knowledge
ALTER TABLE public.raqeem_knowledge
  ADD COLUMN IF NOT EXISTS file_size integer,
  ADD COLUMN IF NOT EXISTS mime_type text;

-- Enable RLS
ALTER TABLE public.raqeem_test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raqeem_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins manage test sessions" ON public.raqeem_test_sessions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Admins manage performance snapshots" ON public.raqeem_performance_snapshots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- ============================================================
-- MIGRATION: supabase/migrations/20260329081318_07e4d945-d1e9-459b-b127-209ac141c74c.sql
-- ============================================================

-- Drop restrictive admin-only policies on raqeem tables
DROP POLICY IF EXISTS "Admins manage raqeem rules" ON public.raqeem_rules;
DROP POLICY IF EXISTS "Authenticated read active rules" ON public.raqeem_rules;
DROP POLICY IF EXISTS "Admins manage raqeem corrections" ON public.raqeem_corrections;
DROP POLICY IF EXISTS "Authenticated read active corrections" ON public.raqeem_corrections;
DROP POLICY IF EXISTS "Admins manage raqeem knowledge" ON public.raqeem_knowledge;
DROP POLICY IF EXISTS "Authenticated read active knowledge" ON public.raqeem_knowledge;

-- Allow any authenticated user full access to raqeem tables
CREATE POLICY "Authenticated users manage raqeem rules"
  ON public.raqeem_rules FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users manage raqeem corrections"
  ON public.raqeem_corrections FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users manage raqeem knowledge"
  ON public.raqeem_knowledge FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Also allow anon SELECT so the edge function (raqeem-chat) can read
CREATE POLICY "Anon read raqeem rules"
  ON public.raqeem_rules FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Anon read raqeem corrections"
  ON public.raqeem_corrections FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Anon read raqeem knowledge"
  ON public.raqeem_knowledge FOR SELECT TO anon
  USING (is_active = true);

-- ============================================================
-- MIGRATION: supabase/migrations/20260329092514_93db67d9-2181-42df-8ef4-59651ff144fa.sql
-- ============================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inspector';
-- ============================================================
-- MIGRATION: supabase/migrations/20260329102459_f8a2cbe8-0082-4289-9554-a3f8136cd971.sql
-- ============================================================
-- Add account_status and user_type to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'external';

-- Create role_change_log table
CREATE TABLE IF NOT EXISTS public.role_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  old_role text,
  new_role text NOT NULL,
  changed_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage role change log" ON public.role_change_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- Allow admins to view all profiles for client management
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- Allow admins to update any profile (for suspend/activate)
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- Allow admins to manage all user_roles
CREATE POLICY "Admins manage all user roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

-- Allow users to view their own role
CREATE POLICY "Users view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Allow users to view their own profile (regardless of org)
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- MIGRATION: supabase/migrations/20260329102816_cca37cc2-5b2a-41f1-93f5-dc3d258e499a.sql
-- ============================================================
-- Add client classification fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS client_value_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_category text DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS client_category_manual boolean DEFAULT false;

-- ============================================================
-- MIGRATION: supabase/migrations/20260329103121_1b723482-a971-4601-8a62-a9b516123b4d.sql
-- ============================================================
-- Create inspector_evaluations table for ratings and evaluations
CREATE TABLE IF NOT EXISTS public.inspector_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector_user_id uuid NOT NULL,
  evaluator_id uuid,
  evaluation_type text NOT NULL DEFAULT 'internal',
  rating numeric NOT NULL DEFAULT 0,
  speed_score numeric DEFAULT 0,
  quality_score numeric DEFAULT 0,
  completion_score numeric DEFAULT 0,
  satisfaction_score numeric DEFAULT 0,
  notes text,
  assignment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspector_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage evaluations" ON public.inspector_evaluations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'firm_admin'));

CREATE POLICY "Inspectors view own evaluations" ON public.inspector_evaluations
  FOR SELECT TO authenticated
  USING (inspector_user_id = auth.uid());

-- Add classification and scoring fields to inspector_profiles
ALTER TABLE public.inspector_profiles
  ADD COLUMN IF NOT EXISTS inspector_category text DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS overall_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_satisfaction numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corrections_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS management_notes text;

-- ============================================================
-- MIGRATION: supabase/migrations/20260329123140_2dbff6d7-a3b6-4589-9aaa-63f8d7e57370.sql
-- ============================================================
-- Add inspector-specific RLS policy for inspections table
-- Inspectors should be able to SELECT and UPDATE their own inspections
CREATE POLICY "Inspectors access own inspections"
ON public.inspections
FOR ALL
TO authenticated
USING (inspector_id = auth.uid())
WITH CHECK (inspector_id = auth.uid());
-- ============================================================
-- MIGRATION: supabase/migrations/20260329135316_edefadaf-3a57-48eb-8ea9-9da81f99be60.sql
-- ============================================================
UPDATE public.user_roles SET role = 'firm_admin' WHERE user_id = 'd578a1bb-9a99-4744-b1fc-ea046a09334f';
-- ============================================================
-- MIGRATION: supabase/migrations/20260331085137_9ff1791e-2656-4cf7-a737-de38be4fb01d.sql
-- ============================================================

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

-- ============================================================
-- MIGRATION: supabase/migrations/20260402051735_c05533b7-8345-4238-8406-aef86d65f95c.sql
-- ============================================================

UPDATE raqeem_knowledge SET title_ar = 'المعايير الدولية للتقييم' WHERE id = 'faf0dc40-4343-4b00-a70f-f7816ea79ad2';
UPDATE raqeem_knowledge SET title_ar = 'المعايير العالمية لتقييم المعهد الملكي للمساحين القانونيين' WHERE id = '5f1b4996-25cf-4c4d-9c48-86ec0d0cd45a';
UPDATE raqeem_knowledge SET title_ar = 'الأساسات' WHERE id = 'fbde457a-6ed7-49f1-957e-6c6b32210a39';
UPDATE raqeem_knowledge SET title_ar = 'إرشادات التعامل مع التباين' WHERE id = '3fe6aa8a-3b9d-4066-b592-08687dff12ea';
UPDATE raqeem_knowledge SET title_ar = 'الدليل المهني لأعمال التقييم لأغراض نزع ملكية العقارات للمنفعة العامة' WHERE id = '3f32676e-282b-441e-8422-d50eb9076986';
UPDATE raqeem_knowledge SET title_ar = 'المدد الزمنية للأحكام الانتقالية وقواعد الزمالة في اللائحة التنفيذية' WHERE id = '44b7315b-a44e-4c3f-b2ad-4a8e1bf5afd7';
UPDATE raqeem_knowledge SET title_ar = 'الدليل الإرشادي لمعالجة الأخطاء المهنية في تقارير التقييم' WHERE id = 'ea93e02c-c13c-47cc-9e14-9cbc3c2ec68d';
UPDATE raqeem_knowledge SET title_ar = 'تقييم الآلات والمعدات' WHERE id = '4ab4bbb5-be6d-4303-9065-0e5e39325ef0';
UPDATE raqeem_knowledge SET title_ar = 'دليل الممارسة المهنية للتقييم العقاري' WHERE id = '5564a80a-3bbe-435d-a3c3-b04ad62433f2';
UPDATE raqeem_knowledge SET title_ar = 'دليل مراجعة التقييم' WHERE id = '1183eb3c-fda6-452f-ac09-32ef46ae7005';
UPDATE raqeem_knowledge SET title_ar = 'تقييم العقارات البلدية' WHERE id = 'a639ddc3-de7d-41d4-b47e-54c96618ca8b';
UPDATE raqeem_knowledge SET title_ar = 'سياسات التقييم' WHERE id = 'c56a9a4a-62c9-416c-bf6e-07687e5b550c';
UPDATE raqeem_knowledge SET title_ar = 'مراجعة لدليل تقارير التقييم' WHERE id = '6a453118-a772-4001-a40d-c69bd2c24fb6';
UPDATE raqeem_knowledge SET title_ar = 'قائمة المصطلحات الدولية: تقييم المنشآت الاقتصادية' WHERE id = '4df28966-d6fc-455f-bd0a-89d3719e7c88';
UPDATE raqeem_knowledge SET title_ar = 'الشهادات المهنية في التقييم - دليل تفاعلي 2022' WHERE id = 'cf8395e1-e3f0-41a1-9cf1-a393accb00f5';
UPDATE raqeem_knowledge SET title_ar = 'دور القيمة المتبقية في معدات الإيجار' WHERE id = '679a86df-ad56-4a21-80d4-cba30e4acf1e';
UPDATE raqeem_knowledge SET title_ar = 'تقييم الآلات والمعدات لأغراض التمويل المضمون' WHERE id = '747c0971-3f2e-4c0a-aa93-52090ee5a585';
UPDATE raqeem_knowledge SET title_ar = 'تقرير مراجعة تقييم الآلات والمعدات لغرض البيع' WHERE id = '20a2dd92-8fd7-4676-9d8f-5966d6100e65';
UPDATE raqeem_knowledge SET title_ar = 'مواكبة تطورات الذكاء الاصطناعي في مجال التقييم: الفرص والمخاطر والمعايير' WHERE id = '8a382e8b-4028-4ff4-8a09-de998bf70fb1';
UPDATE raqeem_knowledge SET title_ar = 'إتقان عملية التقييم: فهم المخاطر - تقييم طبقاً لمعايير التقييم الدولية' WHERE id = '00a34250-8e09-46da-86af-e58e3c83a924';
UPDATE raqeem_knowledge SET title_ar = 'تحليل التدهور في الآلات والمعدات' WHERE id = '7957f5b8-7071-476a-9263-27341b7f33f0';
UPDATE raqeem_knowledge SET title_ar = 'الحوكمة والاستدامة والعوامل البيئية والاجتماعية في مجال التقييم العقاري في المملكة' WHERE id = '446cab30-1edf-446b-9920-2b45a5d04737';
UPDATE raqeem_knowledge SET title_ar = 'تقييم محطات الطاقة الشمسية' WHERE id = '72feff82-7ba4-417c-b836-069fb8ed0832';
UPDATE raqeem_knowledge SET title_ar = 'العوامل البيئية والاجتماعية والحوكمة وتأثيرها على التقييم في الإمارات العربية المتحدة' WHERE id = '095fad2b-7eb2-42e7-bafd-d5c858b22810';
UPDATE raqeem_knowledge SET title_ar = 'تقييم العقارات لأغراض التأمين' WHERE id = 'bfefd48a-15e2-45d5-83cf-71f576d21039';
UPDATE raqeem_knowledge SET title_ar = 'فرص تعزيز إطار عمل هبوط قيمة الشهرة التجارية' WHERE id = 'fe94f8a9-4c34-4e1e-8980-337fab361464';
UPDATE raqeem_knowledge SET title_ar = 'ورقة رأي في: تعريف القيمة الاجتماعية وتقديرها' WHERE id = '040b8b07-a9da-45e0-ac08-057b151b4c17';
UPDATE raqeem_knowledge SET title_ar = 'الفن وتثمين الممتلكات الشخصية بما يتماشى مع معايير التقييم الدولية' WHERE id = 'bb30e01f-f4cc-42ad-8566-07c2196cdbad';
UPDATE raqeem_knowledge SET title_ar = 'تقييم العقارات التاريخية وأساليب وطرق التقييم المستخدمة لهذا النوع من العقارات' WHERE id = '806d1156-a3dd-4831-be6d-a2b0764167ce';
UPDATE raqeem_knowledge SET title_ar = 'هل الشهرة التجارية أصل مستهلك؟' WHERE id = 'a0f9ebbf-7bc3-480f-b8f9-fe9c8e83f4f2';
UPDATE raqeem_knowledge SET title_ar = 'العوامل البيئية والاجتماعية والحوكمة وتقييم العقارات والشركات' WHERE id = '68b278c4-1990-41f2-ba20-0b9d2ce2b382';
UPDATE raqeem_knowledge SET title_ar = 'الإرشادات لتقييم الممتلكات الزراعية' WHERE id = 'ebeac74f-b5df-4917-b1fe-9fecdb2b475e';
-- Fixed reversed titles
UPDATE raqeem_knowledge SET title_ar = 'التقييمات السكنية ونماذج التقييم الآلية' WHERE id = 'b2b945dc-f3e5-46e6-95c7-6ba8864d3514';
UPDATE raqeem_knowledge SET title_ar = 'الجزء الثالث: إعادة التفكير في قيمة العلامة التجارية - معرفة الأصول غير الملموسة' WHERE id = '2ce14005-9aba-4114-81c0-ef2260c53995';
UPDATE raqeem_knowledge SET title_ar = 'تقييم الملكية الفكرية' WHERE id = '531348a0-70cb-47a3-b635-bccdb7fa18df';
UPDATE raqeem_knowledge SET title_ar = 'معاينة الأصول الملموسة في إطار عملية التقييم' WHERE id = '749f7c9c-0e1c-4282-a565-c5b43d1ece92';
UPDATE raqeem_knowledge SET title_ar = 'مؤشرات الاقتصاد الكلي لتقييم العقارات' WHERE id = 'c6ea80cf-cc02-43b5-a172-14d35905895c';
UPDATE raqeem_knowledge SET title_ar = 'أساسيات تقييم الطائرات' WHERE id = '7142c519-45ac-4bcb-af70-cb0d67f46fb3';
UPDATE raqeem_knowledge SET title_ar = 'سد الفجوة: استكشاف التباين بين أسواق العقارات العامة والخاصة' WHERE id = 'e5313726-4a43-4caa-b2f7-6e1f032a643e';
UPDATE raqeem_knowledge SET title_ar = 'دليل تقييم الإيجار السوقي لأبراج الاتصالات' WHERE id = 'fc2dad48-45e0-4715-869f-83692f080679';
UPDATE raqeem_knowledge SET title_ar = 'تعريف القيمة الاجتماعية وتقديرها - الجزء الثاني' WHERE id = 'aac72386-b0be-4724-b2f1-057817a76e88';

-- ============================================================
-- MIGRATION: supabase/migrations/20260402101504_65016321-da57-4547-bf39-e179804db3cd.sql
-- ============================================================

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

-- ============================================================
-- MIGRATION: supabase/migrations/20260402114719_2a934daa-6dff-462e-9480-b5fb7287241b.sql
-- ============================================================

-- Add taqeem_machinery field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS taqeem_membership_machinery text;

-- Create organization_settings table for report/system/integration settings
CREATE TABLE public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(organization_id, category)
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Owner/admin can read their org settings
CREATE POLICY "Users can read own org settings" ON public.organization_settings
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Owner can write org settings
CREATE POLICY "Owner can manage org settings" ON public.organization_settings
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND public.has_role(auth.uid(), 'owner')
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND public.has_role(auth.uid(), 'owner')
);

-- Create storage bucket for settings uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('settings-uploads', 'settings-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to settings-uploads
CREATE POLICY "Authenticated users can upload settings files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'settings-uploads');

CREATE POLICY "Anyone can view settings files" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'settings-uploads');

CREATE POLICY "Users can update own settings files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'settings-uploads');

CREATE POLICY "Users can delete own settings files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'settings-uploads');

-- ============================================================
-- MIGRATION: supabase/migrations/20260402185129_email_infra.sql
-- ============================================================
-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');

-- ============================================================
-- MIGRATION: supabase/migrations/20260402201927_ab500821-a8c9-4944-a7a7-50ed1b6eebdc.sql
-- ============================================================

-- Create discount_codes table
CREATE TABLE public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_percentage NUMERIC(5,2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  description TEXT,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Owner can do everything (using profiles table to check user_type = 'owner')
CREATE POLICY "Owners can manage discount codes"
  ON public.discount_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND user_type = 'owner')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND user_type = 'owner')
  );

-- All authenticated users can read active discount codes (for validation)
CREATE POLICY "Authenticated users can read active codes"
  ON public.discount_codes
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================================
-- MIGRATION: supabase/migrations/20260402202752_f9dd6a71-54c2-432b-b179-1ac210da715f.sql
-- ============================================================

DROP POLICY "Owners can manage discount codes" ON public.discount_codes;

CREATE POLICY "Owners can manage discount codes"
  ON public.discount_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ============================================================
-- MIGRATION: supabase/migrations/20260402210752_9adedcdb-ed0a-40a9-a925-9115a95608fd.sql
-- ============================================================

-- Create archived_reports table
CREATE TABLE public.archived_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID REFERENCES public.clients(id),
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  report_number TEXT,
  report_title_ar TEXT,
  report_title_en TEXT,
  report_type TEXT DEFAULT 'real_estate',
  report_date DATE,
  property_type TEXT,
  property_city_ar TEXT,
  property_district_ar TEXT,
  property_address_ar TEXT,
  client_name_ar TEXT,
  ai_extracted_data JSONB DEFAULT '{}'::jsonb,
  ai_confidence NUMERIC DEFAULT 0,
  is_indexed BOOLEAN DEFAULT false,
  notes TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.archived_reports ENABLE ROW LEVEL SECURITY;

-- Org members (owner + coordinator) can manage
CREATE POLICY "Admins manage archived reports"
  ON public.archived_reports FOR ALL
  TO authenticated
  USING (
    (organization_id = get_user_org_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  )
  WITH CHECK (
    (organization_id = get_user_org_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  );

-- Clients can view reports linked to them
CREATE POLICY "Clients view their archived reports"
  ON public.archived_reports FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('archived-reports', 'archived-reports', false);

-- Storage policies
CREATE POLICY "Admins upload archived reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'archived-reports' 
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  );

CREATE POLICY "Admins read archived reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'archived-reports' 
    AND (
      has_role(auth.uid(), 'owner'::app_role) 
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR auth.uid() IN (
        SELECT u.id FROM auth.users u
        JOIN public.clients c ON c.email = u.email
        JOIN public.archived_reports ar ON ar.client_id = c.id
        WHERE ar.file_path LIKE '%' || name
      )
    )
  );

CREATE POLICY "Admins delete archived reports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'archived-reports' 
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  );

-- Updated_at trigger
CREATE TRIGGER update_archived_reports_updated_at
  BEFORE UPDATE ON public.archived_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION: supabase/migrations/20260402211557_d09ce7b2-d27a-4e94-a619-895abb23488d.sql
-- ============================================================
UPDATE profiles SET organization_id = '52bbe5b4-9de2-4a8d-a156-cbfebed01686' WHERE user_id = 'd578a1bb-9a99-4744-b1fc-ea046a09334f' AND organization_id IS NULL;
-- ============================================================
-- MIGRATION: supabase/migrations/20260402211913_3b71a46d-7e23-425f-8bdd-b6c725e3a65e.sql
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_reports TO authenticated;
GRANT SELECT ON public.archived_reports TO anon;
-- ============================================================
-- MIGRATION: supabase/migrations/20260402212132_8dbe1ada-7d51-44e2-ae87-ecc37a2a265f.sql
-- ============================================================
GRANT ALL ON public.archived_reports TO authenticated;
GRANT ALL ON public.archived_reports TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
-- ============================================================
-- MIGRATION: supabase/migrations/20260402212236_9510d85f-e43e-4457-a5c4-aafbaa7fedf6.sql
-- ============================================================
NOTIFY pgrst, 'reload schema';
-- ============================================================
-- MIGRATION: supabase/migrations/20260402212321_9d02427a-c381-4c0b-87e9-7a89f494a050.sql
-- ============================================================
DROP POLICY IF EXISTS "Admins manage archived reports" ON public.archived_reports;
DROP POLICY IF EXISTS "Clients view their archived reports" ON public.archived_reports;

CREATE POLICY "authenticated_select_archived_reports" ON public.archived_reports
FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_archived_reports" ON public.archived_reports
FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)
);

CREATE POLICY "authenticated_update_archived_reports" ON public.archived_reports
FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)
);

CREATE POLICY "authenticated_delete_archived_reports" ON public.archived_reports
FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)
);
-- ============================================================
-- MIGRATION: supabase/migrations/20260402212536_c6e8aa8a-f8c8-4a3e-aab5-ea1e877d16c5.sql
-- ============================================================
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own role" ON public.user_roles;

CREATE POLICY "Users and coordinators view roles" ON public.user_roles
FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'owner'::app_role)
  OR has_role(auth.uid(), 'admin_coordinator'::app_role)
);
-- ============================================================
-- MIGRATION: supabase/migrations/20260404070454_a8f28318-613e-4e47-a991-eb53d4b1ee16.sql
-- ============================================================

-- 1. Fix archived_reports SELECT policy: restrict by organization
DROP POLICY IF EXISTS "authenticated_select_archived_reports" ON public.archived_reports;
CREATE POLICY "authenticated_select_archived_reports" ON public.archived_reports
  FOR SELECT TO authenticated
  USING (
    organization_id = get_user_org_id(auth.uid())
    OR uploaded_by = auth.uid()
    OR client_id IN (SELECT c.id FROM clients c WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- 2. Fix raqeem_knowledge: restrict write to owner/admin
DROP POLICY IF EXISTS "Authenticated users manage raqeem knowledge" ON public.raqeem_knowledge;
CREATE POLICY "Admins manage raqeem knowledge" ON public.raqeem_knowledge
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));

-- 3. Fix raqeem_rules: restrict write to owner/admin
DROP POLICY IF EXISTS "Authenticated users manage raqeem rules" ON public.raqeem_rules;
CREATE POLICY "Admins manage raqeem rules" ON public.raqeem_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));

-- 4. Fix raqeem_corrections: restrict write to owner/admin
DROP POLICY IF EXISTS "Authenticated users manage raqeem corrections" ON public.raqeem_corrections;
CREATE POLICY "Admins manage raqeem corrections" ON public.raqeem_corrections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role));

-- 5. Fix report_templates SELECT: restrict by organization
DROP POLICY IF EXISTS "Authenticated users can view report templates" ON public.report_templates;
CREATE POLICY "Org members can view report templates" ON public.report_templates
  FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) OR organization_id IS NULL);

-- 6. Fix discount_codes SELECT: restrict to admins only
DROP POLICY IF EXISTS "Authenticated users can read active codes" ON public.discount_codes;
CREATE POLICY "Admins can read discount codes" ON public.discount_codes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role) OR has_role(auth.uid(), 'financial_manager'::app_role));

-- 7. Fix storage: attachments/reports/signatures - restrict by org
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
CREATE POLICY "Org members can view attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    OR (bucket_id IN ('attachments', 'reports', 'signatures') AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'financial_manager'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    ))
  );

-- 8. Fix storage: inspection-photos - restrict to org/inspector
DROP POLICY IF EXISTS "Authenticated read inspection photos" ON storage.objects;
CREATE POLICY "Org or inspector read inspection photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inspection-photos' AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    )
  );

-- 9. Fix storage: client-uploads - restrict to own uploads or admins
DROP POLICY IF EXISTS "Users can view own uploads" ON storage.objects;
CREATE POLICY "Users can view own uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-uploads' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
    )
  );

-- 10. Fix function search_path for email queue functions
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

-- ============================================================
-- MIGRATION: supabase/migrations/20260404070628_68f8040d-5508-4db8-a006-96bf18fc9eb3.sql
-- ============================================================

-- 1. Fix client-uploads INSERT: scope to user's own folder
DROP POLICY IF EXISTS "Clients can upload files" ON storage.objects;
CREATE POLICY "Clients can upload files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-uploads' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Fix attachments/signatures INSERT: restrict to admin/inspector roles
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Staff can upload attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('attachments', 'signatures') AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    )
  );

-- 3. Fix inspection-photos INSERT: restrict to inspectors
DROP POLICY IF EXISTS "Inspectors upload photos" ON storage.objects;
CREATE POLICY "Inspectors upload photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos' AND has_role(auth.uid(), 'inspector'::app_role)
  );

-- 4. Fix settings-uploads UPDATE/DELETE: restrict to admins
DROP POLICY IF EXISTS "Users can delete own settings files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own settings files" ON storage.objects;
CREATE POLICY "Admins manage settings files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'settings-uploads' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)))
  WITH CHECK (bucket_id = 'settings-uploads' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)));

CREATE POLICY "Admins delete settings files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'settings-uploads' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)));

-- 5. Remove anonymous access to raqeem tables
DROP POLICY IF EXISTS "Anon read raqeem knowledge" ON public.raqeem_knowledge;
DROP POLICY IF EXISTS "Anon read raqeem rules" ON public.raqeem_rules;
DROP POLICY IF EXISTS "Anon read raqeem corrections" ON public.raqeem_corrections;

-- Add authenticated-only read policies for raqeem
CREATE POLICY "Authenticated read raqeem knowledge" ON public.raqeem_knowledge
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Authenticated read raqeem rules" ON public.raqeem_rules
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Authenticated read raqeem corrections" ON public.raqeem_corrections
  FOR SELECT TO authenticated USING (is_active = true);

-- ============================================================
-- MIGRATION: supabase/migrations/20260404070648_661d36f1-e7ee-4a4d-ad66-5abbef4aa48a.sql
-- ============================================================

-- The report_verification_log INSERT with true is intentional for public verification
-- But we should at least rate-limit by requiring anon role explicitly
DROP POLICY IF EXISTS "Anyone can insert verification log" ON public.report_verification_log;
CREATE POLICY "Anyone can insert verification log" ON public.report_verification_log
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ============================================================
-- MIGRATION: supabase/migrations/20260404070746_a3f3c8c9-8ce3-4907-9bce-17180a6844a0.sql
-- ============================================================

-- 1. Fix settings-uploads INSERT: restrict to admins
DROP POLICY IF EXISTS "Authenticated users can upload settings files" ON storage.objects;
CREATE POLICY "Admins upload settings files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'settings-uploads' AND (
      has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin_coordinator'::app_role)
    )
  );

-- 2. Add DELETE policy for inspection-photos
CREATE POLICY "Admins or inspector delete inspection photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'inspection-photos' AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    )
  );

-- ============================================================
-- MIGRATION: supabase/migrations/20260404070844_d856370c-21c6-411e-b842-a50aed7d1a4f.sql
-- ============================================================

-- 1. Allow clients to read their own reports
CREATE POLICY "Clients can view own reports" ON public.reports
  FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT vr.assignment_id FROM valuation_requests vr
      WHERE vr.client_user_id = auth.uid() AND vr.assignment_id IS NOT NULL
    )
  );

-- 2. Allow financial_manager to read client-uploads
DROP POLICY IF EXISTS "Users can view own uploads" ON storage.objects;
CREATE POLICY "Users can view own uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-uploads' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'financial_manager'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    )
  );

-- 3. Allow clients to download their report PDFs from storage
DROP POLICY IF EXISTS "Org members can view attachments" ON storage.objects;
CREATE POLICY "Org members and clients view attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    OR (bucket_id IN ('attachments', 'reports', 'signatures') AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin_coordinator'::app_role)
      OR has_role(auth.uid(), 'financial_manager'::app_role)
      OR has_role(auth.uid(), 'inspector'::app_role)
    ))
    OR (bucket_id = 'reports' AND EXISTS (
      SELECT 1 FROM valuation_requests vr
      JOIN valuation_assignments va ON va.id = vr.assignment_id
      WHERE vr.client_user_id = auth.uid()
    ))
  );

-- 4. Allow clients to read attachments for their assignments
CREATE POLICY "Clients can view own attachments" ON public.attachments
  FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT vr.assignment_id FROM valuation_requests vr
      WHERE vr.client_user_id = auth.uid() AND vr.assignment_id IS NOT NULL
    )
  );

-- ============================================================
-- MIGRATION: supabase/migrations/20260404072930_661eba28-bf49-4e85-9dc1-190cf4806bd2.sql
-- ============================================================

-- Add valuation_mode to valuation_requests
ALTER TABLE public.valuation_requests 
ADD COLUMN IF NOT EXISTS valuation_mode text NOT NULL DEFAULT 'field';

-- Add valuation_mode to valuation_assignments  
ALTER TABLE public.valuation_assignments
ADD COLUMN IF NOT EXISTS valuation_mode text NOT NULL DEFAULT 'field';

-- Add desktop_disclaimer_accepted to valuation_requests (client acknowledgment)
ALTER TABLE public.valuation_requests
ADD COLUMN IF NOT EXISTS desktop_disclaimer_accepted boolean DEFAULT false;

-- Add desktop_evidence_notes to valuation_assignments (evaluator's evidence justification)
ALTER TABLE public.valuation_assignments
ADD COLUMN IF NOT EXISTS desktop_evidence_notes text;

-- ============================================================
-- MIGRATION: supabase/migrations/20260404104219_6dab67cb-2fa6-427a-ad5b-1a61121d51ce.sql
-- ============================================================
ALTER TABLE public.valuation_requests
  ADD COLUMN IF NOT EXISTS discipline text DEFAULT 'real_estate',
  ADD COLUMN IF NOT EXISTS purpose_ar text,
  ADD COLUMN IF NOT EXISTS value_basis_ar text,
  ADD COLUMN IF NOT EXISTS valuation_date date,
  ADD COLUMN IF NOT EXISTS client_name_ar text,
  ADD COLUMN IF NOT EXISTS client_id_number text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS intended_user_ar text,
  ADD COLUMN IF NOT EXISTS asset_data jsonb;
-- ============================================================
-- MIGRATION: supabase/migrations/20260405165030_55414830-f6c1-4800-943d-4c1ace89da83.sql
-- ============================================================

-- Processing Jobs table
CREATE TABLE public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','uploading','classifying','extracting','deduplicating','merging','ready','failed','cancelled')),
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  total_assets_found INTEGER NOT NULL DEFAULT 0,
  duplicates_found INTEGER NOT NULL DEFAULT 0,
  low_confidence_count INTEGER NOT NULL DEFAULT 0,
  missing_fields_count INTEGER NOT NULL DEFAULT 0,
  current_message TEXT,
  error_message TEXT,
  file_manifest JSONB DEFAULT '[]'::jsonb,
  processing_log JSONB DEFAULT '[]'::jsonb,
  discipline TEXT DEFAULT 'real_estate',
  description TEXT,
  ai_summary JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extracted Assets table
CREATE TABLE public.extracted_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.processing_jobs(id) ON DELETE CASCADE NOT NULL,
  asset_index INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'real_estate' CHECK (asset_type IN ('real_estate','machinery_equipment')),
  category TEXT,
  subcategory TEXT,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT DEFAULT 'unknown',
  confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  asset_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_files JSONB DEFAULT '[]'::jsonb,
  source_evidence TEXT,
  duplicate_group TEXT,
  duplicate_status TEXT DEFAULT 'unique' CHECK (duplicate_status IN ('unique','potential_duplicate','confirmed_duplicate','merged')),
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending','approved','needs_review','rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  missing_fields TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- File Classifications table
CREATE TABLE public.file_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.processing_jobs(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  document_category TEXT NOT NULL DEFAULT 'other',
  document_purpose TEXT,
  language TEXT DEFAULT 'ar',
  relevance TEXT DEFAULT 'medium' CHECK (relevance IN ('high','medium','low')),
  contains_assets BOOLEAN DEFAULT false,
  extracted_info TEXT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending','processing','completed','failed','skipped')),
  error_message TEXT,
  confidence INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_processing_jobs_user ON public.processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_status ON public.processing_jobs(status);
CREATE INDEX idx_extracted_assets_job ON public.extracted_assets(job_id);
CREATE INDEX idx_extracted_assets_review ON public.extracted_assets(review_status);
CREATE INDEX idx_extracted_assets_duplicate ON public.extracted_assets(duplicate_status);
CREATE INDEX idx_file_classifications_job ON public.file_classifications(job_id);

-- Updated_at triggers
CREATE TRIGGER update_processing_jobs_updated_at BEFORE UPDATE ON public.processing_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_extracted_assets_updated_at BEFORE UPDATE ON public.extracted_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_classifications ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see own jobs, admins can see all
CREATE POLICY "Users view own processing jobs" ON public.processing_jobs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'));
CREATE POLICY "Users create own processing jobs" ON public.processing_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own processing jobs" ON public.processing_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'));

-- RLS: Assets follow job ownership
CREATE POLICY "Users view own extracted assets" ON public.extracted_assets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));
CREATE POLICY "Users insert own extracted assets" ON public.extracted_assets FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));
CREATE POLICY "Users update own extracted assets" ON public.extracted_assets FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));
CREATE POLICY "Users delete own extracted assets" ON public.extracted_assets FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));

-- RLS: File classifications follow job ownership
CREATE POLICY "Users view own file classifications" ON public.file_classifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));
CREATE POLICY "Users insert own file classifications" ON public.file_classifications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));
CREATE POLICY "Users update own file classifications" ON public.file_classifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.processing_jobs pj WHERE pj.id = job_id AND (pj.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin_coordinator'))));

-- Enable realtime for processing jobs (for live status tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE public.processing_jobs;

-- ============================================================
-- MIGRATION: supabase/migrations/20260405170150_f8a6578a-5f0a-49b0-a30c-b7129bc95e2c.sql
-- ============================================================

-- Asset edit audit log for traceability
CREATE TABLE IF NOT EXISTS public.asset_edit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.extracted_assets(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.processing_jobs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_edit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own edit logs"
  ON public.asset_edit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own edit logs"
  ON public.asset_edit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Add request_id index on processing_jobs if not exists
CREATE INDEX IF NOT EXISTS idx_processing_jobs_request_id ON public.processing_jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id ON public.processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_extracted_assets_job_id ON public.extracted_assets(job_id);
CREATE INDEX IF NOT EXISTS idx_file_classifications_job_id ON public.file_classifications(job_id);
CREATE INDEX IF NOT EXISTS idx_asset_edit_logs_asset_id ON public.asset_edit_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_edit_logs_job_id ON public.asset_edit_logs(job_id);

-- ============================================================
-- MIGRATION: supabase/migrations/20260405180631_6f845378-03c7-4406-93f4-7d055640d8ce.sql
-- ============================================================

-- Add enforcement columns to raqeem_rules
ALTER TABLE public.raqeem_rules 
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'warning',
  ADD COLUMN IF NOT EXISTS enforcement_stage text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rule_type text NOT NULL DEFAULT 'checklist',
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.raqeem_knowledge(id) ON DELETE SET NULL;

-- Create compliance_check_results for per-assignment rule enforcement
CREATE TABLE IF NOT EXISTS public.compliance_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.valuation_assignments(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.raqeem_rules(id) ON DELETE CASCADE,
  stage text NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  violation_message text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by text DEFAULT 'system',
  UNIQUE(assignment_id, rule_id, stage)
);

ALTER TABLE public.compliance_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read compliance results"
  ON public.compliance_check_results FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System and owners can insert compliance results"
  ON public.compliance_check_results FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "System and owners can update compliance results"
  ON public.compliance_check_results FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- MIGRATION: supabase/migrations/20260405183704_4bbcd1c9-0c5e-49dc-bb75-b88299ece128.sql
-- ============================================================
ALTER TABLE public.raqeem_rules
  ADD COLUMN IF NOT EXISTS applicable_asset_type text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS condition_text text,
  ADD COLUMN IF NOT EXISTS requirement_text text,
  ADD COLUMN IF NOT EXISTS impact_type text NOT NULL DEFAULT 'warning';

COMMENT ON COLUMN public.raqeem_rules.applicable_asset_type IS 'real_estate, machinery, or both';
COMMENT ON COLUMN public.raqeem_rules.condition_text IS 'When this rule applies (Arabic)';
COMMENT ON COLUMN public.raqeem_rules.requirement_text IS 'What must be satisfied (Arabic)';
COMMENT ON COLUMN public.raqeem_rules.impact_type IS 'warning, risk, confidence_reduction, or blocking';
-- ============================================================
-- MIGRATION: supabase/migrations/20260405184050_00b754f8-15e4-4736-8577-2898d8cbf840.sql
-- ============================================================
CREATE TABLE public.knowledge_rebuild_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  total_documents integer NOT NULL DEFAULT 0,
  processed_documents integer NOT NULL DEFAULT 0,
  total_rules_extracted integer NOT NULL DEFAULT 0,
  total_rules_inserted integer NOT NULL DEFAULT 0,
  duplicates_removed integer NOT NULL DEFAULT 0,
  critical_rules integer NOT NULL DEFAULT 0,
  warning_rules integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT 'system'
);

ALTER TABLE public.knowledge_rebuild_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rebuild jobs"
ON public.knowledge_rebuild_jobs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert rebuild jobs"
ON public.knowledge_rebuild_jobs FOR INSERT TO authenticated
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_rebuild_jobs;
-- ============================================================
-- MIGRATION: supabase/migrations/20260405192723_45570087-0f8c-443b-baa7-aaf41c84366f.sql
-- ============================================================

-- Add client_status and portal_user_id to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_status text NOT NULL DEFAULT 'potential',
  ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add constraint for valid statuses
ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check CHECK (client_status IN ('potential', 'verified', 'portal'));

-- Index for fast matching
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_portal_user ON public.clients(portal_user_id) WHERE portal_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_cr_number ON public.clients(cr_number) WHERE cr_number IS NOT NULL;

-- Function to find matching client by phone, email, or cr_number
CREATE OR REPLACE FUNCTION public.match_client_record(
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _name_ar text DEFAULT NULL,
  _cr_number text DEFAULT NULL,
  _org_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  matched_id uuid;
BEGIN
  -- Priority 1: phone match
  IF _phone IS NOT NULL AND _phone != '' THEN
    SELECT id INTO matched_id FROM public.clients
    WHERE phone = _phone AND (_org_id IS NULL OR organization_id = _org_id)
    LIMIT 1;
    IF matched_id IS NOT NULL THEN RETURN matched_id; END IF;
  END IF;

  -- Priority 2: email match
  IF _email IS NOT NULL AND _email != '' THEN
    SELECT id INTO matched_id FROM public.clients
    WHERE email = _email AND (_org_id IS NULL OR organization_id = _org_id)
    LIMIT 1;
    IF matched_id IS NOT NULL THEN RETURN matched_id; END IF;
  END IF;

  -- Priority 3: cr_number match (companies)
  IF _cr_number IS NOT NULL AND _cr_number != '' THEN
    SELECT id INTO matched_id FROM public.clients
    WHERE cr_number = _cr_number AND (_org_id IS NULL OR organization_id = _org_id)
    LIMIT 1;
    IF matched_id IS NOT NULL THEN RETURN matched_id; END IF;
  END IF;

  -- Priority 4: exact name match
  IF _name_ar IS NOT NULL AND _name_ar != '' THEN
    SELECT id INTO matched_id FROM public.clients
    WHERE name_ar = _name_ar AND (_org_id IS NULL OR organization_id = _org_id)
    LIMIT 1;
    IF matched_id IS NOT NULL THEN RETURN matched_id; END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- Function to link a portal user to an existing client record
CREATE OR REPLACE FUNCTION public.link_portal_user_to_client(
  _user_id uuid,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _name_ar text DEFAULT NULL,
  _org_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  matched_id uuid;
BEGIN
  -- Check if already linked
  SELECT id INTO matched_id FROM public.clients
  WHERE portal_user_id = _user_id
  LIMIT 1;
  IF matched_id IS NOT NULL THEN RETURN matched_id; END IF;

  -- Try to match existing record
  matched_id := public.match_client_record(_phone, _email, _name_ar, NULL, _org_id);

  IF matched_id IS NOT NULL THEN
    -- Link and upgrade status
    UPDATE public.clients
    SET portal_user_id = _user_id,
        client_status = 'portal',
        updated_at = now()
    WHERE id = matched_id AND portal_user_id IS NULL;
    RETURN matched_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Function to find duplicate client records
CREATE OR REPLACE FUNCTION public.find_duplicate_clients(_org_id uuid)
RETURNS TABLE(client_id_1 uuid, client_id_2 uuid, match_field text, match_value text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Phone duplicates
  RETURN QUERY
  SELECT c1.id, c2.id, 'phone'::text, c1.phone
  FROM public.clients c1
  JOIN public.clients c2 ON c1.phone = c2.phone AND c1.id < c2.id
  WHERE c1.organization_id = _org_id
    AND c1.phone IS NOT NULL AND c1.phone != '';

  -- Email duplicates
  RETURN QUERY
  SELECT c1.id, c2.id, 'email'::text, c1.email
  FROM public.clients c1
  JOIN public.clients c2 ON c1.email = c2.email AND c1.id < c2.id
  WHERE c1.organization_id = _org_id
    AND c1.email IS NOT NULL AND c1.email != ''
    AND NOT EXISTS (
      SELECT 1 FROM public.clients a
      JOIN public.clients b ON a.phone = b.phone AND a.id < b.id
      WHERE a.id = c1.id AND b.id = c2.id AND a.phone IS NOT NULL
    );

  -- CR number duplicates
  RETURN QUERY
  SELECT c1.id, c2.id, 'cr_number'::text, c1.cr_number
  FROM public.clients c1
  JOIN public.clients c2 ON c1.cr_number = c2.cr_number AND c1.id < c2.id
  WHERE c1.organization_id = _org_id
    AND c1.cr_number IS NOT NULL AND c1.cr_number != '';
END;
$$;

-- Merge function: move all references from source to target, then deactivate source
CREATE OR REPLACE FUNCTION public.merge_client_records(_target_id uuid, _source_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Move archived reports
  UPDATE public.archived_reports SET client_id = _target_id WHERE client_id = _source_id;

  -- Move valuation assignments
  UPDATE public.valuation_assignments SET client_id = _target_id WHERE client_id = _source_id;

  -- Transfer portal_user_id if source has one and target doesn't
  UPDATE public.clients SET
    portal_user_id = (SELECT portal_user_id FROM public.clients WHERE id = _source_id),
    client_status = 'portal'
  WHERE id = _target_id
    AND portal_user_id IS NULL
    AND (SELECT portal_user_id FROM public.clients WHERE id = _source_id) IS NOT NULL;

  -- Deactivate source
  UPDATE public.clients SET is_active = false, notes = COALESCE(notes, '') || ' [مدمج مع ' || _target_id::text || ']' WHERE id = _source_id;

  RETURN true;
END;
$$;

-- ============================================================
-- MIGRATION: supabase/migrations/20260405193046_20e68f5d-3e73-4a86-a1b3-c0e55d685010.sql
-- ============================================================

-- Create merge log table
CREATE TABLE IF NOT EXISTS public.client_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_client_id uuid NOT NULL REFERENCES public.clients(id),
  source_client_id uuid NOT NULL,
  source_client_name text,
  target_client_name text,
  match_field text,
  match_value text,
  confidence_score integer,
  merged_by uuid REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_merge_log ENABLE ROW LEVEL SECURITY;

-- Only owner/admin can view merge logs
CREATE POLICY "Admin can view merge logs"
  ON public.client_merge_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'admin_coordinator')
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_client_merge_log_target ON public.client_merge_log(target_client_id);

-- Replace match function to return confidence + matched_id
CREATE OR REPLACE FUNCTION public.match_client_with_confidence(
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _name_ar text DEFAULT NULL,
  _cr_number text DEFAULT NULL,
  _org_id uuid DEFAULT NULL
)
RETURNS TABLE(matched_id uuid, confidence integer, match_field text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Priority 1: phone match (high confidence: 95)
  IF _phone IS NOT NULL AND _phone != '' THEN
    RETURN QUERY
    SELECT c.id, 95, 'phone'::text
    FROM public.clients c
    WHERE c.phone = _phone AND (_org_id IS NULL OR c.organization_id = _org_id)
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 2: email match (high confidence: 90)
  IF _email IS NOT NULL AND _email != '' THEN
    RETURN QUERY
    SELECT c.id, 90, 'email'::text
    FROM public.clients c
    WHERE c.email = _email AND (_org_id IS NULL OR c.organization_id = _org_id)
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 3: cr_number match (high confidence: 85)
  IF _cr_number IS NOT NULL AND _cr_number != '' THEN
    RETURN QUERY
    SELECT c.id, 85, 'cr_number'::text
    FROM public.clients c
    WHERE c.cr_number = _cr_number AND (_org_id IS NULL OR c.organization_id = _org_id)
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 4: exact name match (medium confidence: 60)
  IF _name_ar IS NOT NULL AND _name_ar != '' THEN
    RETURN QUERY
    SELECT c.id, 60, 'name'::text
    FROM public.clients c
    WHERE c.name_ar = _name_ar AND (_org_id IS NULL OR c.organization_id = _org_id)
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  RETURN;
END;
$$;

-- Update link function to only auto-link on high confidence (>= 80)
CREATE OR REPLACE FUNCTION public.link_portal_user_to_client(
  _user_id uuid,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _name_ar text DEFAULT NULL,
  _org_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _matched_id uuid;
  _confidence integer;
  _match_field text;
BEGIN
  -- Check if already linked
  SELECT id INTO _matched_id FROM public.clients
  WHERE portal_user_id = _user_id
  LIMIT 1;
  IF _matched_id IS NOT NULL THEN RETURN _matched_id; END IF;

  -- Try to match with confidence
  SELECT m.matched_id, m.confidence, m.match_field
  INTO _matched_id, _confidence, _match_field
  FROM public.match_client_with_confidence(_phone, _email, _name_ar, NULL, _org_id) m
  LIMIT 1;

  -- Only auto-link if confidence >= 80
  IF _matched_id IS NOT NULL AND _confidence >= 80 THEN
    UPDATE public.clients
    SET portal_user_id = _user_id,
        client_status = 'portal',
        updated_at = now()
    WHERE id = _matched_id AND portal_user_id IS NULL;
    RETURN _matched_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Update merge function to log the operation
CREATE OR REPLACE FUNCTION public.merge_client_records(
  _target_id uuid,
  _source_id uuid,
  _merged_by uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _source_name text;
  _target_name text;
BEGIN
  SELECT name_ar INTO _source_name FROM public.clients WHERE id = _source_id;
  SELECT name_ar INTO _target_name FROM public.clients WHERE id = _target_id;

  -- Move archived reports
  UPDATE public.archived_reports SET client_id = _target_id WHERE client_id = _source_id;

  -- Move valuation assignments
  UPDATE public.valuation_assignments SET client_id = _target_id WHERE client_id = _source_id;

  -- Transfer portal_user_id if source has one and target doesn't
  UPDATE public.clients SET
    portal_user_id = (SELECT portal_user_id FROM public.clients WHERE id = _source_id),
    client_status = 'portal'
  WHERE id = _target_id
    AND portal_user_id IS NULL
    AND (SELECT portal_user_id FROM public.clients WHERE id = _source_id) IS NOT NULL;

  -- Deactivate source
  UPDATE public.clients SET is_active = false, notes = COALESCE(notes, '') || ' [مدمج مع ' || _target_id::text || ']' WHERE id = _source_id;

  -- Log the merge
  INSERT INTO public.client_merge_log (target_client_id, source_client_id, source_client_name, target_client_name, merged_by, reason)
  VALUES (_target_id, _source_id, _source_name, _target_name, _merged_by, _reason);

  RETURN true;
END;
$$;

-- ============================================================
-- MIGRATION: supabase/migrations/20260405194015_768257e0-a383-4a00-8e7b-0497ee9d1876.sql
-- ============================================================

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

-- ============================================================
-- MIGRATION: supabase/migrations/20260405194718_2c638636-477c-46f8-a038-cf7752ef46ed.sql
-- ============================================================

-- Add new columns to audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_role text;

-- Add new enum values for audit_action
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'upload';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'merge';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'link';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'generate';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'override';

-- Block UPDATE and DELETE on audit_logs (read-only after insert)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Drop existing policies and recreate stricter ones
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.audit_logs;

-- Owner and financial_manager can read
CREATE POLICY "Owner and financial can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

-- Any authenticated user can insert (to log their own actions)
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE policies (enforced by trigger too)

-- ============================================================
-- MIGRATION: supabase/migrations/20260405195239_949c2239-9839-44a2-b443-74155a0c602a.sql
-- ============================================================

-- Enhance discount_codes table
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'percentage';
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS fixed_amount numeric DEFAULT 0;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS min_order_amount numeric DEFAULT 0;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS max_uses_per_client integer DEFAULT NULL;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS applicable_services text[] DEFAULT NULL;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) DEFAULT NULL;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS first_time_only boolean DEFAULT false;

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  assignment_id uuid REFERENCES public.valuation_assignments(id),
  client_id uuid REFERENCES public.clients(id),
  organization_id uuid REFERENCES public.organizations(id),
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_code_id uuid REFERENCES public.discount_codes(id),
  vat_percentage numeric NOT NULL DEFAULT 15,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  payment_status text NOT NULL DEFAULT 'draft',
  due_date date,
  paid_at timestamptz,
  sent_at timestamptz,
  notes_ar text,
  notes_en text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Auto-generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_prefix TEXT;
  next_seq INTEGER;
BEGIN
  year_prefix := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1 INTO next_seq
  FROM public.invoices
  WHERE invoice_number LIKE 'INV-' || year_prefix || '-%';
  NEW.invoice_number := 'INV-' || year_prefix || '-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_number ON public.invoices;
CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.generate_invoice_number();

-- Pricing rules table
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL UNIQUE,
  label_ar text NOT NULL,
  label_en text,
  base_fee numeric NOT NULL DEFAULT 3500,
  inspection_fee numeric NOT NULL DEFAULT 500,
  complexity_multiplier numeric NOT NULL DEFAULT 1.0,
  income_analysis_fee numeric NOT NULL DEFAULT 0,
  description_ar text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- Commercial settings (single row)
CREATE TABLE IF NOT EXISTS public.commercial_settings (
  id integer PRIMARY KEY DEFAULT 1,
  report_release_policy text NOT NULL DEFAULT 'anytime',
  vat_percentage numeric NOT NULL DEFAULT 15,
  allow_partial_payment boolean NOT NULL DEFAULT false,
  default_payment_terms_ar text DEFAULT 'الدفع مطلوب خلال 7 أيام من تاريخ إصدار عرض السعر',
  default_validity_days integer NOT NULL DEFAULT 14,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.commercial_settings ENABLE ROW LEVEL SECURITY;

-- Discount usage log
CREATE TABLE IF NOT EXISTS public.discount_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id),
  client_id uuid REFERENCES public.clients(id),
  assignment_id uuid REFERENCES public.valuation_assignments(id),
  discount_applied numeric NOT NULL DEFAULT 0,
  used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_usage_log ENABLE ROW LEVEL SECURITY;

-- Insert default pricing rules
INSERT INTO public.pricing_rules (service_type, label_ar, label_en, base_fee, inspection_fee, income_analysis_fee)
VALUES
  ('real_estate', 'تقييم عقاري', 'Real Estate Valuation', 3500, 500, 1000),
  ('machinery', 'تقييم آلات ومعدات', 'Machinery & Equipment', 4000, 750, 0),
  ('mixed', 'تقييم مختلط', 'Mixed Valuation', 5000, 750, 1000),
  ('revaluation', 'إعادة تقييم', 'Revaluation', 2000, 0, 0),
  ('report_copy', 'نسخة تقرير / تحديث', 'Report Copy / Update', 500, 0, 0)
ON CONFLICT (service_type) DO NOTHING;

-- Insert default commercial settings
INSERT INTO public.commercial_settings (id, report_release_policy, vat_percentage)
VALUES (1, 'anytime', 15)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for invoices
CREATE POLICY "Owner and financial can manage invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'financial_manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'financial_manager')
  );

-- RLS for pricing_rules
CREATE POLICY "Anyone authenticated can view pricing rules"
  ON public.pricing_rules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owner can manage pricing rules"
  ON public.pricing_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- RLS for commercial_settings
CREATE POLICY "Anyone authenticated can view commercial settings"
  ON public.commercial_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owner can manage commercial settings"
  ON public.commercial_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- RLS for discount_usage_log
CREATE POLICY "Owner can view discount usage"
  ON public.discount_usage_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Authenticated can insert discount usage"
  ON public.discount_usage_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- Validate discount code function
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  _code text,
  _client_id uuid DEFAULT NULL,
  _service_type text DEFAULT NULL,
  _order_amount numeric DEFAULT 0
)
RETURNS TABLE(
  is_valid boolean,
  discount_id uuid,
  discount_type text,
  discount_value numeric,
  calculated_discount numeric,
  rejection_reason text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dc record;
  _client_usage integer;
  _is_first_time boolean;
BEGIN
  -- Find the code
  SELECT * INTO _dc FROM public.discount_codes WHERE code = UPPER(_code) LIMIT 1;
  
  IF _dc IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::numeric, 0::numeric, 'كود الخصم غير موجود'::text;
    RETURN;
  END IF;

  IF NOT _dc.is_active THEN
    RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'كود الخصم غير نشط'::text;
    RETURN;
  END IF;

  IF _dc.expires_at IS NOT NULL AND _dc.expires_at < now() THEN
    RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'كود الخصم منتهي الصلاحية'::text;
    RETURN;
  END IF;

  IF _dc.max_uses IS NOT NULL AND _dc.current_uses >= _dc.max_uses THEN
    RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'تم استنفاد عدد الاستخدامات المسموحة'::text;
    RETURN;
  END IF;

  -- Per-client usage check
  IF _dc.max_uses_per_client IS NOT NULL AND _client_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _client_usage FROM public.discount_usage_log
    WHERE discount_code_id = _dc.id AND client_id = _client_id;
    IF _client_usage >= _dc.max_uses_per_client THEN
      RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'تم تجاوز حد الاستخدام لهذا العميل'::text;
      RETURN;
    END IF;
  END IF;

  -- Client restriction
  IF _dc.client_id IS NOT NULL AND _dc.client_id != _client_id THEN
    RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'كود الخصم مخصص لعميل آخر'::text;
    RETURN;
  END IF;

  -- Service restriction
  IF _dc.applicable_services IS NOT NULL AND array_length(_dc.applicable_services, 1) > 0 THEN
    IF _service_type IS NULL OR NOT (_service_type = ANY(_dc.applicable_services)) THEN
      RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'كود الخصم لا ينطبق على هذه الخدمة'::text;
      RETURN;
    END IF;
  END IF;

  -- Min order amount
  IF _dc.min_order_amount > 0 AND _order_amount < _dc.min_order_amount THEN
    RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 
      'الحد الأدنى للطلب هو ' || _dc.min_order_amount || ' ر.س'::text;
    RETURN;
  END IF;

  -- First-time client check
  IF _dc.first_time_only AND _client_id IS NOT NULL THEN
    SELECT NOT EXISTS(
      SELECT 1 FROM public.valuation_assignments
      WHERE client_id = _client_id AND status NOT IN ('new','cancelled')
      LIMIT 1
    ) INTO _is_first_time;
    IF NOT _is_first_time THEN
      RETURN QUERY SELECT false, _dc.id, NULL::text, 0::numeric, 0::numeric, 'كود الخصم للعملاء الجدد فقط'::text;
      RETURN;
    END IF;
  END IF;

  -- Calculate discount
  IF _dc.discount_type = 'fixed_amount' THEN
    RETURN QUERY SELECT true, _dc.id, 'fixed_amount'::text, _dc.fixed_amount, 
      LEAST(_dc.fixed_amount, _order_amount), NULL::text;
  ELSE
    RETURN QUERY SELECT true, _dc.id, 'percentage'::text, _dc.discount_percentage, 
      ROUND(_order_amount * _dc.discount_percentage / 100, 2), NULL::text;
  END IF;
END;
$$;

-- ============================================================
-- MIGRATION: supabase/migrations/20260405195754_7733c0a3-0e80-4e3a-8e6a-624cc4a52edc.sql
-- ============================================================

-- Expand pricing_rules with subcategories, tiers, and additional pricing fields
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS subcategory text DEFAULT NULL;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS tier_label_ar text DEFAULT NULL;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS tier_min_units integer DEFAULT 1;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS tier_max_units integer DEFAULT NULL;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS per_unit_fee numeric DEFAULT 0;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS surcharge_percentage numeric DEFAULT 0;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS auto_discount_percentage numeric DEFAULT 0;
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Drop unique constraint on service_type to allow subcategories
ALTER TABLE public.pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_service_type_key;

-- Add unique constraint on service_type + subcategory combo
ALTER TABLE public.pricing_rules ADD CONSTRAINT pricing_rules_type_sub_unique UNIQUE (service_type, subcategory) DEFERRABLE INITIALLY DEFERRED;

-- Price override tracking table
CREATE TABLE IF NOT EXISTS public.price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.valuation_assignments(id),
  original_amount numeric NOT NULL,
  override_amount numeric NOT NULL,
  reason_ar text,
  override_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage price overrides"
  ON public.price_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Authenticated can view own overrides"
  ON public.price_overrides FOR SELECT TO authenticated
  USING (true);

-- Clear existing default rules and insert comprehensive matrix
DELETE FROM public.pricing_rules;

INSERT INTO public.pricing_rules (service_type, subcategory, label_ar, label_en, tier_label_ar, base_fee, inspection_fee, income_analysis_fee, per_unit_fee, surcharge_percentage, auto_discount_percentage, sort_order, is_active)
VALUES
  -- Real Estate
  ('real_estate', 'residential',  'تقييم عقاري سكني',    'Residential RE',    NULL, 3500, 500, 1000, 0, 0, 0, 10, true),
  ('real_estate', 'commercial',   'تقييم عقاري تجاري',    'Commercial RE',     NULL, 5000, 750, 1500, 0, 0, 0, 20, true),
  ('real_estate', 'complex',      'تقييم أصول معقدة',     'Complex Assets',    NULL, 8000, 1000, 2000, 0, 0, 0, 30, true),
  ('real_estate', 'additional',   'أصل إضافي (عقاري)',   'Additional RE Asset', NULL, 1500, 250, 0, 0, 0, 0, 35, true),

  -- Machinery & Equipment tiers
  ('machinery', 'tier_1_5',       'آلات ومعدات (1-5)',     'Machinery 1-5',     '1 إلى 5 أصول', 4000, 750, 0, 0, 0, 0, 40, true),
  ('machinery', 'tier_6_20',      'آلات ومعدات (6-20)',    'Machinery 6-20',    '6 إلى 20 أصل', 3500, 500, 0, 500, 0, 0, 50, true),
  ('machinery', 'tier_20_plus',   'آلات ومعدات (20+)',     'Machinery 20+',     'أكثر من 20 أصل', 3000, 500, 0, 350, 0, 0, 60, true),

  -- Mixed
  ('mixed', 'standard',           'تقييم مختلط',           'Mixed Valuation',   NULL, 7000, 1000, 1500, 0, 0, 10, 70, true),

  -- Additional services
  ('revaluation', 'standard',     'إعادة تقييم',           'Revaluation',       NULL, 2000, 0, 0, 0, 0, 0, 80, true),
  ('report_copy', 'standard',     'نسخة تقرير / تحديث',   'Report Copy',       NULL, 500, 0, 0, 0, 0, 0, 90, true),
  ('urgent', 'standard',          'خدمة عاجلة',            'Urgent Service',    NULL, 0, 0, 0, 0, 50, 0, 100, true);

-- Set tier bounds for machinery
UPDATE public.pricing_rules SET tier_min_units = 1, tier_max_units = 5 WHERE service_type = 'machinery' AND subcategory = 'tier_1_5';
UPDATE public.pricing_rules SET tier_min_units = 6, tier_max_units = 20 WHERE service_type = 'machinery' AND subcategory = 'tier_6_20';
UPDATE public.pricing_rules SET tier_min_units = 21, tier_max_units = NULL WHERE service_type = 'machinery' AND subcategory = 'tier_20_plus';

-- ============================================================
-- MIGRATION: supabase/migrations/20260405200252_51c0e8ce-d5ab-4e23-90f5-f2a2354f33db.sql
-- ============================================================
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS vat_number text DEFAULT NULL;
-- ============================================================
-- MIGRATION: supabase/migrations/20260405200534_219a6873-97e3-434d-a801-7dc98883b7e6.sql
-- ============================================================

-- Add manual payment fields to existing payments table
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS payment_proof_path text,
  ADD COLUMN IF NOT EXISTS bank_transfer_ref text,
  ADD COLUMN IF NOT EXISTS client_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- Create payment-proofs storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated users can upload to their own folder
CREATE POLICY "Users upload payment proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can view their own proofs
CREATE POLICY "Users view own payment proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Owners/admins can view all proofs
CREATE POLICY "Admins view all payment proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'owner'));

-- ============================================================
-- MIGRATION: supabase/migrations/20260405200954_cdb99967-29a1-4504-af86-6648f8dbfe3f.sql
-- ============================================================

-- Payment gateway settings table
CREATE TABLE IF NOT EXISTS public.payment_gateway_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'hyperpay',
  is_active boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'test',
  entity_id text,
  entity_id_mada text,
  entity_id_applepay text,
  access_token text,
  enabled_methods text[] NOT NULL DEFAULT ARRAY['mada','visa','mastercard'],
  callback_url text,
  return_url text,
  failure_url text,
  webhook_secret text,
  configuration jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.payment_gateway_settings (provider, is_active, environment)
VALUES ('hyperpay', false, 'test')
ON CONFLICT DO NOTHING;

-- Add HyperPay checkout ID to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS hyperpay_checkout_id text;

-- RLS
ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view gateway settings"
  ON public.payment_gateway_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update gateway settings"
  ON public.payment_gateway_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert gateway settings"
  ON public.payment_gateway_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Updated_at trigger
CREATE TRIGGER update_payment_gateway_settings_updated_at
  BEFORE UPDATE ON public.payment_gateway_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MIGRATION: supabase/migrations/20260405201436_27f36352-33e6-4515-92e5-0192d99dd2ce.sql
-- ============================================================

-- Intelligence source links: connects approved sources to valuation methods
CREATE TABLE public.intelligence_source_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  source_name_ar TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('government', 'market', 'auction', 'cost_database', 'professional_standard')),
  valuation_method TEXT NOT NULL CHECK (valuation_method IN ('comparison', 'income', 'cost', 'all')),
  asset_type TEXT NOT NULL DEFAULT 'all' CHECK (asset_type IN ('real_estate', 'machinery', 'all')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_linked BOOLEAN NOT NULL DEFAULT false,
  linked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intelligence_source_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read source links"
  ON public.intelligence_source_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage source links"
  ON public.intelligence_source_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Seed default links for known sources
INSERT INTO public.intelligence_source_links (source_id, source_name_ar, source_type, valuation_method, asset_type, auto_linked) VALUES
  ('moj', 'وزارة العدل', 'government', 'comparison', 'real_estate', true),
  ('rega', 'الهيئة العامة للعقار', 'government', 'comparison', 'real_estate', true),
  ('real-estate-exchange', 'البورصة العقارية', 'government', 'comparison', 'real_estate', true),
  ('aqar', 'عقار', 'market', 'comparison', 'real_estate', true),
  ('bayut', 'بيوت', 'market', 'comparison', 'real_estate', true),
  ('sakan', 'سكني', 'market', 'comparison', 'real_estate', true),
  ('sama', 'البنك المركزي السعودي', 'government', 'income', 'real_estate', true),
  ('gastat', 'الهيئة العامة للإحصاء', 'government', 'all', 'all', true),
  ('marshall-swift', 'مارشال آند سويفت', 'cost_database', 'cost', 'all', true),
  ('ritchie-brothers', 'ريتشي براذرز', 'auction', 'comparison', 'machinery', true),
  ('bidspotter', 'بيدسبوتر', 'auction', 'comparison', 'machinery', true),
  ('rock-and-dirt', 'روك آند دِرت', 'market', 'comparison', 'machinery', true),
  ('aircraft-bluebook', 'دليل الطائرات الأزرق', 'market', 'comparison', 'machinery', true);

-- ============================================================
-- MIGRATION: supabase/migrations/20260405202512_8ae6b792-dadf-432f-b598-098151bf2890.sql
-- ============================================================

-- Login attempts tracking
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_email ON public.login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_user ON public.login_attempts(user_id, created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view login attempts"
ON public.login_attempts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Security alerts
CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL, -- suspicious_login, brute_force, critical_change, system_error
  severity text NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  title text NOT NULL,
  description text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_alerts_unread ON public.security_alerts(is_read, created_at DESC);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage security alerts"
ON public.security_alerts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Active sessions tracking
CREATE TABLE public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_info text,
  ip_address text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sessions, owners see all"
ON public.active_sessions FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'owner')
);

CREATE POLICY "Users manage own sessions"
ON public.active_sessions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Soft delete: add deleted_at to key tables
ALTER TABLE public.valuation_assignments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Function to detect brute force and create alert
CREATE OR REPLACE FUNCTION public.check_brute_force()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_failures integer;
BEGIN
  IF NEW.success = false THEN
    SELECT COUNT(*) INTO recent_failures
    FROM public.login_attempts
    WHERE email = NEW.email
      AND success = false
      AND created_at > now() - interval '15 minutes';

    IF recent_failures >= 5 THEN
      INSERT INTO public.security_alerts (alert_type, severity, title, description, metadata)
      VALUES (
        'brute_force',
        'high',
        'محاولات دخول متكررة فاشلة',
        'تم رصد ' || (recent_failures + 1) || ' محاولة فاشلة للبريد: ' || NEW.email,
        jsonb_build_object('email', NEW.email, 'ip', NEW.ip_address, 'attempts', recent_failures + 1)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_brute_force
AFTER INSERT ON public.login_attempts
FOR EACH ROW
EXECUTE FUNCTION public.check_brute_force();

-- ============================================================
-- MIGRATION: supabase/migrations/20260405202855_b7e3803b-95a8-4ff8-aac9-1582ce4ca5a4.sql
-- ============================================================

-- System events table for all monitoring data
CREATE TABLE public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb DEFAULT '{}'::jsonb,
  related_entity_id text,
  related_entity_type text,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- System health checks table
CREATE TABLE public.system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text NOT NULL,
  status text NOT NULL DEFAULT 'healthy',
  response_time_ms integer,
  details jsonb DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_system_events_category ON public.system_events(category);
CREATE INDEX idx_system_events_severity ON public.system_events(severity);
CREATE INDEX idx_system_events_created ON public.system_events(created_at DESC);
CREATE INDEX idx_system_events_resolved ON public.system_events(resolved);
CREATE INDEX idx_health_checks_type ON public.system_health_checks(check_type);
CREATE INDEX idx_health_checks_checked ON public.system_health_checks(checked_at DESC);

-- RLS
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

-- Only owner can view system events
CREATE POLICY "Owner can view system events"
  ON public.system_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can insert system events"
  ON public.system_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can update system events"
  ON public.system_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can view health checks"
  ON public.system_health_checks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can insert health checks"
  ON public.system_health_checks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Allow service role (edge functions) to insert
CREATE POLICY "Service can insert system events"
  ON public.system_events FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can insert health checks"
  ON public.system_health_checks FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can select health checks"
  ON public.system_health_checks FOR SELECT TO service_role
  USING (true);

-- ============================================================
-- MIGRATION: supabase/migrations/20260406075405_13b84fcb-76d2-4fff-89d6-7dc243ca80f7.sql
-- ============================================================

CREATE TABLE public.otp_supported_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE,
  country_name_ar text NOT NULL,
  country_name_en text,
  dial_code text NOT NULL,
  otp_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_supported_countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read countries" ON public.otp_supported_countries
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Owners can manage countries" ON public.otp_supported_countries
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.otp_supported_countries (country_code, country_name_ar, country_name_en, dial_code, otp_enabled) VALUES
  ('SA', 'المملكة العربية السعودية', 'Saudi Arabia', '+966', true),
  ('AE', 'الإمارات العربية المتحدة', 'United Arab Emirates', '+971', false),
  ('BH', 'البحرين', 'Bahrain', '+973', false),
  ('KW', 'الكويت', 'Kuwait', '+965', false),
  ('OM', 'عُمان', 'Oman', '+968', false),
  ('QA', 'قطر', 'Qatar', '+974', false),
  ('EG', 'مصر', 'Egypt', '+20', false),
  ('JO', 'الأردن', 'Jordan', '+962', false),
  ('LB', 'لبنان', 'Lebanon', '+961', false),
  ('IQ', 'العراق', 'Iraq', '+964', false),
  ('US', 'الولايات المتحدة', 'United States', '+1', false),
  ('GB', 'المملكة المتحدة', 'United Kingdom', '+44', false);

-- ============================================================
-- MIGRATION: supabase/migrations/20260412000001_jassas_13stage_lifecycle.sql
-- ============================================================
-- =============================================================================
-- Migration: Jassas 13-Stage Lifecycle
-- 1. Add 13-stage values to assignment_status + request_status enums
-- 2. Add request_id to valuation_assignments (bidirectional link)
-- 3. Add portal_user_id to clients (identify portal users)
-- 4. Auto-create valuation_assignment on valuation_request insert (BEFORE trigger)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend assignment_status enum with 13-stage values
-- ---------------------------------------------------------------------------
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_1_processing';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_2_client_review';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_3_owner_scope';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_4_client_scope';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'pending_payment_1';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_5_inspection';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_6_owner_draft';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'stage_7_client_draft';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'pending_payment_2';
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'signing';
-- 'issued' and 'archived' already exist — skip

-- ---------------------------------------------------------------------------
-- 2. Extend request_status enum with 13-stage values
--    (used by workflow-engine when syncing request status for client portal)
-- ---------------------------------------------------------------------------
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_1_processing';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_2_client_review';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_3_owner_scope';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_4_client_scope';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'pending_payment_1';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_5_inspection';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_6_owner_draft';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'stage_7_client_draft';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'pending_payment_2';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'signing';
-- 'completed' and 'archived' already exist — skip

-- ---------------------------------------------------------------------------
-- 3. Add request_id to valuation_assignments (bidirectional link)
-- ---------------------------------------------------------------------------
ALTER TABLE public.valuation_assignments
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.valuation_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_request_id
  ON public.valuation_assignments(request_id);

-- ---------------------------------------------------------------------------
-- 4. Add portal_user_id to clients (links a portal auth.user to a client record)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_portal_user
  ON public.clients(portal_user_id);

-- ---------------------------------------------------------------------------
-- 5. Trigger function: auto-create valuation_assignment when a request is inserted
--
--    Strategy (BEFORE INSERT — runs before the row is committed so we can
--    set NEW.assignment_id in the same transaction):
--
--    a) Resolve organization_id — single-tenant: use the single active org.
--    b) Find or create a client record linked to the portal user.
--    c) Insert a new valuation_assignment with status = 'draft'.
--    d) Set NEW.assignment_id so the request row already carries the link.
--    e) On any failure, raise a WARNING and continue (never block the insert).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_create_assignment_from_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id        UUID;
  v_client_id     UUID;
  v_seq_num       INTEGER;
  v_asgn_id       UUID;
  v_user_name_ar  TEXT;
  v_valuation_mode TEXT;
BEGIN
  -- Skip if assignment already set (manual override)
  IF NEW.assignment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- ── a) Resolve organization ───────────────────────────────────────────────
  -- Try user's own profile org first; fall back to the single active org.
  SELECT p.organization_id INTO v_org_id
  FROM public.profiles p
  WHERE p.user_id = NEW.client_user_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE WARNING '[auto_create_assignment] No organization found — skipping assignment creation for request %', NEW.id;
    RETURN NEW;
  END IF;

  -- ── b) Find or create client record ──────────────────────────────────────
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE portal_user_id = NEW.client_user_id
    AND organization_id = v_org_id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    -- Get the user's display name from profiles
    SELECT COALESCE(full_name_ar, 'عميل') INTO v_user_name_ar
    FROM public.profiles
    WHERE user_id = NEW.client_user_id
    LIMIT 1;

    INSERT INTO public.clients (
      organization_id,
      portal_user_id,
      name_ar,
      client_type,
      created_by
    ) VALUES (
      v_org_id,
      NEW.client_user_id,
      COALESCE(v_user_name_ar, 'عميل'),
      'individual',
      NEW.client_user_id
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- ── c) Generate sequential_number (per-org) ───────────────────────────────
  SELECT COALESCE(MAX(sequential_number), 0) + 1 INTO v_seq_num
  FROM public.valuation_assignments
  WHERE organization_id = v_org_id;

  -- ── d) Resolve valuation_mode (desktop vs field) ──────────────────────────
  v_valuation_mode := COALESCE(NEW.valuation_mode, 'desktop');

  -- ── e) Insert assignment ──────────────────────────────────────────────────
  INSERT INTO public.valuation_assignments (
    organization_id,
    request_id,
    reference_number,
    sequential_number,
    client_id,
    status,
    property_type,
    purpose,
    valuation_mode,
    basis_of_value,
    report_language,
    created_by
  ) VALUES (
    v_org_id,
    NEW.id,                                              -- request_id (NEW.id is UUID set by DEFAULT before BEFORE trigger)
    NEW.reference_number,
    v_seq_num,
    v_client_id,
    'draft'::public.assignment_status,
    'residential'::public.property_type,                -- sensible default; owner updates in stage_3
    COALESCE(NEW.purpose, 'sale_purchase'::public.valuation_purpose),
    v_valuation_mode,
    'market_value'::public.basis_of_value,
    'ar'::public.report_language,
    NEW.client_user_id
  )
  RETURNING id INTO v_asgn_id;

  -- ── f) Back-link: stamp assignment_id onto the request row ───────────────
  NEW.assignment_id := v_asgn_id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never block request creation — log and continue
  RAISE WARNING '[auto_create_assignment] Failed for request % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists, then recreate
DROP TRIGGER IF EXISTS trg_auto_create_assignment ON public.valuation_requests;

CREATE TRIGGER trg_auto_create_assignment
  BEFORE INSERT ON public.valuation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_assignment_from_request();

-- ---------------------------------------------------------------------------
-- 6. Back-fill existing requests that have no assignment_id
--    (runs once, safe to re-run — skips already-linked rows)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r          RECORD;
  v_org_id   UUID;
  v_client_id UUID;
  v_seq_num  INTEGER;
  v_asgn_id  UUID;
BEGIN
  FOR r IN
    SELECT vr.id, vr.client_user_id, vr.reference_number, vr.purpose, vr.valuation_mode
    FROM public.valuation_requests vr
    WHERE vr.assignment_id IS NULL
    ORDER BY vr.created_at
  LOOP
    -- org
    SELECT COALESCE(
      (SELECT organization_id FROM public.profiles WHERE user_id = r.client_user_id LIMIT 1),
      (SELECT id FROM public.organizations WHERE is_active = true ORDER BY created_at LIMIT 1)
    ) INTO v_org_id;

    IF v_org_id IS NULL THEN CONTINUE; END IF;

    -- client
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE portal_user_id = r.client_user_id AND organization_id = v_org_id LIMIT 1;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (organization_id, portal_user_id, name_ar, client_type, created_by)
      VALUES (
        v_org_id, r.client_user_id,
        COALESCE((SELECT full_name_ar FROM public.profiles WHERE user_id = r.client_user_id LIMIT 1), 'عميل'),
        'individual', r.client_user_id
      ) RETURNING id INTO v_client_id;
    END IF;

    -- seq
    SELECT COALESCE(MAX(sequential_number), 0) + 1 INTO v_seq_num
    FROM public.valuation_assignments WHERE organization_id = v_org_id;

    -- insert assignment
    INSERT INTO public.valuation_assignments (
      organization_id, request_id, reference_number, sequential_number,
      client_id, status, property_type, purpose, valuation_mode,
      basis_of_value, report_language, created_by
    ) VALUES (
      v_org_id, r.id, r.reference_number, v_seq_num,
      v_client_id, 'draft'::public.assignment_status,
      'residential'::public.property_type,
      COALESCE(r.purpose, 'sale_purchase'::public.valuation_purpose),
      COALESCE(r.valuation_mode, 'desktop'),
      'market_value'::public.basis_of_value, 'ar'::public.report_language,
      r.client_user_id
    ) RETURNING id INTO v_asgn_id;

    -- back-link
    UPDATE public.valuation_requests SET assignment_id = v_asgn_id WHERE id = r.id;

    RAISE NOTICE 'Back-filled assignment % for request %', v_asgn_id, r.id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS: allow owners/admins to read assignments via request_id
-- ---------------------------------------------------------------------------
-- (existing RLS on valuation_assignments already covers organization_id check)
-- No additional policy needed.

-- ---------------------------------------------------------------------------
-- Done
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.valuation_assignments.request_id IS
  'Bidirectional link back to valuation_requests. Set automatically by trg_auto_create_assignment.';

COMMENT ON COLUMN public.clients.portal_user_id IS
  'auth.users.id of the portal (client-facing) user linked to this client record.';

