
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
