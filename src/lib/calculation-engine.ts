/**
 * Deterministic Calculation Engine — NO AI
 * All financial calculations are pure code with auditable formulas.
 */

// ============================================================
// ADJUSTMENT RULES (fixed ranges, not AI-generated)
// ============================================================
export const ADJUSTMENT_RULES = {
  location: { min: -0.20, max: 0.20, label_ar: "تعديل الموقع", label_en: "Location Adjustment" },
  size: { min: -0.15, max: 0.15, label_ar: "تعديل المساحة", label_en: "Size Adjustment" },
  age: { min: -0.30, max: 0.00, label_ar: "تعديل العمر", label_en: "Age Adjustment" },
  condition: { min: -0.20, max: 0.10, label_ar: "تعديل الحالة", label_en: "Condition Adjustment" },
  time: { min: -0.10, max: 0.15, label_ar: "تعديل الوقت", label_en: "Time Adjustment" },
} as const;

export type AdjustmentType = keyof typeof ADJUSTMENT_RULES;

export interface Adjustment {
  type: AdjustmentType;
  percentage: number; // e.g. 0.05 = +5%
  raw_value?: number;
  justification_ar?: string;
  justification_en?: string;
}

export interface AuditStep {
  step: number;
  label_ar: string;
  label_en: string;
  formula: string;
  inputs: Record<string, number | string>;
  result: number;
  unit: string;
}

export interface ValidationError {
  code: string;
  message_ar: string;
  message_en: string;
  severity: "error" | "warning";
}

// ============================================================
// VALIDATION
// ============================================================
export function validateAdjustment(adj: Adjustment): ValidationError | null {
  const rule = ADJUSTMENT_RULES[adj.type];
  if (!rule) return { code: "INVALID_ADJ_TYPE", message_ar: "نوع تعديل غير صالح", message_en: "Invalid adjustment type", severity: "error" };
  if (adj.percentage < rule.min || adj.percentage > rule.max) {
    return {
      code: "ADJ_OUT_OF_RANGE",
      message_ar: `${rule.label_ar}: ${(adj.percentage * 100).toFixed(1)}% خارج النطاق المسموح (${(rule.min * 100).toFixed(0)}% إلى ${(rule.max * 100).toFixed(0)}%)`,
      message_en: `${rule.label_en}: ${(adj.percentage * 100).toFixed(1)}% outside allowed range (${(rule.min * 100).toFixed(0)}% to ${(rule.max * 100).toFixed(0)}%)`,
      severity: "error",
    };
  }
  return null;
}

export function validateAllAdjustments(adjustments: Adjustment[]): ValidationError[] {
  return adjustments.map(validateAdjustment).filter((e): e is ValidationError => e !== null);
}

// ============================================================
// MARKET APPROACH (Sales Comparison)
// ============================================================
export interface ComparableInput {
  id: string;
  price: number;
  area_sqm: number;
  adjustments: Adjustment[];
}

export interface MarketApproachResult {
  concluded_value: number;
  price_per_sqm: number;
  comparables_used: number;
  adjusted_prices: Array<{ comparable_id: string; base_price_sqm: number; adjusted_price_sqm: number; total_adjustment: number }>;
  audit_trail: AuditStep[];
  validation_errors: ValidationError[];
}

export function calculateMarketApproach(
  comparables: ComparableInput[],
  subject_area_sqm: number,
  weights?: number[] // optional per-comparable weights
): MarketApproachResult {
  const audit: AuditStep[] = [];
  const allErrors: ValidationError[] = [];
  let stepNum = 1;

  if (comparables.length === 0) {
    return { concluded_value: 0, price_per_sqm: 0, comparables_used: 0, adjusted_prices: [], audit_trail: audit, validation_errors: [{ code: "NO_COMPARABLES", message_ar: "لا توجد مقارنات", message_en: "No comparables provided", severity: "error" }] };
  }

  const adjusted: Array<{ comparable_id: string; base_price_sqm: number; adjusted_price_sqm: number; total_adjustment: number }> = [];

  for (const comp of comparables) {
    // Validate adjustments
    const errors = validateAllAdjustments(comp.adjustments);
    allErrors.push(...errors);

    const base_price_sqm = comp.price / comp.area_sqm;
    audit.push({
      step: stepNum++,
      label_ar: `سعر المتر الأساسي - مقارن ${comp.id.slice(0, 8)}`,
      label_en: `Base price/sqm - Comparable ${comp.id.slice(0, 8)}`,
      formula: "base_price_sqm = price / area",
      inputs: { price: comp.price, area: comp.area_sqm },
      result: Math.round(base_price_sqm * 100) / 100,
      unit: "SAR/sqm",
    });

    // Apply adjustments: adjusted = base * (1 + sum(adjustments))
    const totalAdj = comp.adjustments.reduce((sum, a) => sum + a.percentage, 0);
    const adjusted_price_sqm = base_price_sqm * (1 + totalAdj);

    audit.push({
      step: stepNum++,
      label_ar: `السعر المعدّل - مقارن ${comp.id.slice(0, 8)}`,
      label_en: `Adjusted price - Comparable ${comp.id.slice(0, 8)}`,
      formula: "adjusted_price = base_price * (1 + location_adj + size_adj + age_adj + condition_adj + time_adj)",
      inputs: {
        base_price_sqm: Math.round(base_price_sqm * 100) / 100,
        total_adjustment_pct: Math.round(totalAdj * 10000) / 100,
        ...Object.fromEntries(comp.adjustments.map(a => [`${a.type}_adj`, `${(a.percentage * 100).toFixed(1)}%`])),
      },
      result: Math.round(adjusted_price_sqm * 100) / 100,
      unit: "SAR/sqm",
    });

    adjusted.push({
      comparable_id: comp.id,
      base_price_sqm: Math.round(base_price_sqm * 100) / 100,
      adjusted_price_sqm: Math.round(adjusted_price_sqm * 100) / 100,
      total_adjustment: Math.round(totalAdj * 10000) / 100,
    });
  }

  // Weighted average
  let avg_adjusted_sqm: number;
  if (weights && weights.length === comparables.length) {
    const wSum = weights.reduce((a, b) => a + b, 0);
    avg_adjusted_sqm = adjusted.reduce((sum, a, i) => sum + a.adjusted_price_sqm * (weights[i] / wSum), 0);
  } else {
    avg_adjusted_sqm = adjusted.reduce((sum, a) => sum + a.adjusted_price_sqm, 0) / adjusted.length;
  }

  audit.push({
    step: stepNum++,
    label_ar: "متوسط سعر المتر المعدّل",
    label_en: "Average adjusted price/sqm",
    formula: weights ? "weighted_avg = Σ(adjusted_price * weight) / Σ(weights)" : "avg = Σ(adjusted_price) / count",
    inputs: { count: adjusted.length },
    result: Math.round(avg_adjusted_sqm * 100) / 100,
    unit: "SAR/sqm",
  });

  const concluded_value = avg_adjusted_sqm * subject_area_sqm;

  audit.push({
    step: stepNum++,
    label_ar: "القيمة بأسلوب المقارنة",
    label_en: "Market approach value",
    formula: "value = avg_adjusted_price_sqm * subject_area",
    inputs: { avg_price_sqm: Math.round(avg_adjusted_sqm * 100) / 100, subject_area: subject_area_sqm },
    result: Math.round(concluded_value),
    unit: "SAR",
  });

  return {
    concluded_value: Math.round(concluded_value),
    price_per_sqm: Math.round(avg_adjusted_sqm * 100) / 100,
    comparables_used: comparables.length,
    adjusted_prices: adjusted,
    audit_trail: audit,
    validation_errors: allErrors,
  };
}

// ============================================================
// COST APPROACH
// ============================================================
export interface CostApproachInput {
  land_area_sqm: number;
  land_rate_per_sqm: number;
  building_area_sqm: number;
  replacement_cost_per_sqm: number;
  building_age_years: number;
  useful_life_years: number; // typically 40-60
  physical_depreciation_override?: number; // 0-1, optional override
  functional_obsolescence_pct?: number; // 0-1
  external_obsolescence_pct?: number; // 0-1
}

export interface CostApproachResult {
  concluded_value: number;
  land_value: number;
  replacement_cost: number;
  total_depreciation: number;
  depreciated_building_value: number;
  audit_trail: AuditStep[];
  validation_errors: ValidationError[];
}

export function calculateCostApproach(input: CostApproachInput): CostApproachResult {
  const audit: AuditStep[] = [];
  const errors: ValidationError[] = [];
  let step = 1;

  // Land value
  const land_value = input.land_area_sqm * input.land_rate_per_sqm;
  audit.push({
    step: step++,
    label_ar: "قيمة الأرض",
    label_en: "Land Value",
    formula: "land_value = land_area * land_rate",
    inputs: { land_area: input.land_area_sqm, land_rate: input.land_rate_per_sqm },
    result: Math.round(land_value),
    unit: "SAR",
  });

  // Replacement cost
  const replacement_cost = input.building_area_sqm * input.replacement_cost_per_sqm;
  audit.push({
    step: step++,
    label_ar: "تكلفة الإحلال",
    label_en: "Replacement Cost",
    formula: "replacement_cost = building_area * cost_per_sqm",
    inputs: { building_area: input.building_area_sqm, cost_per_sqm: input.replacement_cost_per_sqm },
    result: Math.round(replacement_cost),
    unit: "SAR",
  });

  // Depreciation (straight-line)
  const physical_dep = input.physical_depreciation_override ?? Math.min(input.building_age_years / input.useful_life_years, 1);
  const functional_dep = input.functional_obsolescence_pct ?? 0;
  const external_dep = input.external_obsolescence_pct ?? 0;
  const total_dep_pct = Math.min(physical_dep + functional_dep + external_dep, 1);

  if (physical_dep < 0 || physical_dep > 1) {
    errors.push({ code: "INVALID_DEPRECIATION", message_ar: "نسبة الإهلاك غير منطقية", message_en: "Invalid depreciation rate", severity: "error" });
  }

  audit.push({
    step: step++,
    label_ar: "الإهلاك الكلي",
    label_en: "Total Depreciation",
    formula: "total_dep = physical + functional + external; physical = age / useful_life",
    inputs: {
      age: input.building_age_years,
      useful_life: input.useful_life_years,
      physical_pct: Math.round(physical_dep * 10000) / 100,
      functional_pct: Math.round(functional_dep * 10000) / 100,
      external_pct: Math.round(external_dep * 10000) / 100,
      total_pct: Math.round(total_dep_pct * 10000) / 100,
    },
    result: Math.round(replacement_cost * total_dep_pct),
    unit: "SAR",
  });

  const depreciated_value = replacement_cost * (1 - total_dep_pct);
  audit.push({
    step: step++,
    label_ar: "قيمة المبنى بعد الإهلاك",
    label_en: "Depreciated Building Value",
    formula: "depreciated = replacement_cost * (1 - total_depreciation)",
    inputs: { replacement_cost: Math.round(replacement_cost), depreciation_pct: Math.round(total_dep_pct * 10000) / 100 },
    result: Math.round(depreciated_value),
    unit: "SAR",
  });

  const concluded_value = land_value + depreciated_value;
  audit.push({
    step: step++,
    label_ar: "القيمة بأسلوب التكلفة",
    label_en: "Cost Approach Value",
    formula: "total = land_value + depreciated_building_value",
    inputs: { land_value: Math.round(land_value), building_value: Math.round(depreciated_value) },
    result: Math.round(concluded_value),
    unit: "SAR",
  });

  return {
    concluded_value: Math.round(concluded_value),
    land_value: Math.round(land_value),
    replacement_cost: Math.round(replacement_cost),
    total_depreciation: Math.round(replacement_cost * total_dep_pct),
    depreciated_building_value: Math.round(depreciated_value),
    audit_trail: audit,
    validation_errors: errors,
  };
}

// ============================================================
// INCOME APPROACH
// ============================================================
export interface IncomeApproachInput {
  gross_annual_income: number;
  vacancy_rate: number; // 0-1
  operating_expenses: number;
  cap_rate: number; // e.g. 0.08 for 8%
}

export interface IncomeApproachResult {
  concluded_value: number;
  effective_gross_income: number;
  net_operating_income: number;
  audit_trail: AuditStep[];
  validation_errors: ValidationError[];
}

export function calculateIncomeApproach(input: IncomeApproachInput): IncomeApproachResult {
  const audit: AuditStep[] = [];
  const errors: ValidationError[] = [];
  let step = 1;

  // Validate cap rate
  if (input.cap_rate <= 0 || input.cap_rate > 0.25) {
    errors.push({ code: "INVALID_CAP_RATE", message_ar: `معدل الرسملة ${(input.cap_rate * 100).toFixed(1)}% غير منطقي (يجب أن يكون بين 1% و 25%)`, message_en: `Cap rate ${(input.cap_rate * 100).toFixed(1)}% is unreasonable (must be 1%-25%)`, severity: "error" });
  }

  if (input.vacancy_rate < 0 || input.vacancy_rate > 1) {
    errors.push({ code: "INVALID_VACANCY", message_ar: "معدل الشغور غير صالح", message_en: "Invalid vacancy rate", severity: "error" });
  }

  const egi = input.gross_annual_income * (1 - input.vacancy_rate);
  audit.push({
    step: step++,
    label_ar: "إجمالي الدخل الفعلي",
    label_en: "Effective Gross Income",
    formula: "EGI = gross_income * (1 - vacancy_rate)",
    inputs: { gross_income: input.gross_annual_income, vacancy_rate: `${(input.vacancy_rate * 100).toFixed(1)}%` as any },
    result: Math.round(egi),
    unit: "SAR",
  });

  const noi = egi - input.operating_expenses;
  audit.push({
    step: step++,
    label_ar: "صافي الدخل التشغيلي",
    label_en: "Net Operating Income (NOI)",
    formula: "NOI = EGI - operating_expenses",
    inputs: { egi: Math.round(egi), expenses: input.operating_expenses },
    result: Math.round(noi),
    unit: "SAR",
  });

  if (noi <= 0) {
    errors.push({ code: "NEGATIVE_NOI", message_ar: "صافي الدخل التشغيلي سالب أو صفر", message_en: "NOI is zero or negative", severity: "error" });
  }

  const value = input.cap_rate > 0 ? noi / input.cap_rate : 0;
  audit.push({
    step: step++,
    label_ar: "القيمة بأسلوب الدخل",
    label_en: "Income Approach Value",
    formula: "value = NOI / cap_rate",
    inputs: { noi: Math.round(noi), cap_rate: `${(input.cap_rate * 100).toFixed(2)}%` as any },
    result: Math.round(value),
    unit: "SAR",
  });

  return {
    concluded_value: Math.round(value),
    effective_gross_income: Math.round(egi),
    net_operating_income: Math.round(noi),
    audit_trail: audit,
    validation_errors: errors,
  };
}

// ============================================================
// RECONCILIATION (deterministic formula)
// ============================================================
export interface ReconciliationInput {
  market_value?: number;
  cost_value?: number;
  income_value?: number;
  weight_market: number;  // default 0.60
  weight_cost: number;    // default 0.25
  weight_income: number;  // default 0.15
}

export const DEFAULT_WEIGHTS = { market: 0.60, cost: 0.25, income: 0.15 };

export interface ReconciliationResult {
  final_value: number;
  weighted_values: Record<string, { value: number; weight: number; contribution: number }>;
  value_range_low: number;
  value_range_high: number;
  variance_pct: number; // max variance between methods
  audit_trail: AuditStep[];
  validation_errors: ValidationError[];
}

export function calculateReconciliation(input: ReconciliationInput): ReconciliationResult {
  const audit: AuditStep[] = [];
  const errors: ValidationError[] = [];
  let step = 1;

  // Validate weights sum to 1
  const wSum = input.weight_market + input.weight_cost + input.weight_income;
  if (Math.abs(wSum - 1) > 0.01) {
    errors.push({ code: "WEIGHTS_NOT_ONE", message_ar: `مجموع الأوزان ${(wSum * 100).toFixed(0)}% بدلاً من 100%`, message_en: `Weights sum to ${(wSum * 100).toFixed(0)}% instead of 100%`, severity: "error" });
  }

  const values = [input.market_value, input.cost_value, input.income_value].filter((v): v is number => v != null && v > 0);

  // Check variance between methods
  let variance_pct = 0;
  if (values.length >= 2) {
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    variance_pct = ((maxVal - minVal) / minVal) * 100;
    if (variance_pct > 30) {
      errors.push({ code: "HIGH_VARIANCE", message_ar: `اختلاف كبير بين الطرق: ${variance_pct.toFixed(1)}% (أكثر من 30%)`, message_en: `High variance between methods: ${variance_pct.toFixed(1)}% (>30%)`, severity: "warning" });
    }
  }

  const weighted: Record<string, { value: number; weight: number; contribution: number }> = {};
  let total = 0;

  if (input.market_value && input.market_value > 0) {
    const c = input.market_value * input.weight_market;
    weighted.market = { value: input.market_value, weight: input.weight_market, contribution: Math.round(c) };
    total += c;
    audit.push({ step: step++, label_ar: "مساهمة أسلوب المقارنة", label_en: "Market approach contribution", formula: "contribution = market_value * weight", inputs: { value: input.market_value, weight: `${(input.weight_market * 100).toFixed(0)}%` as any }, result: Math.round(c), unit: "SAR" });
  }

  if (input.cost_value && input.cost_value > 0) {
    const c = input.cost_value * input.weight_cost;
    weighted.cost = { value: input.cost_value, weight: input.weight_cost, contribution: Math.round(c) };
    total += c;
    audit.push({ step: step++, label_ar: "مساهمة أسلوب التكلفة", label_en: "Cost approach contribution", formula: "contribution = cost_value * weight", inputs: { value: input.cost_value, weight: `${(input.weight_cost * 100).toFixed(0)}%` as any }, result: Math.round(c), unit: "SAR" });
  }

  if (input.income_value && input.income_value > 0) {
    const c = input.income_value * input.weight_income;
    weighted.income = { value: input.income_value, weight: input.weight_income, contribution: Math.round(c) };
    total += c;
    audit.push({ step: step++, label_ar: "مساهمة أسلوب الدخل", label_en: "Income approach contribution", formula: "contribution = income_value * weight", inputs: { value: input.income_value, weight: `${(input.weight_income * 100).toFixed(0)}%` as any }, result: Math.round(c), unit: "SAR" });
  }

  const final_value = Math.round(total);
  audit.push({ step: step++, label_ar: "القيمة النهائية المرجّحة", label_en: "Final reconciled value", formula: "final = Σ(value_i * weight_i)", inputs: { components: Object.keys(weighted).length as any }, result: final_value, unit: "SAR" });

  // Range: ±5%
  const range_low = Math.round(final_value * 0.95);
  const range_high = Math.round(final_value * 1.05);

  return {
    final_value,
    weighted_values: weighted,
    value_range_low: range_low,
    value_range_high: range_high,
    variance_pct: Math.round(variance_pct * 100) / 100,
    audit_trail: audit,
    validation_errors: errors,
  };
}

// ============================================================
// FULL VALIDATION
// ============================================================
export interface FullValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  blocks_report: boolean;
}

export function validateForReport(
  marketResult?: MarketApproachResult,
  costResult?: CostApproachResult,
  incomeResult?: IncomeApproachResult,
  reconResult?: ReconciliationResult
): FullValidationResult {
  const allErrors: ValidationError[] = [];

  if (marketResult) allErrors.push(...marketResult.validation_errors);
  if (costResult) allErrors.push(...costResult.validation_errors);
  if (incomeResult) allErrors.push(...incomeResult.validation_errors);
  if (reconResult) allErrors.push(...reconResult.validation_errors);

  if (!marketResult || marketResult.concluded_value <= 0) {
    allErrors.push({ code: "NO_MARKET", message_ar: "أسلوب المقارنة إلزامي ولم يتم حسابه", message_en: "Market approach is mandatory but not calculated", severity: "error" });
  }

  const errors = allErrors.filter(e => e.severity === "error");
  const warnings = allErrors.filter(e => e.severity === "warning");

  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
    blocks_report: errors.length > 0,
  };
}
