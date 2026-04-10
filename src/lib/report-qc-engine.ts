/**
 * Report Quality Control Engine — محرك تدقيق جودة التقارير
 * 
 * Validates report completeness, content quality, and methodology justification
 * BEFORE allowing issuance. Blocks any report with critical gaps.
 */

import { supabase } from "@/integrations/supabase/client";

/* ─── Types ─── */

export type QCCategory =
  | "section_completeness"
  | "content_quality"
  | "methodology"
  | "value_integrity";

export interface QCCheckItem {
  code: string;
  label_ar: string;
  label_en: string;
  category: QCCategory;
  passed: boolean;
  mandatory: boolean;
  details_ar?: string;
}

export interface ReportQCResult {
  passed: boolean;
  score: number;            // 0–100
  total_checks: number;
  passed_checks: number;
  failed_mandatory: number;
  checks: QCCheckItem[];
  blocked_reasons_ar: string[];
  checked_at: string;
}

/* ─── Category Labels ─── */

export const QC_CATEGORY_LABELS: Record<QCCategory, { ar: string; en: string }> = {
  section_completeness: { ar: "اكتمال الأقسام", en: "Section Completeness" },
  content_quality: { ar: "جودة المحتوى", en: "Content Quality" },
  methodology: { ar: "المنهجية والتبرير", en: "Methodology Justification" },
  value_integrity: { ar: "سلامة القيمة", en: "Value Integrity" },
};

/* ─── Required Report Sections ─── */

const REQUIRED_SECTIONS = [
  { key: "executive_summary", label_ar: "الملخص التنفيذي", label_en: "Executive Summary" },
  { key: "scope_of_work", label_ar: "نطاق العمل", label_en: "Scope of Work" },
  { key: "methodology", label_ar: "المنهجية", label_en: "Methodology" },
  { key: "assumptions", label_ar: "الافتراضات", label_en: "Assumptions" },
  { key: "final_value", label_ar: "النتيجة النهائية", label_en: "Final Value" },
];

/* ─── Minimum content thresholds ─── */
const MIN_SECTION_LENGTH = 20;         // characters
const MIN_METHODOLOGY_LENGTH = 50;     // methodology justification must be substantive
const PLACEHOLDER_PATTERNS = [
  /\[.*?\]/g,                          // [placeholder]
  /_{3,}/g,                            // ___
  /\.{4,}/g,                           // ....
  /أدخل|يرجى الإدخال|لم يحدد/gi,     // Arabic placeholders
  /TODO|TBD|FIXME|placeholder/gi,      // English placeholders
];

/* ─── Main QC Runner ─── */

export async function runReportQC(assignmentId: string): Promise<ReportQCResult> {
  const checks: QCCheckItem[] = [];
  const now = new Date().toISOString();

  // ── Fetch report draft content ──
  const { data: drafts } = await supabase
    .from("report_drafts" as any)
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("version", { ascending: false })
    .limit(1);

  const draft = drafts?.[0] as any;

  // ── Fetch assignment for value check ──
  const { data: assignment } = await supabase
    .from("valuation_assignments")
    .select("*, subjects(*)")
    .eq("id", assignmentId)
    .single();

  // ── Fetch assumptions ──
  const { count: assumptionsCount } = await supabase
    .from("assumptions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);

  // ══════════════════════════════════════
  // 1. SECTION COMPLETENESS
  // ══════════════════════════════════════

  if (!draft) {
    checks.push({
      code: "QC_NO_DRAFT",
      label_ar: "مسودة التقرير غير موجودة",
      label_en: "Report draft not found",
      category: "section_completeness",
      passed: false,
      mandatory: true,
      details_ar: "لا توجد مسودة تقرير لهذه المهمة",
    });
  } else {
    // Check each required section in content
    const contentAr: string = draft.content_ar || "";
    const sections = draft.sections || {};

    for (const sec of REQUIRED_SECTIONS) {
      let sectionContent = "";

      // Try structured sections first, then fall back to content_ar search
      if (sections[sec.key]) {
        sectionContent = typeof sections[sec.key] === "string"
          ? sections[sec.key]
          : JSON.stringify(sections[sec.key]);
      } else if (contentAr) {
        // Search for section heading in flat content
        const headingPatterns = [sec.label_ar];
        const found = headingPatterns.some(h => contentAr.includes(h));
        if (found) sectionContent = sec.label_ar; // Mark as present
      }

      // Special handling for assumptions — check DB table
      if (sec.key === "assumptions" && (assumptionsCount || 0) > 0) {
        sectionContent = "documented_in_db";
      }

      // Special handling for final_value — check assignment
      if (sec.key === "final_value") {
        const hasValue = !!(assignment as any)?.final_value || !!(assignment as any)?.estimated_value;
        if (hasValue) sectionContent = "value_confirmed";
      }

      const hasContent = sectionContent.length >= MIN_SECTION_LENGTH
        || sectionContent === "documented_in_db"
        || sectionContent === "value_confirmed";

      checks.push({
        code: `QC_SECTION_${sec.key.toUpperCase()}`,
        label_ar: sec.label_ar,
        label_en: sec.label_en,
        category: "section_completeness",
        passed: hasContent,
        mandatory: true,
        details_ar: hasContent ? undefined : `قسم "${sec.label_ar}" مفقود أو غير مكتمل`,
      });
    }
  }

  // ══════════════════════════════════════
  // 2. CONTENT QUALITY
  // ══════════════════════════════════════

  if (draft) {
    const contentAr: string = draft.content_ar || "";
    const sections = draft.sections || {};
    const allText = contentAr + " " + Object.values(sections).map(v =>
      typeof v === "string" ? v : JSON.stringify(v)
    ).join(" ");

    // Check for placeholder text
    const hasPlaceholders = PLACEHOLDER_PATTERNS.some(p => p.test(allText));
    checks.push({
      code: "QC_NO_PLACEHOLDERS",
      label_ar: "خلو التقرير من نصوص مؤقتة",
      label_en: "No placeholder text",
      category: "content_quality",
      passed: !hasPlaceholders,
      mandatory: true,
      details_ar: hasPlaceholders ? "يحتوي التقرير على نصوص مؤقتة أو غير مكتملة" : undefined,
    });

    // Check minimum total content length (meaningful report > 500 chars)
    const totalLength = allText.replace(/\s+/g, "").length;
    const hasSubstantialContent = totalLength >= 500;
    checks.push({
      code: "QC_MIN_CONTENT",
      label_ar: "الحد الأدنى من المحتوى",
      label_en: "Minimum content threshold",
      category: "content_quality",
      passed: hasSubstantialContent,
      mandatory: true,
      details_ar: hasSubstantialContent ? undefined : "محتوى التقرير أقل من الحد الأدنى المطلوب",
    });
  }

  // ══════════════════════════════════════
  // 3. METHODOLOGY JUSTIFICATION
  // ══════════════════════════════════════

  if (draft) {
    const sections = draft.sections || {};
    const methodologyContent = sections.methodology
      || sections.valuation_methodology
      || "";
    const methodText = typeof methodologyContent === "string"
      ? methodologyContent
      : JSON.stringify(methodologyContent);

    const hasMethodologyJustification = methodText.length >= MIN_METHODOLOGY_LENGTH;
    checks.push({
      code: "QC_METHODOLOGY_JUSTIFIED",
      label_ar: "تبرير المنهجية",
      label_en: "Methodology justification",
      category: "methodology",
      passed: hasMethodologyJustification,
      mandatory: true,
      details_ar: hasMethodologyJustification
        ? undefined
        : "المنهجية غير مبررة أو وصفها غير كافٍ",
    });
  }

  // Check assumptions exist
  const hasAssumptions = (assumptionsCount || 0) > 0;
  checks.push({
    code: "QC_ASSUMPTIONS_DOCUMENTED",
    label_ar: "توثيق الافتراضات",
    label_en: "Assumptions documented",
    category: "methodology",
    passed: hasAssumptions,
    mandatory: true,
    details_ar: hasAssumptions ? undefined : "لم يتم توثيق أي افتراضات للتقييم",
  });

  // ══════════════════════════════════════
  // 4. VALUE INTEGRITY
  // ══════════════════════════════════════

  const finalValue = (assignment as any)?.final_value;
  const estimatedValue = (assignment as any)?.estimated_value;
  const hasValue = !!finalValue || !!estimatedValue;

  checks.push({
    code: "QC_VALUE_EXISTS",
    label_ar: "وجود القيمة النهائية",
    label_en: "Final value exists",
    category: "value_integrity",
    passed: hasValue,
    mandatory: true,
    details_ar: hasValue ? undefined : "القيمة النهائية غير محددة",
  });

  // Check value is positive and reasonable
  const numericValue = Number(finalValue || estimatedValue || 0);
  const valuePositive = numericValue > 0;
  checks.push({
    code: "QC_VALUE_POSITIVE",
    label_ar: "القيمة موجبة وصالحة",
    label_en: "Value is positive",
    category: "value_integrity",
    passed: valuePositive,
    mandatory: true,
    details_ar: valuePositive ? undefined : "القيمة المحددة غير صالحة (صفر أو سالبة)",
  });

  // ── Compute result ──
  const passedChecks = checks.filter(c => c.passed).length;
  const failedMandatory = checks.filter(c => c.mandatory && !c.passed);
  const score = checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : 0;

  return {
    passed: failedMandatory.length === 0,
    score,
    total_checks: checks.length,
    passed_checks: passedChecks,
    failed_mandatory: failedMandatory.length,
    checks,
    blocked_reasons_ar: failedMandatory.map(c => c.details_ar || c.label_ar),
    checked_at: now,
  };
}

/* ─── Log QC result to audit trail ─── */

export async function logQCResult(
  assignmentId: string,
  result: ReportQCResult,
  userId: string
): Promise<void> {
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "create" as any,
    table_name: "report_qc",
    record_id: assignmentId,
    assignment_id: assignmentId,
    description: result.passed
      ? `اجتياز تدقيق جودة التقرير — النتيجة: ${result.score}% (${result.passed_checks}/${result.total_checks})`
      : `رفض تدقيق جودة التقرير — النتيجة: ${result.score}% — الأسباب: ${result.blocked_reasons_ar.join("، ")}`,
    new_data: {
      qc_passed: result.passed,
      qc_score: result.score,
      total_checks: result.total_checks,
      passed_checks: result.passed_checks,
      failed_mandatory: result.failed_mandatory,
      blocked_reasons: result.blocked_reasons_ar,
      checked_at: result.checked_at,
    },
  });
}
