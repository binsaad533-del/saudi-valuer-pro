/**
 * Report Quality Gate Engine — بوابة جودة التقارير
 * 
 * Three-tier validation system:
 * 1. MANDATORY (إلزامي) — blocks issuance if any fail
 * 2. QUALITY (جودة) — warns but allows issuance
 * 3. ENHANCEMENT (تحسين) — suggestions only
 */

import { supabase } from "@/integrations/supabase/client";

/* ─── Types ─── */

export type QCSeverity = "mandatory" | "quality" | "enhancement";

export type QCCategory =
  | "section_completeness"
  | "content_quality"
  | "methodology"
  | "value_integrity"
  | "compliance"
  | "documentation"
  | "professional_standards";

export interface QCCheckItem {
  code: string;
  label_ar: string;
  label_en: string;
  category: QCCategory;
  severity: QCSeverity;
  passed: boolean;
  /** @deprecated use severity instead */
  mandatory: boolean;
  details_ar?: string;
}

export interface ReportQCResult {
  passed: boolean;          // true if no mandatory failures
  can_issue: boolean;       // same as passed
  has_warnings: boolean;    // quality-level failures exist
  score: number;            // 0–100
  total_checks: number;
  passed_checks: number;
  failed_mandatory: number;
  failed_quality: number;
  failed_enhancement: number;
  checks: QCCheckItem[];
  blocked_reasons_ar: string[];
  warning_reasons_ar: string[];
  enhancement_suggestions_ar: string[];
  checked_at: string;
}

/* ─── Category Labels ─── */

export const QC_CATEGORY_LABELS: Record<QCCategory, { ar: string; en: string }> = {
  section_completeness: { ar: "اكتمال الأقسام", en: "Section Completeness" },
  content_quality: { ar: "جودة المحتوى", en: "Content Quality" },
  methodology: { ar: "المنهجية والتبرير", en: "Methodology Justification" },
  value_integrity: { ar: "سلامة القيمة", en: "Value Integrity" },
  compliance: { ar: "الامتثال التنظيمي", en: "Regulatory Compliance" },
  documentation: { ar: "التوثيق", en: "Documentation" },
  professional_standards: { ar: "المعايير المهنية", en: "Professional Standards" },
};

export const SEVERITY_LABELS: Record<QCSeverity, { ar: string; en: string; color: string }> = {
  mandatory: { ar: "إلزامي", en: "Mandatory", color: "destructive" },
  quality: { ar: "جودة", en: "Quality", color: "warning" },
  enhancement: { ar: "تحسين", en: "Enhancement", color: "info" },
};

/* ─── Required Report Sections ─── */

const REQUIRED_SECTIONS = [
  { key: "executive_summary", label_ar: "الملخص التنفيذي", label_en: "Executive Summary" },
  { key: "scope_of_work", label_ar: "نطاق العمل", label_en: "Scope of Work" },
  { key: "methodology", label_ar: "المنهجية", label_en: "Methodology" },
  { key: "assumptions", label_ar: "الافتراضات", label_en: "Assumptions" },
  { key: "final_value", label_ar: "النتيجة النهائية", label_en: "Final Value" },
];

/* ─── Thresholds ─── */
const MIN_SECTION_LENGTH = 20;
const MIN_METHODOLOGY_LENGTH = 50;
const MIN_CONTENT_LENGTH = 500;
const PLACEHOLDER_PATTERNS = [
  /\[.*?\]/g, /_{3,}/g, /\.{4,}/g,
  /أدخل|يرجى الإدخال|لم يحدد/gi,
  /TODO|TBD|FIXME|placeholder/gi,
];

/* ─── Helper ─── */
function addCheck(
  checks: QCCheckItem[],
  code: string,
  label_ar: string,
  label_en: string,
  category: QCCategory,
  severity: QCSeverity,
  passed: boolean,
  details_ar?: string
) {
  checks.push({
    code, label_ar, label_en, category, severity,
    passed,
    mandatory: severity === "mandatory",
    details_ar: passed ? undefined : details_ar,
  });
}

/* ─── Main Quality Gate Runner ─── */

export async function runReportQC(assignmentId: string): Promise<ReportQCResult> {
  const checks: QCCheckItem[] = [];
  const now = new Date().toISOString();

  // ── Fetch data in parallel ──
  const [draftRes, assignmentRes, assumptionsRes, comparablesRes, inspectionsRes, complianceRes] = await Promise.all([
    supabase.from("report_drafts" as any).select("*").eq("assignment_id", assignmentId).order("version", { ascending: false }).limit(1),
    supabase.from("valuation_assignments").select("*, subjects(*)").eq("id", assignmentId).single(),
    supabase.from("assumptions").select("id, is_special", { count: "exact", head: false }).eq("assignment_id", assignmentId),
    supabase.from("assignment_comparables").select("id").eq("assignment_id", assignmentId),
    supabase.from("inspections").select("id, status, completed").eq("assignment_id", assignmentId).limit(1),
    supabase.from("compliance_checks").select("id, is_passed, is_mandatory, category").eq("assignment_id", assignmentId),
  ]);

  const draft = draftRes.data?.[0] as any;
  const assignment = assignmentRes.data as any;
  const assumptions = assumptionsRes.data || [];
  const comparables = comparablesRes.data || [];
  const inspections = inspectionsRes.data || [];
  const complianceChecks = complianceRes.data || [];

  // ══════════════════════════════════════════════
  // 1. SECTION COMPLETENESS — MANDATORY
  // ══════════════════════════════════════════════

  if (!draft) {
    addCheck(checks, "QG_NO_DRAFT", "مسودة التقرير غير موجودة", "Report draft not found",
      "section_completeness", "mandatory", false, "لا توجد مسودة تقرير — لا يمكن الإصدار");
  } else {
    const contentAr: string = draft.content_ar || "";
    const sections = draft.sections || {};

    for (const sec of REQUIRED_SECTIONS) {
      let sectionContent = "";
      if (sections[sec.key]) {
        sectionContent = typeof sections[sec.key] === "string" ? sections[sec.key] : JSON.stringify(sections[sec.key]);
      } else if (contentAr.includes(sec.label_ar)) {
        sectionContent = sec.label_ar;
      }
      if (sec.key === "assumptions" && assumptions.length > 0) sectionContent = "documented_in_db";
      if (sec.key === "final_value" && (assignment?.final_value || assignment?.estimated_value)) sectionContent = "value_confirmed";

      const hasContent = sectionContent.length >= MIN_SECTION_LENGTH || sectionContent === "documented_in_db" || sectionContent === "value_confirmed";
      addCheck(checks, `QG_SECTION_${sec.key.toUpperCase()}`, sec.label_ar, sec.label_en,
        "section_completeness", "mandatory", hasContent, `قسم "${sec.label_ar}" مفقود أو غير مكتمل`);
    }
  }

  // ══════════════════════════════════════════════
  // 2. CONTENT QUALITY — MANDATORY + QUALITY
  // ══════════════════════════════════════════════

  if (draft) {
    const contentAr: string = draft.content_ar || "";
    const sections = draft.sections || {};
    const allText = contentAr + " " + Object.values(sections).map(v => typeof v === "string" ? v : JSON.stringify(v)).join(" ");

    // Mandatory: no placeholders
    const hasPlaceholders = PLACEHOLDER_PATTERNS.some(p => p.test(allText));
    addCheck(checks, "QG_NO_PLACEHOLDERS", "خلو التقرير من نصوص مؤقتة", "No placeholder text",
      "content_quality", "mandatory", !hasPlaceholders, "يحتوي التقرير على نصوص مؤقتة ([...] أو TODO)");

    // Mandatory: minimum content
    const totalLength = allText.replace(/\s+/g, "").length;
    addCheck(checks, "QG_MIN_CONTENT", "الحد الأدنى من المحتوى", "Minimum content threshold",
      "content_quality", "mandatory", totalLength >= MIN_CONTENT_LENGTH, "محتوى التقرير أقل من الحد الأدنى المطلوب");

    // Quality: Arabic language consistency
    const arabicRatio = (allText.match(/[\u0600-\u06FF]/g) || []).length / Math.max(allText.length, 1);
    addCheck(checks, "QG_ARABIC_QUALITY", "جودة النص العربي", "Arabic text quality",
      "content_quality", "quality", arabicRatio > 0.3, "نسبة النص العربي منخفضة — تأكد من كتابة التقرير بالعربية");

    // Enhancement: comprehensive content (>2000 chars)
    addCheck(checks, "QG_CONTENT_DEPTH", "عمق المحتوى التحليلي", "Content depth",
      "content_quality", "enhancement", totalLength >= 2000, "يُنصح بإثراء المحتوى التحليلي لرفع جودة التقرير");
  }

  // ══════════════════════════════════════════════
  // 3. METHODOLOGY — MANDATORY + QUALITY
  // ══════════════════════════════════════════════

  if (draft) {
    const sections = draft.sections || {};
    const methodologyContent = sections.methodology || sections.valuation_methodology || "";
    const methodText = typeof methodologyContent === "string" ? methodologyContent : JSON.stringify(methodologyContent);

    // Mandatory: methodology justified
    addCheck(checks, "QG_METHODOLOGY_JUSTIFIED", "تبرير المنهجية", "Methodology justification",
      "methodology", "mandatory", methodText.length >= MIN_METHODOLOGY_LENGTH,
      "المنهجية غير مبررة أو وصفها غير كافٍ — مطلوب حسب IVS 105");
  }

  // Mandatory: assumptions documented
  addCheck(checks, "QG_ASSUMPTIONS_DOCUMENTED", "توثيق الافتراضات", "Assumptions documented",
    "methodology", "mandatory", assumptions.length > 0, "لم يتم توثيق أي افتراضات — إلزامي حسب IVS 2025");

  // Quality: special assumptions identified
  const hasSpecialAssumptions = assumptions.some((a: any) => a.is_special);
  addCheck(checks, "QG_SPECIAL_ASSUMPTIONS", "تحديد الافتراضات الخاصة", "Special assumptions identified",
    "methodology", "quality", assumptions.length === 0 || hasSpecialAssumptions,
    "يُوصى بتحديد الافتراضات الخاصة وفصلها عن الافتراضات العامة");

  // Quality: comparables used
  addCheck(checks, "QG_COMPARABLES_USED", "استخدام مقارنات سوقية", "Market comparables used",
    "methodology", "quality", comparables.length >= 2,
    "يُوصى باستخدام مقارنتين سوقيتين على الأقل لدعم التقييم");

  // ══════════════════════════════════════════════
  // 4. VALUE INTEGRITY — MANDATORY
  // ══════════════════════════════════════════════

  const finalValue = assignment?.final_value;
  const estimatedValue = assignment?.estimated_value;
  const hasValue = !!finalValue || !!estimatedValue;
  const numericValue = Number(finalValue || estimatedValue || 0);

  addCheck(checks, "QG_VALUE_EXISTS", "وجود القيمة النهائية", "Final value exists",
    "value_integrity", "mandatory", hasValue, "القيمة النهائية غير محددة");

  addCheck(checks, "QG_VALUE_POSITIVE", "القيمة موجبة وصالحة", "Value is positive",
    "value_integrity", "mandatory", numericValue > 0, "القيمة المحددة غير صالحة (صفر أو سالبة)");

  // Enhancement: value reconciliation documented
  addCheck(checks, "QG_VALUE_RECONCILIATION", "مصالحة القيمة", "Value reconciliation",
    "value_integrity", "enhancement", false, "يُنصح بتوثيق مصالحة القيمة بين المناهج المستخدمة");

  // ══════════════════════════════════════════════
  // 5. COMPLIANCE — MANDATORY + QUALITY
  // ══════════════════════════════════════════════

  if (complianceChecks.length > 0) {
    const mandatoryFailed = complianceChecks.filter((c: any) => c.is_mandatory && !c.is_passed);
    addCheck(checks, "QG_COMPLIANCE_CHECKS", "فحوصات الامتثال التنظيمي", "Regulatory compliance checks",
      "compliance", "mandatory", mandatoryFailed.length === 0,
      `${mandatoryFailed.length} فحوصات امتثال إلزامية لم تجتز`);
  }

  // Mandatory: inspection completed (unless desktop)
  const isDesktop = assignment?.valuation_mode === "desktop";
  if (!isDesktop) {
    const inspDone = inspections[0]?.completed || inspections[0]?.status === "completed" || inspections[0]?.status === "submitted";
    addCheck(checks, "QG_INSPECTION_DONE", "اكتمال المعاينة الميدانية", "Field inspection completed",
      "compliance", "mandatory", !!inspDone, "المعاينة الميدانية لم تكتمل — إلزامية لنمط التقييم الميداني");
  }

  // ══════════════════════════════════════════════
  // 6. DOCUMENTATION — QUALITY + ENHANCEMENT
  // ══════════════════════════════════════════════

  // Quality: photos attached (for field inspections)
  if (!isDesktop) {
    const { count: photosCount } = await supabase
      .from("inspection_photos")
      .select("id", { count: "exact", head: true })
      .in("inspection_id", inspections.map((i: any) => i.id).filter(Boolean));

    addCheck(checks, "QG_PHOTOS_ATTACHED", "إرفاق صور المعاينة", "Inspection photos attached",
      "documentation", "quality", (photosCount || 0) >= 3,
      "يُوصى بإرفاق 3 صور معاينة على الأقل لتوثيق الحالة");
  }

  // Enhancement: attachments present
  const { count: attachmentsCount } = await supabase
    .from("attachments")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);

  addCheck(checks, "QG_ATTACHMENTS", "إرفاق مستندات داعمة", "Supporting documents attached",
    "documentation", "enhancement", (attachmentsCount || 0) > 0,
    "يُنصح بإرفاق المستندات الداعمة (صكوك، رخص، مخططات)");

  // ══════════════════════════════════════════════
  // 7. PROFESSIONAL STANDARDS — QUALITY + ENHANCEMENT
  // ══════════════════════════════════════════════

  // Quality: subject property details
  const subject = (assignment as any)?.subjects?.[0] || (assignment as any)?.subjects;
  const hasSubjectDetails = !!(subject?.property_type && (subject?.land_area || subject?.building_area));
  addCheck(checks, "QG_SUBJECT_DETAILS", "بيانات العقار محل التقييم", "Subject property details",
    "professional_standards", "quality", hasSubjectDetails,
    "بيانات العقار محل التقييم غير مكتملة (النوع، المساحة)");

  // Enhancement: glossary
  addCheck(checks, "QG_GLOSSARY", "قائمة المصطلحات", "Glossary of terms",
    "professional_standards", "enhancement", false,
    "يُنصح بإضافة قائمة مصطلحات لتعزيز الوضوح المهني");

  // Enhancement: limiting conditions
  addCheck(checks, "QG_LIMITING_CONDITIONS", "الشروط المقيّدة", "Limiting conditions",
    "professional_standards", "enhancement", false,
    "يُنصح بتوثيق الشروط المقيّدة وحدود نطاق العمل");

  // ── Compute result ──
  const passedChecks = checks.filter(c => c.passed).length;
  const mandatoryFails = checks.filter(c => c.severity === "mandatory" && !c.passed);
  const qualityFails = checks.filter(c => c.severity === "quality" && !c.passed);
  const enhancementFails = checks.filter(c => c.severity === "enhancement" && !c.passed);

  // Score: mandatory=50%, quality=35%, enhancement=15%
  const mandatoryChecks = checks.filter(c => c.severity === "mandatory");
  const qualityChecks = checks.filter(c => c.severity === "quality");
  const enhancementChecks = checks.filter(c => c.severity === "enhancement");

  const mandatoryScore = mandatoryChecks.length > 0
    ? (mandatoryChecks.filter(c => c.passed).length / mandatoryChecks.length) * 50 : 50;
  const qualityScore = qualityChecks.length > 0
    ? (qualityChecks.filter(c => c.passed).length / qualityChecks.length) * 35 : 35;
  const enhancementScore = enhancementChecks.length > 0
    ? (enhancementChecks.filter(c => c.passed).length / enhancementChecks.length) * 15 : 15;

  const score = Math.round(mandatoryScore + qualityScore + enhancementScore);

  return {
    passed: mandatoryFails.length === 0,
    can_issue: mandatoryFails.length === 0,
    has_warnings: qualityFails.length > 0,
    score,
    total_checks: checks.length,
    passed_checks: passedChecks,
    failed_mandatory: mandatoryFails.length,
    failed_quality: qualityFails.length,
    failed_enhancement: enhancementFails.length,
    checks,
    blocked_reasons_ar: mandatoryFails.map(c => c.details_ar || c.label_ar),
    warning_reasons_ar: qualityFails.map(c => c.details_ar || c.label_ar),
    enhancement_suggestions_ar: enhancementFails.map(c => c.details_ar || c.label_ar),
    checked_at: now,
  };
}

/* ─── Log QC result to audit trail + quality_gate_results table ─── */

export async function logQCResult(
  assignmentId: string,
  result: ReportQCResult,
  userId: string
): Promise<void> {
  await Promise.all([
    // Structured table
    supabase.from("quality_gate_results" as any).insert({
      assignment_id: assignmentId,
      run_by: userId,
      overall_passed: result.passed,
      score: result.score,
      total_checks: result.total_checks,
      passed_checks: result.passed_checks,
      failed_mandatory: result.failed_mandatory,
      failed_quality: result.failed_quality,
      failed_enhancement: result.failed_enhancement,
      can_issue: result.can_issue,
      has_warnings: result.has_warnings,
      checks: result.checks,
      blocked_reasons: result.blocked_reasons_ar,
      warning_reasons: result.warning_reasons_ar,
      enhancement_suggestions: result.enhancement_suggestions_ar,
    }),
    // Audit log
    supabase.from("audit_logs").insert({
      user_id: userId,
      action: "create" as any,
      table_name: "quality_gate",
      record_id: assignmentId,
      assignment_id: assignmentId,
      description: result.passed
        ? `اجتياز بوابة الجودة — ${result.score}% (${result.passed_checks}/${result.total_checks})${result.has_warnings ? ` — ${result.failed_quality} ملاحظات جودة` : ""}`
        : `رفض بوابة الجودة — ${result.score}% — ${result.failed_mandatory} متطلبات إلزامية لم تتحقق`,
      new_data: {
        qg_passed: result.passed,
        qg_score: result.score,
        can_issue: result.can_issue,
        has_warnings: result.has_warnings,
        failed_mandatory: result.failed_mandatory,
        failed_quality: result.failed_quality,
        failed_enhancement: result.failed_enhancement,
        blocked_reasons: result.blocked_reasons_ar,
        warning_reasons: result.warning_reasons_ar,
        checked_at: result.checked_at,
      },
    }),
  ]);
}
