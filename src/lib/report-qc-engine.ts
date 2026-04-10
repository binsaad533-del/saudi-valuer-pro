/**
 * Report Quality Gate Engine — بوابة جودة التقارير
 * مبني على نموذج قياس جودة تقارير التقييم IVS 2025
 * 
 * Three-tier validation system:
 * 1. MANDATORY (إلزامي) — blocks issuance if any fail
 * 2. QUALITY (جودة) — warns but allows issuance
 * 3. ENHANCEMENT (تحسين) — suggestions only
 */

import { supabase } from "@/integrations/supabase/client";
import {
  IVS_STANDARDS,
  getItemSeverity, getApplicableItems, getGrade,
  type IVSStandard, type IVSCheckItem, type IVSStandardCode, type QCGrade,
} from "./ivs-quality-standards";

/* ─── Types ─── */

export type QCSeverity = "mandatory" | "quality" | "enhancement";

export type QCCategory =
  | "IVS101" | "IVS102" | "IVS103" | "IVS104"
  | "IVS105" | "IVS106" | "IVS400" | "IVS410"
  | "system_checks";

export interface QCCheckItem {
  code: string;
  ref?: string;
  label_ar: string;
  label_en: string;
  category: QCCategory;
  severity: QCSeverity;
  passed: boolean;
  mandatory: boolean;
  score?: number; // 0-3 for IVS checks
  weight_pct?: number;
  details_ar?: string;
}

export interface IVSStandardResult {
  code: IVSStandardCode;
  title_ar: string;
  weight_pct: number;
  score_pct: number; // 0-100
  total_items: number;
  checked_items: number;
  passed_items: number;
}

export interface ReportQCResult {
  passed: boolean;
  can_issue: boolean;
  has_warnings: boolean;
  score: number;             // 0-100 weighted
  grade: QCGrade;
  grade_label_ar: string;
  total_checks: number;
  passed_checks: number;
  failed_mandatory: number;
  failed_quality: number;
  failed_enhancement: number;
  standard_results: IVSStandardResult[];
  checks: QCCheckItem[];
  blocked_reasons_ar: string[];
  warning_reasons_ar: string[];
  enhancement_suggestions_ar: string[];
  checked_at: string;
}

/* ─── Category Labels ─── */

export const QC_CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  IVS101: { ar: "IVS 101 نطاق العمل", en: "Scope of Work" },
  IVS102: { ar: "IVS 102 أسس القيمة", en: "Bases of Value" },
  IVS103: { ar: "IVS 103 أساليب التقييم", en: "Valuation Approaches" },
  IVS104: { ar: "IVS 104 البيانات", en: "Data and Inputs" },
  IVS105: { ar: "IVS 105 نماذج التقييم", en: "Valuation Models" },
  IVS106: { ar: "IVS 106 التوثيق", en: "Documentation" },
  IVS400: { ar: "IVS 400 المصالح العقارية", en: "Real Property Interests" },
  IVS410: { ar: "IVS 410 العقارات التطويرية", en: "Development Property" },
  system_checks: { ar: "فحوصات النظام", en: "System Checks" },
};

export const SEVERITY_LABELS: Record<QCSeverity, { ar: string; en: string; color: string }> = {
  mandatory: { ar: "إلزامي", en: "Mandatory", color: "destructive" },
  quality: { ar: "جودة", en: "Quality", color: "warning" },
  enhancement: { ar: "تحسين", en: "Enhancement", color: "info" },
};

/* ─── Placeholder detection ─── */
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
  details_ar?: string,
  extra?: { ref?: string; score?: number; weight_pct?: number }
) {
  checks.push({
    code, label_ar, label_en, category, severity,
    passed,
    mandatory: severity === "mandatory",
    details_ar: passed ? undefined : details_ar,
    ...(extra || {}),
  });
}

/* ─── Auto-evaluate IVS items against report content ─── */
function autoScoreItem(
  item: IVSCheckItem,
  standard: IVSStandard,
  reportText: string,
  assignment: any,
  assumptions: any[],
  comparables: any[],
  _inspections: any[],
): number {
  const text = reportText.toLowerCase();
  

  // IVS 101 checks — scope of work
  if (standard.code === "IVS101") {
    if (item.ref === "20.1(أ)") return (assignment?.subjects?.[0]?.property_type) ? 3 : text.includes("الأصل") ? 2 : 0;
    if (item.ref === "20.1(ب)") return assignment?.client_name_ar ? 3 : text.includes("العميل") ? 1 : 0;
    if (item.ref === "20.1(ج)") return text.includes("الاستخدام المقصود") || text.includes("الغرض") ? 3 : text.includes("غرض") ? 1 : 0;
    if (item.ref === "20.1(د)") return text.includes("المستخدم المقصود") ? 3 : 2; // optional
    if (item.ref === "20.1(هـ)") return text.includes("تضارب") || text.includes("مصالح") ? 3 : text.includes("استقلالية") ? 2 : 0;
    if (item.ref === "20.1(و)") return text.includes("ريال") || text.includes("عملة") || text.includes("SAR") ? 3 : 0;
    if (item.ref === "20.1(ز)") return assignment?.valuation_date ? 3 : text.includes("تاريخ التقييم") ? 2 : 0;
    if (item.ref === "20.1(ط)") return text.includes("نطاق") || text.includes("قيود") ? 3 : text.includes("scope") ? 1 : 0;
    if (item.ref === "20.1(ي)") return text.includes("مصدر") && text.includes("معلومات") ? 3 : text.includes("مصدر") ? 1 : 0;
    if (item.ref === "20.1(ك)") return assumptions.length > 0 ? 3 : text.includes("افتراض") ? 1 : 0;
    if (item.ref === "20.1(ل)") return text.includes("أخصائي") ? 3 : 2; // optional
    if (item.ref === "20.1(م)") return text.includes("بيئي") || text.includes("حوكمة") || text.includes("ESG") ? 3 : 1;
    if (item.ref === "20.1(ن)") return text.includes("نوع التقرير") || text.includes("تفصيلي") || text.includes("سردي") ? 3 : 1;
    if (item.ref === "20.1(س)") return text.includes("قيود") && text.includes("استخدام") ? 3 : text.includes("توزيع") ? 2 : 0;
    if (item.ref === "20.1(ع)") return text.includes("IVS") || text.includes("معايير التقييم الدولية") ? 3 : 0;
  }

  // IVS 102 — bases of value
  if (standard.code === "IVS102") {
    if (item.ref === "3.10") return text.includes("أعلى وأفضل") || text.includes("highest and best") ? 3 : text.includes("فرضية القيمة") ? 2 : 0;
    if (item.ref === "2.20") return text.includes("القيمة السوقية") || text.includes("أساس القيمة") ? 3 : 0;
    if (item.ref === "4.20") return text.includes("أساس القيمة") && text.includes("مناسب") ? 3 : text.includes("أساس القيمة") ? 2 : 1;
    if (item.ref === "6.20") return text.includes("تعريف") && (text.includes("القيمة السوقية") || text.includes("أساس القيمة")) ? 3 : 1;
    if (item.ref === "50.4") return assumptions.length > 0 ? 3 : text.includes("افتراض") ? 1 : 0;
  }

  // IVS 103 — valuation approaches
  if (standard.code === "IVS103") {
    if (item.ref === "1.10") return text.includes("أسلوب") && (text.includes("سوق") || text.includes("دخل") || text.includes("تكلفة")) ? 3 : 0;
    if (item.ref === "3.10") return text.includes("طريقة التقييم") || text.includes("المقارنة") ? 3 : text.includes("طريقة") ? 1 : 0;
    if (item.ref?.startsWith("10.")) return text.includes("أسلوب") ? 2 : 1;
    if (item.ref?.startsWith("10-السوق")) return comparables.length > 0 ? 3 : text.includes("مقارن") ? 1 : 0;
    if (item.ref?.startsWith("20-الدخل")) return text.includes("دخل") || text.includes("عائد") || text.includes("رسملة") ? 2 : 0;
    if (item.ref?.startsWith("30-التكلفة")) return text.includes("تكلفة") || text.includes("إهلاك") ? 2 : 0;
  }

  // IVS 104 — data
  if (standard.code === "IVS104") {
    if (item.ref === "20" && item.optional) return 2;
    if (item.ref?.startsWith("30.")) return text.includes("بيانات") || text.includes("مصدر") ? 2 : 1;
    if (item.ref === "40.2") return text.length > 500 ? 2 : 1;
    if (item.ref === "50.1/50.2") return text.includes("مصدر") && text.includes("مدخل") ? 3 : 1;
    if (item.ref === "6-10أ") return text.includes("بيئي") || text.includes("ESG") ? 2 : 1;
  }

  // IVS 105 — valuation models
  if (standard.code === "IVS105") {
    if (item.ref === "20" && item.optional) return 2;
    if (item.ref === "40") return text.includes("نموذج") && text.includes("تقييم") ? 3 : text.includes("نموذج") ? 1 : 0;
    if (item.ref === "50") return text.includes("نموذج") && text.includes("مدخل") ? 2 : 1;
  }

  // IVS 106 — documentation
  if (standard.code === "IVS106") {
    if (item.ref === "20") return text.length > 1000 ? 3 : text.length > 300 ? 2 : 1;
    if (item.ref === "30") return assignment?.subjects?.[0] ? 3 : text.includes("أصل") ? 1 : 0;
    if (item.ref === "6.30(ص)") return assignment?.valuation_date && assignment?.report_date ? 3 : 2;
  }

  // IVS 400 — real property interests
  if (standard.code === "IVS400") {
    if (item.ref === "2.20-أ") return text.includes("ملكية") || text.includes("صك") ? 3 : text.includes("عقار") ? 1 : 0;
    if (item.ref === "2.20-ب") return text.includes("مصلحة") || text.includes("حقوق") ? 3 : 1;
  }

  // IVS 410 — development property
  if (standard.code === "IVS410") {
    return text.includes("تطوير") ? 2 : 0;
  }

  return 1; // default partial score
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

  // Build full report text
  let reportText = "";
  if (draft) {
    const contentAr: string = draft.content_ar || "";
    const sections = draft.sections || {};
    reportText = contentAr + " " + Object.values(sections).map(v => typeof v === "string" ? v : JSON.stringify(v)).join(" ");
  }

  // Determine used approaches
  const usedApproaches = {
    market: reportText.includes("السوق") || reportText.includes("مقارن") || comparables.length > 0,
    income: reportText.includes("دخل") || reportText.includes("رسملة") || reportText.includes("عائد"),
    cost: reportText.includes("تكلفة") || reportText.includes("إهلاك") || reportText.includes("استبدال"),
    development: reportText.includes("تطوير") || assignment?.property_type === "development",
  };

  const standardResults: IVSStandardResult[] = [];

  // ══════════════════════════════════════════════
  // Run IVS Standard Checks
  // ══════════════════════════════════════════════
  for (const std of IVS_STANDARDS) {
    // Skip IVS 410 if not development property
    if (std.code === "IVS410" && !usedApproaches.development) continue;

    const applicableItems = getApplicableItems(std, usedApproaches);
    let stdPassed = 0;
    let stdTotal = applicableItems.length;
    let weightedScore = 0;
    let totalWeight = 0;

    for (const item of applicableItems) {
      const score = autoScoreItem(item, std, reportText, assignment, assumptions, comparables, inspections);
      const severity = getItemSeverity(std, item);
      const passed = score >= 2; // Score ≥2 = passed

      if (passed) stdPassed++;
      totalWeight += item.weight_pct;
      weightedScore += (score / 3) * item.weight_pct;

      addCheck(checks,
        `IVS_${std.code}_${item.ref}`,
        item.question_ar,
        `${std.code} ${item.ref}`,
        std.code as QCCategory,
        severity,
        passed,
        `${item.question_ar} — الدرجة: ${score}/3`,
        { ref: item.ref, score, weight_pct: item.weight_pct }
      );
    }

    const scorePct = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 100;
    standardResults.push({
      code: std.code,
      title_ar: std.title_ar,
      weight_pct: std.weight_pct,
      score_pct: scorePct,
      total_items: stdTotal,
      checked_items: stdTotal,
      passed_items: stdPassed,
    });
  }

  // ══════════════════════════════════════════════
  // System-level checks (not in IVS model)
  // ══════════════════════════════════════════════

  // Draft exists
  if (!draft) {
    addCheck(checks, "SYS_NO_DRAFT", "مسودة التقرير غير موجودة", "Report draft not found",
      "system_checks", "mandatory", false, "لا توجد مسودة تقرير — لا يمكن الإصدار");
  }

  // No placeholders
  if (draft) {
    const hasPlaceholders = PLACEHOLDER_PATTERNS.some(p => p.test(reportText));
    addCheck(checks, "SYS_NO_PLACEHOLDERS", "خلو التقرير من نصوص مؤقتة", "No placeholder text",
      "system_checks", "mandatory", !hasPlaceholders, "يحتوي التقرير على نصوص مؤقتة ([...] أو TODO)");
  }

  // Final value exists
  const finalValue = assignment?.final_value;
  const estimatedValue = assignment?.estimated_value;
  const numericValue = Number(finalValue || estimatedValue || 0);
  addCheck(checks, "SYS_VALUE_EXISTS", "وجود القيمة النهائية", "Final value exists",
    "system_checks", "mandatory", numericValue > 0, "القيمة النهائية غير محددة أو صفرية");

  // Compliance checks
  if (complianceChecks.length > 0) {
    const mandatoryFailed = complianceChecks.filter((c: any) => c.is_mandatory && !c.is_passed);
    addCheck(checks, "SYS_COMPLIANCE", "فحوصات الامتثال التنظيمي", "Regulatory compliance",
      "system_checks", "mandatory", mandatoryFailed.length === 0,
      `${mandatoryFailed.length} فحوصات امتثال إلزامية لم تجتز`);
  }

  // Inspection for field mode
  const isDesktop = assignment?.valuation_mode === "desktop";
  if (!isDesktop) {
    const inspDone = inspections[0]?.completed || inspections[0]?.status === "completed" || inspections[0]?.status === "submitted";
    addCheck(checks, "SYS_INSPECTION", "اكتمال المعاينة الميدانية", "Field inspection completed",
      "system_checks", "mandatory", !!inspDone, "المعاينة الميدانية لم تكتمل");
  }

  // ── Compute overall weighted score ──
  let overallWeightedScore = 0;
  let totalStdWeight = 0;
  for (const sr of standardResults) {
    const effectiveWeight = sr.code === "IVS410" ? 10 : sr.weight_pct;
    overallWeightedScore += sr.score_pct * effectiveWeight;
    totalStdWeight += effectiveWeight;
  }
  const score = totalStdWeight > 0 ? Math.round(overallWeightedScore / totalStdWeight) : 0;
  const gradeInfo = getGrade(score);

  // ── Categorize failures ──
  const mandatoryFails = checks.filter(c => c.severity === "mandatory" && !c.passed);
  const qualityFails = checks.filter(c => c.severity === "quality" && !c.passed);
  const enhancementFails = checks.filter(c => c.severity === "enhancement" && !c.passed);

  return {
    passed: mandatoryFails.length === 0,
    can_issue: mandatoryFails.length === 0,
    has_warnings: qualityFails.length > 0,
    score,
    grade: gradeInfo.grade,
    grade_label_ar: gradeInfo.label_ar,
    total_checks: checks.length,
    passed_checks: checks.filter(c => c.passed).length,
    failed_mandatory: mandatoryFails.length,
    failed_quality: qualityFails.length,
    failed_enhancement: enhancementFails.length,
    standard_results: standardResults,
    checks,
    blocked_reasons_ar: mandatoryFails.map(c => c.details_ar || c.label_ar),
    warning_reasons_ar: qualityFails.map(c => c.details_ar || c.label_ar),
    enhancement_suggestions_ar: enhancementFails.map(c => c.details_ar || c.label_ar),
    checked_at: now,
  };
}

/* ─── Log QC result ─── */

export async function logQCResult(
  assignmentId: string,
  result: ReportQCResult,
  userId: string
): Promise<void> {
  await Promise.all([
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
    supabase.from("audit_logs").insert([{
      user_id: userId,
      action: "create" as const,
      table_name: "quality_gate",
      record_id: assignmentId,
      assignment_id: assignmentId,
      description: result.passed
        ? `اجتياز بوابة الجودة — ${result.score}% (${result.grade_label_ar}) — ${result.passed_checks}/${result.total_checks}${result.has_warnings ? ` — ${result.failed_quality} ملاحظات جودة` : ""}`
        : `رفض بوابة الجودة — ${result.score}% (${result.grade_label_ar}) — ${result.failed_mandatory} متطلبات إلزامية لم تتحقق`,
      new_data: {
        qg_passed: result.passed,
        qg_score: result.score,
        qg_grade: result.grade,
        qg_grade_label: result.grade_label_ar,
        standard_results: result.standard_results,
        can_issue: result.can_issue,
        has_warnings: result.has_warnings,
        failed_mandatory: result.failed_mandatory,
        failed_quality: result.failed_quality,
        failed_enhancement: result.failed_enhancement,
        checked_at: result.checked_at,
      } as any,
    }]),
  ]);
}
