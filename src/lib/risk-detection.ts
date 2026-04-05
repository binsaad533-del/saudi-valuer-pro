/**
 * Smart Valuation Risk Detection Engine
 * نظام الكشف الذكي عن مخاطر التقييم
 */

import type { ValuationContext } from "./confidence-scoring";

// ── Types ──────────────────────────────────────────────

export type RiskCategory = "data" | "method" | "market" | "compliance" | "operational";
export type RiskSeverity = "high" | "medium" | "low";
export type OverallRiskLevel = "high" | "medium" | "low";

export interface DetectedRisk {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title_ar: string;
  description_ar: string;
  action_ar: string;
}

export interface RiskReport {
  overallLevel: OverallRiskLevel;
  totalHigh: number;
  totalMedium: number;
  totalLow: number;
  risks: DetectedRisk[];
}

export interface RiskContext extends ValuationContext {
  // Market risk inputs
  comparablesCount?: number;
  comparablesMaxAge?: number; // months
  priceVariancePct?: number; // max variance among comparables

  // Operational risk inputs
  hasInspection?: boolean;
  inspectionRequired?: boolean;
  workflowComplete?: boolean;
  daysSinceRequest?: number;
  valuationDateSet?: boolean;
  purposeDefined?: boolean;
  basisOfValueDefined?: boolean;
  reconciliationDone?: boolean;
}

// ── Category labels ────────────────────────────────────

export const CATEGORY_LABELS: Record<RiskCategory, { ar: string; en: string }> = {
  data: { ar: "مخاطر البيانات", en: "Data Risk" },
  method: { ar: "مخاطر المنهجية", en: "Method Risk" },
  market: { ar: "مخاطر السوق", en: "Market Risk" },
  compliance: { ar: "مخاطر الامتثال", en: "Compliance Risk" },
  operational: { ar: "مخاطر تشغيلية", en: "Operational Risk" },
};

export const SEVERITY_LABELS: Record<RiskSeverity, { ar: string; en: string }> = {
  high: { ar: "عالية", en: "High" },
  medium: { ar: "متوسطة", en: "Medium" },
  low: { ar: "منخفضة", en: "Low" },
};

// ── Detection rules ────────────────────────────────────

function detectDataRisks(ctx: RiskContext): DetectedRisk[] {
  const risks: DetectedRisk[] = [];

  const missing = ctx.missingFieldsCount ?? 0;
  if (missing >= 5) {
    risks.push({
      id: "data-missing-critical",
      category: "data",
      severity: "high",
      title_ar: "نقص بيانات رئيسية",
      description_ar: `يوجد ${missing} حقول مفقودة من بيانات الأصل`,
      action_ar: "أكمل جميع الحقول المطلوبة قبل المتابعة",
    });
  } else if (missing > 0) {
    risks.push({
      id: "data-missing-minor",
      category: "data",
      severity: "medium",
      title_ar: "بيانات ناقصة",
      description_ar: `يوجد ${missing} حقول غير مكتملة`,
      action_ar: "راجع بيانات الأصل وأكمل الحقول الناقصة",
    });
  }

  if (ctx.extractionConfidence != null && ctx.extractionConfidence < 0.6) {
    risks.push({
      id: "data-low-confidence",
      category: "data",
      severity: "high",
      title_ar: "ثقة استخراج منخفضة",
      description_ar: "البيانات المستخرجة بثقة أقل من 60%",
      action_ar: "تحقق يدوياً من البيانات المستخرجة",
    });
  } else if (ctx.extractionConfidence != null && ctx.extractionConfidence < 0.75) {
    risks.push({
      id: "data-moderate-confidence",
      category: "data",
      severity: "low",
      title_ar: "ثقة استخراج متوسطة",
      description_ar: "بعض البيانات قد تحتاج مراجعة",
      action_ar: "راجع البيانات ذات الثقة المنخفضة",
    });
  }

  return risks;
}

function detectMethodRisks(ctx: RiskContext): DetectedRisk[] {
  const risks: DetectedRisk[] = [];
  const approaches = ctx.approachesApplied ?? (ctx.methodsUsed?.length ?? 0);

  if (approaches === 0) {
    risks.push({
      id: "method-none",
      category: "method",
      severity: "high",
      title_ar: "لم يتم اختيار منهجية",
      description_ar: "لا توجد منهجية تقييم محددة",
      action_ar: "حدد منهجية تقييم مناسبة",
    });
  } else if (approaches === 1) {
    risks.push({
      id: "method-single",
      category: "method",
      severity: "medium",
      title_ar: "منهجية واحدة فقط",
      description_ar: "استخدام منهجية واحدة يضعف موثوقية التقييم",
      action_ar: "أضف منهجية ثانية للتحقق من النتائج",
    });
  }

  if (!ctx.hasJustification) {
    risks.push({
      id: "method-no-justification",
      category: "method",
      severity: "medium",
      title_ar: "تبرير المنهجية غير موجود",
      description_ar: "لم يتم توثيق سبب اختيار المنهجية",
      action_ar: "وثّق مبررات اختيار المنهجية المستخدمة",
    });
  }

  if (ctx.reconciliationDone === false && approaches >= 2) {
    risks.push({
      id: "method-no-reconciliation",
      category: "method",
      severity: "high",
      title_ar: "لم تتم المصالحة بين المنهجيات",
      description_ar: "توجد أكثر من منهجية بدون مصالحة للنتائج",
      action_ar: "أجرِ المصالحة بين نتائج المنهجيات المختلفة",
    });
  }

  return risks;
}

function detectMarketRisks(ctx: RiskContext): DetectedRisk[] {
  const risks: DetectedRisk[] = [];

  if (ctx.comparablesCount != null && ctx.comparablesCount < 3) {
    risks.push({
      id: "market-few-comparables",
      category: "market",
      severity: ctx.comparablesCount === 0 ? "high" : "medium",
      title_ar: "ضعف المقارنات السوقية",
      description_ar: `عدد المقارنات: ${ctx.comparablesCount} (المطلوب 3 على الأقل)`,
      action_ar: "أضف مقارنات سوقية إضافية لتعزيز التحليل",
    });
  }

  if (ctx.comparablesMaxAge != null && ctx.comparablesMaxAge > 12) {
    risks.push({
      id: "market-outdated",
      category: "market",
      severity: ctx.comparablesMaxAge > 24 ? "high" : "medium",
      title_ar: "بيانات سوقية قديمة",
      description_ar: `أقدم مقارنة عمرها ${ctx.comparablesMaxAge} شهراً`,
      action_ar: "استخدم بيانات سوقية أحدث",
    });
  }

  if (ctx.priceVariancePct != null && ctx.priceVariancePct > 30) {
    risks.push({
      id: "market-high-variance",
      category: "market",
      severity: "high",
      title_ar: "تباين سعري غير طبيعي",
      description_ar: `التباين بين المقارنات يبلغ ${ctx.priceVariancePct}%`,
      action_ar: "راجع المقارنات واستبعد القيم الشاذة",
    });
  } else if (ctx.priceVariancePct != null && ctx.priceVariancePct > 20) {
    risks.push({
      id: "market-moderate-variance",
      category: "market",
      severity: "medium",
      title_ar: "تباين ملحوظ في الأسعار",
      description_ar: `التباين بين المقارنات يبلغ ${ctx.priceVariancePct}%`,
      action_ar: "تحقق من صحة التعديلات على المقارنات",
    });
  }

  return risks;
}

function detectComplianceRisks(ctx: RiskContext): DetectedRisk[] {
  const risks: DetectedRisk[] = [];

  if (!ctx.hasAssumptions) {
    risks.push({
      id: "compliance-no-assumptions",
      category: "compliance",
      severity: "high",
      title_ar: "الافتراضات غير محددة",
      description_ar: "لم يتم توثيق الافتراضات والمحددات الخاصة",
      action_ar: "حدد ووثّق جميع الافتراضات المهنية",
    });
  }

  if (!ctx.hasScopeOfWork) {
    risks.push({
      id: "compliance-no-scope",
      category: "compliance",
      severity: "high",
      title_ar: "نطاق العمل غير محدد",
      description_ar: "لم يتم تحديد نطاق عمل التقييم",
      action_ar: "حدد نطاق العمل بوضوح",
    });
  }

  if (!ctx.purposeDefined) {
    risks.push({
      id: "compliance-no-purpose",
      category: "compliance",
      severity: "high",
      title_ar: "الغرض من التقييم غير محدد",
      description_ar: "لم يتم تحديد الغرض من التقييم",
      action_ar: "حدد الغرض من التقييم",
    });
  }

  if (!ctx.basisOfValueDefined) {
    risks.push({
      id: "compliance-no-basis",
      category: "compliance",
      severity: "high",
      title_ar: "أساس القيمة غير محدد",
      description_ar: "لم يتم تحديد أساس القيمة المستخدم",
      action_ar: "حدد أساس القيمة (سوقية، استثمارية، إلخ)",
    });
  }

  if (ctx.hasBlockingIssues) {
    risks.push({
      id: "compliance-blocking",
      category: "compliance",
      severity: "high",
      title_ar: "مشاكل حرجة غير محلولة",
      description_ar: "توجد مخالفات حرجة تمنع الإصدار",
      action_ar: "عالج جميع المشاكل الحرجة أولاً",
    });
  }

  if (ctx.criticalRulesTotal && ctx.criticalRulesPassed != null) {
    const failed = ctx.criticalRulesTotal - ctx.criticalRulesPassed;
    if (failed > 0) {
      risks.push({
        id: "compliance-rules-failed",
        category: "compliance",
        severity: failed >= 3 ? "high" : "medium",
        title_ar: "قواعد امتثال غير مستوفاة",
        description_ar: `${failed} قاعدة من ${ctx.criticalRulesTotal} لم تُستوفَ`,
        action_ar: "راجع قواعد الامتثال غير المستوفاة",
      });
    }
  }

  return risks;
}

function detectOperationalRisks(ctx: RiskContext): DetectedRisk[] {
  const risks: DetectedRisk[] = [];

  if (ctx.inspectionRequired !== false && !ctx.hasInspection) {
    risks.push({
      id: "ops-no-inspection",
      category: "operational",
      severity: "high",
      title_ar: "لم تتم المعاينة الميدانية",
      description_ar: "التقييم بدون معاينة ميدانية",
      action_ar: "أجرِ معاينة ميدانية أو وثّق مبررات التقييم المكتبي",
    });
  }

  if (ctx.workflowComplete === false) {
    risks.push({
      id: "ops-incomplete-workflow",
      category: "operational",
      severity: "medium",
      title_ar: "خطوات سير العمل غير مكتملة",
      description_ar: "بعض مراحل التقييم لم تُستكمل",
      action_ar: "أكمل جميع مراحل سير العمل المطلوبة",
    });
  }

  if (ctx.daysSinceRequest != null && ctx.daysSinceRequest <= 1) {
    risks.push({
      id: "ops-rushed",
      category: "operational",
      severity: "medium",
      title_ar: "تقييم سريع جداً",
      description_ar: "تم إنجاز التقييم خلال يوم واحد أو أقل",
      action_ar: "تأكد من اكتمال جميع مراحل الفحص والتحليل",
    });
  }

  if (!ctx.valuationDateSet) {
    risks.push({
      id: "ops-no-date",
      category: "operational",
      severity: "low",
      title_ar: "تاريخ التقييم غير محدد",
      description_ar: "لم يتم تحديد تاريخ التقييم الفعلي",
      action_ar: "حدد تاريخ التقييم",
    });
  }

  return risks;
}

// ── Main entry ─────────────────────────────────────────

export function detectRisks(ctx: RiskContext): RiskReport {
  const risks = [
    ...detectDataRisks(ctx),
    ...detectMethodRisks(ctx),
    ...detectMarketRisks(ctx),
    ...detectComplianceRisks(ctx),
    ...detectOperationalRisks(ctx),
  ];

  const totalHigh = risks.filter((r) => r.severity === "high").length;
  const totalMedium = risks.filter((r) => r.severity === "medium").length;
  const totalLow = risks.filter((r) => r.severity === "low").length;

  const overallLevel: OverallRiskLevel =
    totalHigh >= 2 ? "high" : totalHigh === 1 || totalMedium >= 3 ? "medium" : "low";

  return { overallLevel, totalHigh, totalMedium, totalLow, risks };
}

/**
 * Compute a risk-adjusted confidence penalty.
 * Returns a negative number (0 to -15) to subtract from the confidence score.
 */
export function riskConfidencePenalty(report: RiskReport): number {
  const penalty = report.totalHigh * 5 + report.totalMedium * 2 + report.totalLow * 0.5;
  return -Math.min(15, Math.round(penalty));
}
