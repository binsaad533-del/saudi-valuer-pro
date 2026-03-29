/**
 * Valuation Validation Engine
 * Runs comprehensive checks before report approval/issuance.
 * 9 Parts: Input, Comparables, Adjustments, Results, Methods, Compliance, Inspection, Output, Approval Control
 */

import { validateInspection, calculateInspectionQuality, detectDiscrepancies, type InspectionQualityScore } from "./inspection-validation";

export type ValidationStatus = "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
export type FlagSeverity = "error" | "warning" | "info";

export interface ValidationFlag {
  code: string;
  part: string;
  severity: FlagSeverity;
  message_ar: string;
  message_en: string;
  field?: string;
}

export interface ValidationResult {
  status: ValidationStatus;
  flags: ValidationFlag[];
  summary: {
    total_checks: number;
    passed: number;
    warnings: number;
    errors: number;
  };
  parts: {
    input: PartResult;
    comparables: PartResult;
    adjustments: PartResult;
    results: PartResult;
    methods: PartResult;
    compliance: PartResult;
  };
  can_issue: boolean;
  override_allowed: boolean;
  validated_at: string;
}

export interface PartResult {
  passed: boolean;
  flags: ValidationFlag[];
}

// ============================================================
// PART 1: Input Validation
// ============================================================
export function validateInputs(assignment: any, subject: any): PartResult {
  const flags: ValidationFlag[] = [];

  if (!assignment) {
    flags.push({ code: "NO_ASSIGNMENT", part: "input", severity: "error", message_ar: "لا يوجد مهمة تقييم", message_en: "No valuation assignment found" });
    return { passed: false, flags };
  }

  // Location validation
  if (!subject?.city_ar && !assignment.property_city_ar) {
    flags.push({ code: "MISSING_CITY", part: "input", severity: "error", message_ar: "المدينة مطلوبة", message_en: "City is required", field: "city" });
  }
  if (!subject?.district_ar && !assignment.property_district_ar) {
    flags.push({ code: "MISSING_DISTRICT", part: "input", severity: "warning", message_ar: "الحي غير محدد", message_en: "District not specified", field: "district" });
  }

  // Area validation
  const landArea = subject?.land_area || assignment.land_area;
  const buildingArea = subject?.building_area || assignment.building_area;
  if (!landArea && !buildingArea) {
    flags.push({ code: "MISSING_AREA", part: "input", severity: "error", message_ar: "المساحة مطلوبة (أرض أو مبنى)", message_en: "Area required (land or building)", field: "area" });
  }
  if (landArea && landArea <= 0) {
    flags.push({ code: "INVALID_LAND_AREA", part: "input", severity: "error", message_ar: "مساحة الأرض غير صالحة", message_en: "Invalid land area", field: "land_area" });
  }
  if (buildingArea && buildingArea < 0) {
    flags.push({ code: "INVALID_BUILDING_AREA", part: "input", severity: "error", message_ar: "مساحة المبنى غير صالحة", message_en: "Invalid building area", field: "building_area" });
  }
  if (buildingArea && landArea && buildingArea > landArea * 10) {
    flags.push({ code: "AREA_INCONSISTENCY", part: "input", severity: "warning", message_ar: "مساحة المبنى تتجاوز 10 أضعاف مساحة الأرض", message_en: "Building area exceeds 10x land area", field: "area" });
  }

  // Asset type
  if (!assignment.property_type) {
    flags.push({ code: "MISSING_PROPERTY_TYPE", part: "input", severity: "error", message_ar: "نوع العقار مطلوب", message_en: "Property type is required", field: "property_type" });
  }

  // Purpose
  if (!assignment.purpose) {
    flags.push({ code: "MISSING_PURPOSE", part: "input", severity: "error", message_ar: "الغرض من التقييم مطلوب", message_en: "Valuation purpose is required", field: "purpose" });
  }

  // Basis of value
  if (!assignment.basis_of_value) {
    flags.push({ code: "MISSING_BASIS", part: "input", severity: "error", message_ar: "أساس القيمة مطلوب", message_en: "Basis of value is required", field: "basis_of_value" });
  }

  const hasErrors = flags.some(f => f.severity === "error");
  return { passed: !hasErrors, flags };
}

// ============================================================
// PART 2: Comparable Validation
// ============================================================
export function validateComparables(comparables: any[], assignment: any): PartResult {
  const flags: ValidationFlag[] = [];
  const valuationType = assignment?.valuation_type || "real_estate";

  // Machinery may not need comparables for cost approach
  if (valuationType === "machinery") {
    if (comparables.length === 0) {
      flags.push({ code: "NO_MACHINERY_COMPARABLES", part: "comparables", severity: "info", message_ar: "لا توجد مقارنات للآلات (قد يعتمد على أسلوب التكلفة)", message_en: "No machinery comparables (may rely on cost approach)" });
    }
    return { passed: true, flags };
  }

  // Minimum 3 comparables
  if (comparables.length < 3) {
    flags.push({ code: "INSUFFICIENT_COMPARABLES", part: "comparables", severity: "error", message_ar: `عدد المقارنات ${comparables.length} أقل من الحد الأدنى (3)`, message_en: `${comparables.length} comparables is below minimum (3)` });
  }

  // Same city check
  const assignmentCity = assignment?.property_city_ar || "";
  if (assignmentCity && comparables.length > 0) {
    const differentCity = comparables.filter(c => c.city_ar && c.city_ar !== assignmentCity);
    if (differentCity.length > 0) {
      flags.push({ code: "DIFFERENT_CITY_COMPARABLES", part: "comparables", severity: "warning", message_ar: `${differentCity.length} مقارنات من مدن مختلفة`, message_en: `${differentCity.length} comparables from different cities` });
    }
  }

  // Recent transaction dates (within 12 months)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oldComparables = comparables.filter(c => {
    if (!c.transaction_date) return false;
    return new Date(c.transaction_date) < oneYearAgo;
  });
  if (oldComparables.length > 0) {
    flags.push({ code: "OLD_COMPARABLES", part: "comparables", severity: "warning", message_ar: `${oldComparables.length} مقارنات أقدم من 12 شهراً`, message_en: `${oldComparables.length} comparables older than 12 months` });
  }

  // Missing transaction dates
  const noDate = comparables.filter(c => !c.transaction_date);
  if (noDate.length > 0) {
    flags.push({ code: "MISSING_TRANSACTION_DATE", part: "comparables", severity: "warning", message_ar: `${noDate.length} مقارنات بدون تاريخ معاملة`, message_en: `${noDate.length} comparables without transaction date` });
  }

  // Similarity check - property type
  const differentType = comparables.filter(c => c.property_type && c.property_type !== assignment?.property_type);
  if (differentType.length > comparables.length / 2) {
    flags.push({ code: "WEAK_SIMILARITY", part: "comparables", severity: "warning", message_ar: "أغلب المقارنات من نوع عقار مختلف", message_en: "Most comparables are of different property type" });
  }

  // Missing prices
  const noPrice = comparables.filter(c => !c.price || c.price <= 0);
  if (noPrice.length > 0) {
    flags.push({ code: "MISSING_PRICE", part: "comparables", severity: "error", message_ar: `${noPrice.length} مقارنات بدون سعر`, message_en: `${noPrice.length} comparables without price` });
  }

  const hasErrors = flags.some(f => f.severity === "error");
  return { passed: !hasErrors, flags };
}

// ============================================================
// PART 3: Adjustment Validation
// ============================================================
const ADJUSTMENT_LIMITS: Record<string, { min: number; max: number; label_ar: string; label_en: string }> = {
  location: { min: -0.20, max: 0.20, label_ar: "الموقع", label_en: "Location" },
  size: { min: -0.15, max: 0.15, label_ar: "المساحة", label_en: "Size" },
  age: { min: -0.30, max: 0.00, label_ar: "العمر", label_en: "Age" },
  condition: { min: -0.20, max: 0.10, label_ar: "الحالة", label_en: "Condition" },
  time: { min: -0.10, max: 0.15, label_ar: "الوقت", label_en: "Time" },
};

export function validateAdjustments(adjustments: any[]): PartResult {
  const flags: ValidationFlag[] = [];

  if (adjustments.length === 0) {
    flags.push({ code: "NO_ADJUSTMENTS", part: "adjustments", severity: "info", message_ar: "لا توجد تعديلات مسجلة", message_en: "No adjustments recorded" });
    return { passed: true, flags };
  }

  for (const adj of adjustments) {
    const pct = adj.adjustment_percentage != null ? adj.adjustment_percentage / 100 : null;
    const adjType = adj.adjustment_type?.toLowerCase();
    const limit = ADJUSTMENT_LIMITS[adjType];

    if (limit && pct != null) {
      if (pct < limit.min || pct > limit.max) {
        flags.push({
          code: "EXCESSIVE_ADJUSTMENT",
          part: "adjustments",
          severity: "error",
          message_ar: `تعديل ${limit.label_ar} (${(pct * 100).toFixed(1)}%) يتجاوز النطاق المسموح (${(limit.min * 100).toFixed(0)}% إلى ${(limit.max * 100).toFixed(0)}%)`,
          message_en: `${limit.label_en} adjustment (${(pct * 100).toFixed(1)}%) exceeds allowed range (${(limit.min * 100).toFixed(0)}% to ${(limit.max * 100).toFixed(0)}%)`,
          field: adjType,
        });
      }
    }

    // Check for missing justification
    if (!adj.justification_ar && !adj.justification_en) {
      flags.push({
        code: "MISSING_JUSTIFICATION",
        part: "adjustments",
        severity: "warning",
        message_ar: `تعديل ${adj.label_ar || adjType || "غير محدد"} بدون مبرر`,
        message_en: `Adjustment ${adj.label_en || adjType || "unknown"} without justification`,
      });
    }
  }

  // Check total adjustment per comparable
  const byComparable: Record<string, number> = {};
  for (const adj of adjustments) {
    const key = adj.assignment_comparable_id || "unknown";
    const pct = adj.adjustment_percentage || 0;
    byComparable[key] = (byComparable[key] || 0) + Math.abs(pct);
  }
  for (const [, totalPct] of Object.entries(byComparable)) {
    if (totalPct > 50) {
      flags.push({
        code: "TOTAL_ADJUSTMENT_TOO_HIGH",
        part: "adjustments",
        severity: "warning",
        message_ar: `إجمالي التعديلات لمقارن يتجاوز 50% (${totalPct.toFixed(1)}%)`,
        message_en: `Total adjustments for a comparable exceed 50% (${totalPct.toFixed(1)}%)`,
      });
    }
  }

  const hasErrors = flags.some(f => f.severity === "error");
  return { passed: !hasErrors, flags };
}

// ============================================================
// PART 4: Result Validation
// ============================================================
export function validateResults(
  reconciliation: any,
  comparables: any[],
  assignment: any
): PartResult {
  const flags: ValidationFlag[] = [];

  if (!reconciliation || !reconciliation.final_value) {
    flags.push({ code: "NO_FINAL_VALUE", part: "results", severity: "error", message_ar: "لا توجد قيمة نهائية", message_en: "No final value determined" });
    return { passed: false, flags };
  }

  const finalValue = reconciliation.final_value;

  // Negative or zero value
  if (finalValue <= 0) {
    flags.push({ code: "INVALID_FINAL_VALUE", part: "results", severity: "error", message_ar: "القيمة النهائية صفر أو سالبة", message_en: "Final value is zero or negative" });
  }

  // Compare against market range from comparables
  if (comparables.length >= 3) {
    const prices = comparables.filter(c => c.price_per_sqm > 0).map(c => c.price_per_sqm);
    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const area = assignment?.land_area || assignment?.building_area || 1;
      const expectedValue = avgPrice * area;
      const deviation = Math.abs(finalValue - expectedValue) / expectedValue;

      if (deviation > 0.5) {
        flags.push({
          code: "VALUE_OUTLIER",
          part: "results",
          severity: "warning",
          message_ar: `القيمة النهائية تنحرف ${(deviation * 100).toFixed(0)}% عن متوسط السوق`,
          message_en: `Final value deviates ${(deviation * 100).toFixed(0)}% from market average`,
        });
      }
    }
  }

  // Value range check
  if (reconciliation.value_range_low && reconciliation.value_range_high) {
    if (finalValue < reconciliation.value_range_low || finalValue > reconciliation.value_range_high) {
      flags.push({
        code: "VALUE_OUTSIDE_RANGE",
        part: "results",
        severity: "error",
        message_ar: "القيمة النهائية خارج نطاق القيمة المحدد",
        message_en: "Final value is outside the determined value range",
      });
    }
  }

  // Method variance check (already in calculation-engine but re-verify)
  const methodValues = [reconciliation.market_value, reconciliation.cost_value, reconciliation.income_value].filter((v: number) => v > 0);
  if (methodValues.length >= 2) {
    const maxV = Math.max(...methodValues);
    const minV = Math.min(...methodValues);
    const variance = ((maxV - minV) / minV) * 100;
    if (variance > 30) {
      flags.push({
        code: "HIGH_METHOD_VARIANCE",
        part: "results",
        severity: "warning",
        message_ar: `تباين كبير بين طرق التقييم: ${variance.toFixed(1)}%`,
        message_en: `High variance between valuation methods: ${variance.toFixed(1)}%`,
      });
    }
  }

  const hasErrors = flags.some(f => f.severity === "error");
  return { passed: !hasErrors, flags };
}

// ============================================================
// PART 5: Method Validation
// ============================================================
const REQUIRED_METHODS: Record<string, { required: string[]; label_ar: string }> = {
  residential_land: { required: ["market"], label_ar: "أرض سكنية" },
  residential_apartment: { required: ["market"], label_ar: "شقة سكنية" },
  residential_villa: { required: ["market", "cost"], label_ar: "فيلا سكنية" },
  commercial: { required: ["income", "market"], label_ar: "تجاري" },
  industrial: { required: ["cost"], label_ar: "صناعي" },
  agricultural: { required: ["market"], label_ar: "زراعي" },
  mixed_use: { required: ["income", "market"], label_ar: "متعدد الاستخدام" },
};

export function validateMethods(
  methods: any[],
  assignment: any
): PartResult {
  const flags: ValidationFlag[] = [];
  const valuationType = assignment?.valuation_type || "real_estate";
  const propertyType = assignment?.property_type || "";

  // Check methods exist
  const usedMethods = methods.filter(m => m.is_used);
  if (usedMethods.length === 0) {
    flags.push({ code: "NO_METHODS", part: "methods", severity: "error", message_ar: "لا يوجد أي أسلوب تقييم مستخدم", message_en: "No valuation methods used" });
    return { passed: false, flags };
  }

  // Machinery validation
  if (valuationType === "machinery") {
    const hasCost = usedMethods.some(m => m.method_type === "cost");
    if (!hasCost) {
      flags.push({ code: "MACHINERY_NEEDS_COST", part: "methods", severity: "warning", message_ar: "الآلات والمعدات تتطلب عادة أسلوب التكلفة", message_en: "Machinery typically requires cost approach" });
    }
    return { passed: true, flags };
  }

  // Property type method requirements
  const req = REQUIRED_METHODS[propertyType];
  if (req) {
    for (const method of req.required) {
      const hasMethod = usedMethods.some(m => m.method_type === method);
      if (!hasMethod) {
        flags.push({
          code: "MISSING_REQUIRED_METHOD",
          part: "methods",
          severity: "warning",
          message_ar: `نوع العقار "${req.label_ar}" يتطلب عادة أسلوب ${method === "market" ? "المقارنة" : method === "income" ? "الدخل" : "التكلفة"}`,
          message_en: `Property type "${propertyType}" typically requires ${method} approach`,
        });
      }
    }
  }

  // Income property without income approach
  if (["commercial", "mixed_use"].includes(propertyType)) {
    const hasIncome = usedMethods.some(m => m.method_type === "income");
    if (!hasIncome) {
      flags.push({ code: "INCOME_PROPERTY_NO_INCOME", part: "methods", severity: "error", message_ar: "العقار الإيرادي يتطلب أسلوب الدخل", message_en: "Income-producing property requires income approach" });
    }
  }

  const hasErrors = flags.some(f => f.severity === "error");
  return { passed: !hasErrors, flags };
}

// ============================================================
// PART 6: Compliance Check (IVS + Taqeem)
// ============================================================
export function validateCompliance(
  assignment: any,
  report: any,
  inspection: any
): PartResult {
  const flags: ValidationFlag[] = [];

  // IVS 2025 requirements
  if (!assignment.engagement_date) {
    flags.push({ code: "IVS_NO_ENGAGEMENT_DATE", part: "compliance", severity: "error", message_ar: "تاريخ التكليف مطلوب (IVS)", message_en: "Engagement date required (IVS)" });
  }
  if (!assignment.valuation_date && !assignment.report_date) {
    flags.push({ code: "IVS_NO_VALUATION_DATE", part: "compliance", severity: "error", message_ar: "تاريخ التقييم مطلوب (IVS)", message_en: "Valuation date required (IVS)" });
  }
  if (!assignment.intended_use_ar) {
    flags.push({ code: "IVS_NO_INTENDED_USE", part: "compliance", severity: "error", message_ar: "الاستخدام المقصود مطلوب (IVS)", message_en: "Intended use required (IVS)" });
  }
  if (!assignment.intended_users_ar) {
    flags.push({ code: "IVS_NO_INTENDED_USERS", part: "compliance", severity: "error", message_ar: "المستخدمون المستهدفون مطلوبون (IVS)", message_en: "Intended users required (IVS)" });
  }
  if (!assignment.basis_of_value) {
    flags.push({ code: "IVS_NO_BASIS", part: "compliance", severity: "error", message_ar: "أساس القيمة مطلوب (IVS)", message_en: "Basis of value required (IVS)" });
  }

  // Inspection required
  if (!inspection) {
    flags.push({ code: "TAQEEM_NO_INSPECTION", part: "compliance", severity: "error", message_ar: "المعاينة الميدانية مطلوبة (تقييم)", message_en: "Field inspection required (Taqeem)" });
  } else if (inspection.status !== "completed" && !inspection.completed) {
    flags.push({ code: "TAQEEM_INSPECTION_INCOMPLETE", part: "compliance", severity: "error", message_ar: "المعاينة غير مكتملة (تقييم)", message_en: "Inspection not completed (Taqeem)" });
  }

  // Report content check
  if (report) {
    if (!report.content_ar) {
      flags.push({ code: "NO_AR_CONTENT", part: "compliance", severity: "error", message_ar: "محتوى التقرير بالعربية مطلوب", message_en: "Arabic report content required" });
    }
  } else {
    flags.push({ code: "NO_REPORT", part: "compliance", severity: "error", message_ar: "لا يوجد تقرير", message_en: "No report found" });
  }

  // Valuer assignment
  if (!assignment.assigned_valuer_id) {
    flags.push({ code: "TAQEEM_NO_VALUER", part: "compliance", severity: "error", message_ar: "لم يتم تعيين مقيّم (تقييم)", message_en: "No valuer assigned (Taqeem)" });
  }

  const hasErrors = flags.some(f => f.severity === "error");
  return { passed: !hasErrors, flags };
}

// ============================================================
// PART 7 & 8: Full Validation Runner
// ============================================================
export function runFullValidation(data: {
  assignment: any;
  subject: any;
  comparables: any[];
  adjustments: any[];
  methods: any[];
  reconciliation: any;
  report: any;
  inspection: any;
}): ValidationResult {
  const input = validateInputs(data.assignment, data.subject);
  const comparables = validateComparables(data.comparables, data.assignment);
  const adjustments = validateAdjustments(data.adjustments);
  const results = validateResults(data.reconciliation, data.comparables, data.assignment);
  const methods = validateMethods(data.methods, data.assignment);
  const compliance = validateCompliance(data.assignment, data.report, data.inspection);

  const allFlags = [
    ...input.flags,
    ...comparables.flags,
    ...adjustments.flags,
    ...results.flags,
    ...methods.flags,
    ...compliance.flags,
  ];

  const errors = allFlags.filter(f => f.severity === "error").length;
  const warnings = allFlags.filter(f => f.severity === "warning").length;
  const totalChecks = allFlags.length;
  const passed = totalChecks - errors - warnings;

  let status: ValidationStatus;
  if (errors > 0) {
    status = "REJECTED";
  } else if (warnings > 0) {
    status = "NEEDS_REVIEW";
  } else {
    status = "APPROVED";
  }

  return {
    status,
    flags: allFlags,
    summary: {
      total_checks: totalChecks,
      passed,
      warnings,
      errors,
    },
    parts: { input, comparables, adjustments, results, methods, compliance },
    can_issue: status === "APPROVED",
    override_allowed: status === "NEEDS_REVIEW",
    validated_at: new Date().toISOString(),
  };
}
