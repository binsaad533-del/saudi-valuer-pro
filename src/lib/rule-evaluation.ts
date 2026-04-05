/**
 * Structured Rule Evaluation Engine
 * محرك تقييم القواعد السياقية
 *
 * Evaluates structured rules against valuation context and produces
 * actionable results linked to risk, confidence, and blocking systems.
 */

import type { RiskContext } from "./risk-detection";

export type RuleImpact = "warning" | "risk" | "confidence_reduction" | "blocking";
export type AssetTypeFilter = "real_estate" | "machinery" | "both";

export interface StructuredRule {
  id: string;
  rule_title_ar: string;
  rule_content: string;
  category: string;
  severity: string;
  rule_type: string;
  enforcement_stage: string[];
  applicable_asset_type: AssetTypeFilter;
  condition_text: string | null;
  requirement_text: string | null;
  impact_type: RuleImpact;
  is_active: boolean;
}

export interface RuleEvaluation {
  rule: StructuredRule;
  passed: boolean;
  message: string;
  impact: RuleImpact;
}

export interface RuleEvaluationReport {
  total: number;
  passed: number;
  failed: number;
  warnings: RuleEvaluation[];
  risks: RuleEvaluation[];
  confidenceReductions: RuleEvaluation[];
  blockers: RuleEvaluation[];
  confidencePenalty: number; // 0 to -20
  hasBlockers: boolean;
}

export interface EvaluationContext extends RiskContext {
  assetType?: "real_estate" | "machinery";
  currentStage?: string;
}

/**
 * Filter rules applicable to current context
 */
function filterRules(rules: StructuredRule[], ctx: EvaluationContext): StructuredRule[] {
  return rules.filter((r) => {
    if (!r.is_active) return false;

    // Asset type filter
    if (r.applicable_asset_type !== "both" && ctx.assetType && r.applicable_asset_type !== ctx.assetType) {
      return false;
    }

    // Stage filter
    if (ctx.currentStage && r.enforcement_stage.length > 0) {
      if (!r.enforcement_stage.includes(ctx.currentStage)) return false;
    }

    return true;
  });
}

/**
 * Evaluate a single rule against context.
 * Uses heuristic matching based on rule category and known context fields.
 */
function evaluateRule(rule: StructuredRule, ctx: EvaluationContext): RuleEvaluation {
  const base = { rule, impact: rule.impact_type };

  // Data quality rules
  if (rule.category === "data_quality") {
    const missing = ctx.missingFieldsCount ?? 0;
    if (missing > 3) {
      return { ...base, passed: false, message: `${missing} حقول مفقودة من بيانات الأصل` };
    }
    if (ctx.extractionConfidence != null && ctx.extractionConfidence < 0.6) {
      return { ...base, passed: false, message: "ثقة الاستخراج أقل من 60%" };
    }
    return { ...base, passed: true, message: "بيانات الأصل مكتملة" };
  }

  // Methodology rules
  if (rule.category === "methodology") {
    const approaches = ctx.approachesApplied ?? 0;
    if (rule.rule_type === "required_field" && approaches === 0) {
      return { ...base, passed: false, message: "لم يتم تحديد أي منهجية تقييم" };
    }
    if (!ctx.hasJustification) {
      return { ...base, passed: false, message: "لم يتم توثيق مبرر اختيار المنهجية" };
    }
    if (ctx.reconciliationDone === false && approaches >= 2) {
      return { ...base, passed: false, message: "لم تتم المصالحة بين المنهجيات" };
    }
    return { ...base, passed: true, message: "المنهجية مبررة ومتسقة" };
  }

  // Compliance rules
  if (rule.category === "compliance") {
    if (!ctx.hasAssumptions) {
      return { ...base, passed: false, message: "الافتراضات غير محددة" };
    }
    if (!ctx.hasScopeOfWork) {
      return { ...base, passed: false, message: "نطاق العمل غير محدد" };
    }
    if (!ctx.purposeDefined) {
      return { ...base, passed: false, message: "الغرض من التقييم غير محدد" };
    }
    if (!ctx.basisOfValueDefined) {
      return { ...base, passed: false, message: "أساس القيمة غير محدد" };
    }
    if (ctx.hasBlockingIssues) {
      return { ...base, passed: false, message: "توجد مشاكل امتثال حرجة" };
    }
    return { ...base, passed: true, message: "متوافق مع المعايير" };
  }

  // Valuation rules
  if (rule.category === "valuation") {
    if (ctx.comparablesCount != null && ctx.comparablesCount < 3) {
      return { ...base, passed: false, message: `عدد المقارنات ${ctx.comparablesCount} (المطلوب 3+)` };
    }
    if (ctx.priceVariancePct != null && ctx.priceVariancePct > 30) {
      return { ...base, passed: false, message: `تباين سعري ${ctx.priceVariancePct}%` };
    }
    return { ...base, passed: true, message: "حسابات التقييم سليمة" };
  }

  // Reporting rules
  if (rule.category === "reporting") {
    if (!ctx.hasInspection && ctx.inspectionRequired !== false) {
      return { ...base, passed: false, message: "التقرير بدون معاينة ميدانية" };
    }
    if (!ctx.valuationDateSet) {
      return { ...base, passed: false, message: "تاريخ التقييم غير محدد" };
    }
    return { ...base, passed: true, message: "متطلبات التقرير مستوفاة" };
  }

  // Default pass
  return { ...base, passed: true, message: "القاعدة مستوفاة" };
}

/**
 * Main evaluation entry point
 */
export function evaluateRules(
  rules: StructuredRule[],
  ctx: EvaluationContext
): RuleEvaluationReport {
  const applicable = filterRules(rules, ctx);
  const results = applicable.map((r) => evaluateRule(r, ctx));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  const warnings = failed.filter((r) => r.impact === "warning");
  const risks = failed.filter((r) => r.impact === "risk");
  const confidenceReductions = failed.filter((r) => r.impact === "confidence_reduction");
  const blockers = failed.filter((r) => r.impact === "blocking");

  // Calculate confidence penalty
  const penalty = Math.min(
    20,
    blockers.length * 6 + confidenceReductions.length * 4 + risks.length * 2 + warnings.length * 1
  );

  return {
    total: applicable.length,
    passed,
    failed: failed.length,
    warnings,
    risks,
    confidenceReductions,
    blockers,
    confidencePenalty: -penalty,
    hasBlockers: blockers.length > 0,
  };
}

// Labels
export const IMPACT_LABELS: Record<RuleImpact, { ar: string; color: string }> = {
  warning: { ar: "تحذير", color: "text-amber-600" },
  risk: { ar: "خطر", color: "text-orange-600" },
  confidence_reduction: { ar: "تخفيض ثقة", color: "text-blue-600" },
  blocking: { ar: "حجب", color: "text-red-600" },
};

export const ASSET_TYPE_LABELS: Record<AssetTypeFilter, string> = {
  real_estate: "عقارات",
  machinery: "آلات ومعدات",
  both: "الكل",
};
