/**
 * Inspection Validation & Quality Scoring Module
 * 
 * Enforces that inspection data is complete, accurate, and meets
 * professional valuation standards before allowing valuation to proceed.
 * 
 * Inspection quality directly impacts:
 * - Valuation confidence level
 * - Risk score
 * - Report quality rating
 */

import type { ValidationFlag, PartResult } from "./validation-engine";

// ── Inspection Completeness Requirements ──
export interface InspectionData {
  id?: string;
  assignment_id?: string;
  inspector_id?: string;
  inspection_date?: string;
  status?: string;
  completed?: boolean;
  submitted_at?: string;
  started_at?: string;
  latitude?: number | null;
  longitude?: number | null;
  gps_verified?: boolean | null;
  findings_ar?: string | null;
  findings_en?: string | null;
  notes_ar?: string | null;
  notes_en?: string | null;
  access_granted?: boolean | null;
  weather_conditions?: string | null;
  duration_minutes?: number | null;
}

export interface InspectionAnalysisData {
  condition_rating?: string | null;
  condition_score?: number | null;
  finishing_level?: string | null;
  maintenance_level?: string | null;
  environment_quality?: string | null;
  visible_defects?: any[] | null;
  risk_flags?: any[] | null;
  quality_score?: number | null;
  physical_depreciation_pct?: number | null;
  functional_obsolescence_pct?: number | null;
  external_obsolescence_pct?: number | null;
}

export interface InspectionQualityScore {
  overall: number; // 0–100
  completeness: number; // 0–100
  documentation: number; // 0–100
  verification: number; // 0–100
  analysis: number; // 0–100
  risk_level: "low" | "medium" | "high" | "critical";
  confidence_impact: "positive" | "neutral" | "negative";
  flags: string[];
}

// ============================================================
// PART A: Inspection Validation (for validation engine)
// ============================================================
export function validateInspection(
  inspection: InspectionData | null,
  analysis: InspectionAnalysisData | null,
  photos: any[],
  checklist: any[],
  adminOverride: boolean = false
): PartResult {
  const flags: ValidationFlag[] = [];

  // ── 1. Inspection existence ──
  if (!inspection) {
    if (adminOverride) {
      flags.push({
        code: "INSP_ADMIN_OVERRIDE_NO_INSPECTION",
        part: "inspection",
        severity: "warning",
        message_ar: "تم تجاوز المعاينة بموافقة المسؤول",
        message_en: "Inspection bypassed with admin override",
      });
    } else {
      flags.push({
        code: "INSP_MISSING",
        part: "inspection",
        severity: "error",
        message_ar: "المعاينة الميدانية مطلوبة - لا يمكن بدء التقييم بدون معاينة",
        message_en: "Field inspection required - valuation cannot proceed without inspection",
      });
    }
    return { passed: adminOverride, flags };
  }

  // ── 2. Inspection completion status ──
  if (inspection.status !== "completed" && !inspection.completed && !inspection.submitted_at) {
    flags.push({
      code: "INSP_NOT_COMPLETED",
      part: "inspection",
      severity: "error",
      message_ar: "المعاينة غير مكتملة - يجب إكمال وتسليم المعاينة",
      message_en: "Inspection not completed - must be completed and submitted",
    });
  }

  // ── 3. Inspector assignment ──
  if (!inspection.inspector_id) {
    flags.push({
      code: "INSP_NO_INSPECTOR",
      part: "inspection",
      severity: "error",
      message_ar: "لم يتم تعيين معاين للمهمة",
      message_en: "No inspector assigned to assignment",
    });
  }

  // ── 4. Location verification (GPS) ──
  if (!inspection.gps_verified) {
    flags.push({
      code: "INSP_GPS_NOT_VERIFIED",
      part: "inspection",
      severity: "warning",
      message_ar: "لم يتم التحقق من الموقع عبر GPS",
      message_en: "GPS location not verified",
    });
  }
  if (!inspection.latitude || !inspection.longitude) {
    flags.push({
      code: "INSP_NO_COORDINATES",
      part: "inspection",
      severity: "warning",
      message_ar: "إحداثيات الموقع غير مسجلة",
      message_en: "Location coordinates not recorded",
    });
  }

  // ── 5. Photo documentation ──
  if (!photos || photos.length === 0) {
    flags.push({
      code: "INSP_NO_PHOTOS",
      part: "inspection",
      severity: "error",
      message_ar: "لا توجد صور للمعاينة - التوثيق المصور إلزامي",
      message_en: "No inspection photos - photo documentation is mandatory",
    });
  } else {
    // Check minimum photo categories
    const categories = new Set(photos.map((p: any) => p.category));
    if (!categories.has("external") && !categories.has("exterior")) {
      flags.push({
        code: "INSP_NO_EXTERNAL_PHOTOS",
        part: "inspection",
        severity: "warning",
        message_ar: "لا توجد صور خارجية للعقار",
        message_en: "No external property photos",
      });
    }
    if (!categories.has("internal") && !categories.has("interior")) {
      flags.push({
        code: "INSP_NO_INTERNAL_PHOTOS",
        part: "inspection",
        severity: "warning",
        message_ar: "لا توجد صور داخلية للعقار",
        message_en: "No internal property photos",
      });
    }
    if (photos.length < 5) {
      flags.push({
        code: "INSP_INSUFFICIENT_PHOTOS",
        part: "inspection",
        severity: "warning",
        message_ar: `عدد الصور (${photos.length}) أقل من الحد الأدنى المطلوب (5)`,
        message_en: `Photo count (${photos.length}) below minimum required (5)`,
      });
    }
  }

  // ── 6. Condition assessment ──
  if (!analysis?.condition_rating && !analysis?.condition_score) {
    flags.push({
      code: "INSP_NO_CONDITION",
      part: "inspection",
      severity: "error",
      message_ar: "لم يتم تحديد حالة العقار - تقييم الحالة إلزامي",
      message_en: "Property condition not defined - condition assessment is mandatory",
    });
  }

  // ── 7. Findings/notes ──
  if (!inspection.findings_ar && !inspection.notes_ar) {
    flags.push({
      code: "INSP_NO_FINDINGS",
      part: "inspection",
      severity: "warning",
      message_ar: "لا توجد ملاحظات أو نتائج مسجلة من المعاينة",
      message_en: "No findings or notes recorded from inspection",
    });
  }

  // ── 8. Access verification ──
  if (inspection.access_granted === false) {
    flags.push({
      code: "INSP_ACCESS_DENIED",
      part: "inspection",
      severity: "error",
      message_ar: "لم يُمنح المعاين حق الوصول للعقار - المعاينة غير صالحة",
      message_en: "Inspector was denied access to the property - inspection invalid",
    });
  }

  // ── 9. Checklist completion ──
  if (!checklist || checklist.length === 0) {
    flags.push({
      code: "INSP_NO_CHECKLIST",
      part: "inspection",
      severity: "warning",
      message_ar: "لم يتم ملء قائمة الفحص",
      message_en: "Inspection checklist not completed",
    });
  } else {
    const required = checklist.filter((c: any) => c.is_required);
    const unchecked = required.filter((c: any) => !c.is_checked);
    if (unchecked.length > 0) {
      flags.push({
        code: "INSP_CHECKLIST_INCOMPLETE",
        part: "inspection",
        severity: "warning",
        message_ar: `${unchecked.length} عنصر إلزامي في قائمة الفحص لم يُستكمل`,
        message_en: `${unchecked.length} required checklist items not completed`,
      });
    }
  }

  // ── 10. Inspection duration ──
  if (inspection.duration_minutes && inspection.duration_minutes < 15) {
    flags.push({
      code: "INSP_TOO_SHORT",
      part: "inspection",
      severity: "warning",
      message_ar: "مدة المعاينة أقل من 15 دقيقة - قد تكون غير كافية",
      message_en: "Inspection duration less than 15 minutes - may be insufficient",
    });
  }

  // ── 11. Analysis quality ──
  if (analysis) {
    if (!analysis.finishing_level) {
      flags.push({
        code: "INSP_NO_FINISHING_LEVEL",
        part: "inspection",
        severity: "warning",
        message_ar: "مستوى التشطيب غير محدد",
        message_en: "Finishing level not specified",
      });
    }
    if (!analysis.maintenance_level) {
      flags.push({
        code: "INSP_NO_MAINTENANCE_LEVEL",
        part: "inspection",
        severity: "warning",
        message_ar: "مستوى الصيانة غير محدد",
        message_en: "Maintenance level not specified",
      });
    }
    if (!analysis.environment_quality) {
      flags.push({
        code: "INSP_NO_ENVIRONMENT",
        part: "inspection",
        severity: "info",
        message_ar: "جودة البيئة المحيطة غير محددة",
        message_en: "Environment quality not specified",
      });
    }
  }

  // ── 12. Data discrepancy checks ──
  // (Checked by the caller with subject data comparison)

  const hasErrors = flags.some(f => f.severity === "error");
  return { passed: !hasErrors, flags };
}

// ============================================================
// PART B: Inspection Quality Score
// ============================================================
export function calculateInspectionQuality(
  inspection: InspectionData | null,
  analysis: InspectionAnalysisData | null,
  photos: any[],
  checklist: any[]
): InspectionQualityScore {
  if (!inspection) {
    return {
      overall: 0,
      completeness: 0,
      documentation: 0,
      verification: 0,
      analysis: 0,
      risk_level: "critical",
      confidence_impact: "negative",
      flags: ["لا توجد معاينة"],
    };
  }

  const qualityFlags: string[] = [];
  let completenessScore = 0;
  let documentationScore = 0;
  let verificationScore = 0;
  let analysisScore = 0;

  // ── Completeness (25%) ──
  if (inspection.completed || inspection.submitted_at) completenessScore += 30;
  if (inspection.findings_ar || inspection.notes_ar) completenessScore += 20;
  if (inspection.inspector_id) completenessScore += 15;
  if (inspection.inspection_date) completenessScore += 10;
  if (inspection.duration_minutes && inspection.duration_minutes >= 30) completenessScore += 15;
  else if (inspection.duration_minutes && inspection.duration_minutes >= 15) completenessScore += 10;
  if (inspection.weather_conditions) completenessScore += 5;
  if (inspection.access_granted !== false) completenessScore += 5;
  else qualityFlags.push("لم يُمنح حق الوصول");
  completenessScore = Math.min(100, completenessScore);

  // ── Documentation (25%) ──
  if (photos.length >= 10) documentationScore += 40;
  else if (photos.length >= 5) documentationScore += 30;
  else if (photos.length > 0) documentationScore += 15;
  else qualityFlags.push("لا يوجد توثيق مصور");

  const photoCategories = new Set(photos.map((p: any) => p.category));
  if (photoCategories.size >= 3) documentationScore += 20;
  else if (photoCategories.size >= 2) documentationScore += 10;

  if (checklist.length > 0) {
    const checkedItems = checklist.filter((c: any) => c.is_checked).length;
    const completionRate = checkedItems / checklist.length;
    documentationScore += Math.round(completionRate * 30);
  }
  if (photos.some((p: any) => p.latitude && p.longitude)) documentationScore += 10;
  documentationScore = Math.min(100, documentationScore);

  // ── Verification (25%) ──
  if (inspection.gps_verified) verificationScore += 35;
  else qualityFlags.push("الموقع غير موثق بالـ GPS");
  if (inspection.latitude && inspection.longitude) verificationScore += 25;
  if (inspection.started_at && inspection.submitted_at) verificationScore += 20;
  if (inspection.access_granted === true) verificationScore += 20;
  verificationScore = Math.min(100, verificationScore);

  // ── Analysis (25%) ──
  if (analysis) {
    if (analysis.condition_rating || analysis.condition_score) analysisScore += 25;
    else qualityFlags.push("حالة العقار غير محددة");
    if (analysis.finishing_level) analysisScore += 15;
    if (analysis.maintenance_level) analysisScore += 15;
    if (analysis.environment_quality) analysisScore += 10;
    if (analysis.physical_depreciation_pct != null) analysisScore += 10;
    if (analysis.functional_obsolescence_pct != null) analysisScore += 10;
    if (analysis.external_obsolescence_pct != null) analysisScore += 10;
    if (analysis.visible_defects && (analysis.visible_defects as any[]).length > 0) analysisScore += 5;
  } else {
    qualityFlags.push("لا يوجد تحليل للمعاينة");
  }
  analysisScore = Math.min(100, analysisScore);

  // ── Overall ──
  const overall = Math.round(
    completenessScore * 0.25 +
    documentationScore * 0.25 +
    verificationScore * 0.25 +
    analysisScore * 0.25
  );

  // ── Risk & Confidence ──
  let risk_level: InspectionQualityScore["risk_level"];
  if (overall >= 75) risk_level = "low";
  else if (overall >= 50) risk_level = "medium";
  else if (overall >= 25) risk_level = "high";
  else risk_level = "critical";

  let confidence_impact: InspectionQualityScore["confidence_impact"];
  if (overall >= 70) confidence_impact = "positive";
  else if (overall >= 40) confidence_impact = "neutral";
  else confidence_impact = "negative";

  return {
    overall,
    completeness: completenessScore,
    documentation: documentationScore,
    verification: verificationScore,
    analysis: analysisScore,
    risk_level,
    confidence_impact,
    flags: qualityFlags,
  };
}

// ============================================================
// PART C: Data Discrepancy Detection
// ============================================================
export function detectDiscrepancies(
  inspection: InspectionData | null,
  analysis: InspectionAnalysisData | null,
  subject: any,
  assignment: any
): ValidationFlag[] {
  const flags: ValidationFlag[] = [];

  if (!inspection || !subject) return flags;

  // Area discrepancy between documents and inspection
  if (subject.land_area && inspection.findings_ar) {
    // This would be enhanced with structured inspection area data
    // For now, flag if there's a note about area discrepancy
  }

  // GPS location vs subject address
  if (inspection.latitude && inspection.longitude && subject.latitude && subject.longitude) {
    const distance = haversineDistance(
      inspection.latitude,
      inspection.longitude,
      subject.latitude,
      subject.longitude
    );
    if (distance > 0.5) { // More than 500m
      flags.push({
        code: "INSP_LOCATION_DISCREPANCY",
        part: "inspection",
        severity: "warning",
        message_ar: `موقع المعاينة يبعد ${distance.toFixed(1)} كم عن الموقع المسجل`,
        message_en: `Inspection location is ${distance.toFixed(1)} km from recorded location`,
      });
    }
  }

  // Condition vs age consistency
  if (analysis?.condition_rating === "excellent" && subject.year_built) {
    const age = new Date().getFullYear() - subject.year_built;
    if (age > 20) {
      flags.push({
        code: "INSP_CONDITION_AGE_MISMATCH",
        part: "inspection",
        severity: "warning",
        message_ar: `حالة ممتازة لعقار عمره ${age} سنة - تحقق من التقييم`,
        message_en: `Excellent condition for ${age}-year-old property - verify assessment`,
      });
    }
  }

  return flags;
}

// Simple haversine for distance calc
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}
