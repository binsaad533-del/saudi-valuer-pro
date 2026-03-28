
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
