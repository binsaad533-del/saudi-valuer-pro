/**
 * Smart Valuation Decision Engine
 * محرك القرار الذكي للتقييم
 */

import type { ConfidenceResult } from "./confidence-scoring";
import type { RiskReport } from "./risk-detection";

export type DecisionStatus = "approved" | "review" | "high_risk" | "rejected";

export interface DecisionResult {
  status: DecisionStatus;
  title_ar: string;
  explanation_ar: string;
  topIssues: string[];
}

export const DECISION_META: Record<DecisionStatus, { ar: string; en: string }> = {
  approved: { ar: "جاهز للاعتماد", en: "Ready for Approval" },
  review: { ar: "يحتاج مراجعة", en: "Needs Review" },
  high_risk: { ar: "مخاطر عالية — مراجعة مطلوبة", en: "High Risk – Review Required" },
  rejected: { ar: "مرفوض — مشاكل حرجة", en: "Rejected" },
};

export function evaluateDecision(
  compliancePassed: boolean,
  confidence: ConfidenceResult,
  risks: RiskReport
): DecisionResult {
  const issues: string[] = [];

  // ── Rejected ──
  if (!compliancePassed) {
    issues.push("فشل فحص الامتثال المهني");
    if (risks.totalHigh > 0)
      issues.push(`${risks.totalHigh} مخاطر عالية مكتشفة`);
    return {
      status: "rejected",
      title_ar: DECISION_META.rejected.ar,
      explanation_ar: "لا يمكن اعتماد التقييم بسبب عدم اجتياز متطلبات الامتثال الأساسية.",
      topIssues: issues.slice(0, 3),
    };
  }

  // Gather issues for context
  if (confidence.overall < 80) issues.push(`مؤشر الثقة ${confidence.overall}%`);
  if (risks.totalHigh > 0) issues.push(`${risks.totalHigh} مخاطر عالية`);
  if (risks.totalMedium > 0) issues.push(`${risks.totalMedium} مخاطر متوسطة`);

  // Add top risk descriptions
  const topRiskTitles = risks.risks
    .filter((r) => r.severity === "high" || r.severity === "medium")
    .slice(0, 3)
    .map((r) => r.title_ar);
  for (const t of topRiskTitles) {
    if (!issues.includes(t)) issues.push(t);
  }

  // ── High Risk ──
  if (confidence.overall < 60 || risks.totalHigh >= 2) {
    return {
      status: "high_risk",
      title_ar: DECISION_META.high_risk.ar,
      explanation_ar: "التقييم يحتوي على مخاطر جوهرية أو ثقة منخفضة تستوجب مراجعة شاملة قبل الاعتماد.",
      topIssues: issues.slice(0, 3),
    };
  }

  // ── Needs Review ──
  if (confidence.overall < 80 || risks.totalHigh > 0 || risks.totalMedium >= 2) {
    return {
      status: "review",
      title_ar: DECISION_META.review.ar,
      explanation_ar: "التقييم جيد لكن يحتاج مراجعة بعض النقاط قبل الاعتماد النهائي.",
      topIssues: issues.slice(0, 3),
    };
  }

  // ── Ready ──
  return {
    status: "approved",
    title_ar: DECISION_META.approved.ar,
    explanation_ar: "التقييم مكتمل ومتوافق مع المعايير المهنية وجاهز للاعتماد.",
    topIssues: [],
  };
}
