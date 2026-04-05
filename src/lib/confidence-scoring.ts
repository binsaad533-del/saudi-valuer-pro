/**
 * Valuation Confidence Scoring Engine
 * نظام تسجيل الثقة في التقييم
 *
 * Calculates a weighted confidence score based on 4 components:
 * 1. Data Quality (40%)
 * 2. Method Strength (25%)
 * 3. Compliance (20%)
 * 4. Result Consistency (15%)
 */

// ── Types ──────────────────────────────────────────────

export interface ComponentScore {
  score: number; // 0-100
  label_ar: string;
  label_en: string;
  weight: number;
  details: string[];
}

export interface ConfidenceResult {
  overall: number; // 0-100
  level: ConfidenceLevel;
  components: {
    dataQuality: ComponentScore;
    methodStrength: ComponentScore;
    compliance: ComponentScore;
    consistency: ComponentScore;
  };
}

export type ConfidenceLevel = "high" | "good" | "moderate" | "low";

export interface ValuationContext {
  // Data quality inputs
  assetFields?: Record<string, unknown>;
  requiredFields?: string[];
  extractionConfidence?: number; // 0-1
  missingFieldsCount?: number;

  // Method strength inputs
  methodsUsed?: string[];
  hasJustification?: boolean;
  approachesApplied?: number; // how many of market/cost/income

  // Compliance inputs
  criticalRulesPassed?: number;
  criticalRulesTotal?: number;
  hasAssumptions?: boolean;
  hasScopeOfWork?: boolean;
  hasBlockingIssues?: boolean;

  // Consistency inputs
  methodValues?: number[]; // values from different approaches
  finalValue?: number;
}

// ── Weights ────────────────────────────────────────────

const WEIGHTS = {
  dataQuality: 0.4,
  methodStrength: 0.25,
  compliance: 0.2,
  consistency: 0.15,
} as const;

// ── Component scorers ──────────────────────────────────

function scoreDataQuality(ctx: ValuationContext): ComponentScore {
  const details: string[] = [];
  let total = 0;
  let factors = 0;

  // Field completeness
  if (ctx.assetFields && ctx.requiredFields) {
    const filled = ctx.requiredFields.filter(
      (f) => ctx.assetFields![f] != null && ctx.assetFields![f] !== ""
    ).length;
    const pct = ctx.requiredFields.length > 0 ? (filled / ctx.requiredFields.length) * 100 : 100;
    total += pct;
    factors++;
    if (pct < 80) details.push("بيانات الأصل غير مكتملة");
  } else {
    total += 70; // default if unknown
    factors++;
  }

  // Extraction confidence
  if (ctx.extractionConfidence != null) {
    total += ctx.extractionConfidence * 100;
    factors++;
    if (ctx.extractionConfidence < 0.7) details.push("ثقة الاستخراج منخفضة");
  } else {
    total += 75;
    factors++;
  }

  // Missing fields penalty
  const missing = ctx.missingFieldsCount ?? 0;
  const missingPenalty = Math.max(0, 100 - missing * 10);
  total += missingPenalty;
  factors++;
  if (missing > 3) details.push(`${missing} حقول مفقودة`);

  if (details.length === 0) details.push("بيانات مكتملة وموثوقة");

  return {
    score: Math.round(total / factors),
    label_ar: "جودة البيانات",
    label_en: "Data Quality",
    weight: WEIGHTS.dataQuality,
    details,
  };
}

function scoreMethodStrength(ctx: ValuationContext): ComponentScore {
  const details: string[] = [];
  let score = 50; // baseline

  const approaches = ctx.approachesApplied ?? (ctx.methodsUsed?.length ?? 0);
  if (approaches >= 3) {
    score += 30;
    details.push("ثلاث منهجيات مطبقة");
  } else if (approaches === 2) {
    score += 20;
    details.push("منهجيتان مطبقتان");
  } else if (approaches === 1) {
    score += 5;
    details.push("منهجية واحدة فقط");
  } else {
    details.push("لم يتم تحديد المنهجية");
  }

  if (ctx.hasJustification) {
    score += 20;
  } else {
    details.push("لا يوجد تبرير لاختيار المنهجية");
  }

  if (details.length === 0) details.push("منهجية قوية ومبررة");

  return {
    score: Math.min(100, Math.round(score)),
    label_ar: "قوة المنهجية",
    label_en: "Method Strength",
    weight: WEIGHTS.methodStrength,
    details,
  };
}

function scoreCompliance(ctx: ValuationContext): ComponentScore {
  const details: string[] = [];
  let score = 0;
  let factors = 0;

  // Critical rules
  if (ctx.criticalRulesTotal != null && ctx.criticalRulesTotal > 0) {
    const pct = ((ctx.criticalRulesPassed ?? 0) / ctx.criticalRulesTotal) * 100;
    score += pct;
    factors++;
    if (pct < 100) details.push("بعض القواعد الحرجة لم تُستوفَ");
  } else {
    score += 80;
    factors++;
  }

  // Assumptions
  if (ctx.hasAssumptions) {
    score += 100;
  } else {
    score += 30;
    details.push("الافتراضات غير محددة");
  }
  factors++;

  // Scope of work
  if (ctx.hasScopeOfWork) {
    score += 100;
  } else {
    score += 40;
    details.push("نطاق العمل غير محدد");
  }
  factors++;

  // Blocking issues
  if (ctx.hasBlockingIssues) {
    score -= 30;
    details.push("يوجد مشاكل حرجة تحتاج معالجة");
  }

  if (details.length === 0) details.push("متوافق مع المعايير المهنية");

  return {
    score: Math.max(0, Math.min(100, Math.round(score / factors))),
    label_ar: "الامتثال",
    label_en: "Compliance",
    weight: WEIGHTS.compliance,
    details,
  };
}

function scoreConsistency(ctx: ValuationContext): ComponentScore {
  const details: string[] = [];

  if (!ctx.methodValues || ctx.methodValues.length < 2) {
    return {
      score: 75, // neutral when we can't compare
      label_ar: "اتساق النتائج",
      label_en: "Result Consistency",
      weight: WEIGHTS.consistency,
      details: ["لا تتوفر قيم متعددة للمقارنة"],
    };
  }

  const values = ctx.methodValues.filter((v) => v > 0);
  if (values.length < 2) {
    return {
      score: 75,
      label_ar: "اتساق النتائج",
      label_en: "Result Consistency",
      weight: WEIGHTS.consistency,
      details: ["لا تتوفر قيم متعددة للمقارنة"],
    };
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const maxVariance = Math.max(...values.map((v) => Math.abs(v - avg) / avg)) * 100;

  let score: number;
  if (maxVariance <= 5) {
    score = 100;
    details.push("تطابق ممتاز بين المنهجيات");
  } else if (maxVariance <= 10) {
    score = 90;
    details.push("تباين بسيط بين المنهجيات");
  } else if (maxVariance <= 20) {
    score = 70;
    details.push("تباين متوسط بين المنهجيات");
  } else if (maxVariance <= 35) {
    score = 50;
    details.push("تباين ملحوظ بين المنهجيات");
  } else {
    score = 25;
    details.push("تباين كبير جداً — يُنصح بالمراجعة");
  }

  return {
    score,
    label_ar: "اتساق النتائج",
    label_en: "Result Consistency",
    weight: WEIGHTS.consistency,
    details,
  };
}

// ── Level classifier ───────────────────────────────────

function classify(score: number): ConfidenceLevel {
  if (score >= 90) return "high";
  if (score >= 75) return "good";
  if (score >= 60) return "moderate";
  return "low";
}

// ── Main entry ─────────────────────────────────────────

export function calculateConfidence(ctx: ValuationContext): ConfidenceResult {
  const dataQuality = scoreDataQuality(ctx);
  const methodStrength = scoreMethodStrength(ctx);
  const compliance = scoreCompliance(ctx);
  const consistency = scoreConsistency(ctx);

  const overall = Math.round(
    dataQuality.score * dataQuality.weight +
      methodStrength.score * methodStrength.weight +
      compliance.score * compliance.weight +
      consistency.score * consistency.weight
  );

  return {
    overall,
    level: classify(overall),
    components: { dataQuality, methodStrength, compliance, consistency },
  };
}

// ── Labels ─────────────────────────────────────────────

export const LEVEL_LABELS: Record<ConfidenceLevel, { ar: string; en: string }> = {
  high: { ar: "ثقة عالية", en: "High Confidence" },
  good: { ar: "ثقة جيدة", en: "Good Confidence" },
  moderate: { ar: "ثقة متوسطة", en: "Moderate Confidence" },
  low: { ar: "ثقة منخفضة", en: "Low Confidence" },
};
