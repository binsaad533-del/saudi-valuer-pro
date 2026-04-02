/**
 * Quality Control Engine — نظام ضبط الجودة متعدد المستويات
 */

export type QCLevel = "automated" | "peer_review" | "senior_review" | "final_approval";
export type QCStatus = "pending" | "passed" | "failed" | "needs_revision";

export interface QCCheck {
  id: string;
  category: string;
  labelAr: string;
  labelEn: string;
  level: QCLevel;
  isMandatory: boolean;
  checkFn?: (data: any) => QCCheckResult;
}

export interface QCCheckResult {
  passed: boolean;
  score: number; // 0-100
  messageAr: string;
  messageEn: string;
  details?: string;
}

export interface QCReport {
  overallScore: number;
  overallStatus: QCStatus;
  levelResults: Record<QCLevel, { score: number; status: QCStatus; checks: QCCheckResultItem[] }>;
  blockers: QCCheckResultItem[];
  warnings: QCCheckResultItem[];
  timestamp: string;
}

export interface QCCheckResultItem {
  checkId: string;
  labelAr: string;
  labelEn: string;
  level: QCLevel;
  result: QCCheckResult;
  isMandatory: boolean;
}

// ─── Automated Checks ───

const AUTOMATED_CHECKS: QCCheck[] = [
  {
    id: "completeness",
    category: "data",
    labelAr: "اكتمال البيانات الأساسية",
    labelEn: "Core data completeness",
    level: "automated",
    isMandatory: true,
    checkFn: (data) => {
      const required = ["client_id", "property_type", "purpose", "basis_of_value"];
      const missing = required.filter(f => !data.assignment?.[f]);
      return {
        passed: missing.length === 0,
        score: Math.round(((required.length - missing.length) / required.length) * 100),
        messageAr: missing.length === 0 ? "جميع البيانات الأساسية مكتملة" : `حقول ناقصة: ${missing.length}`,
        messageEn: missing.length === 0 ? "All core data complete" : `Missing fields: ${missing.length}`,
      };
    },
  },
  {
    id: "comparables_count",
    category: "methodology",
    labelAr: "الحد الأدنى للمقارنات (3+)",
    labelEn: "Minimum comparables (3+)",
    level: "automated",
    isMandatory: true,
    checkFn: (data) => {
      const count = data.comparables?.length || 0;
      return {
        passed: count >= 3,
        score: Math.min(100, Math.round((count / 3) * 100)),
        messageAr: count >= 3 ? `${count} مقارنات متوفرة` : `${count} فقط — يجب 3 على الأقل`,
        messageEn: count >= 3 ? `${count} comparables available` : `Only ${count} — need at least 3`,
      };
    },
  },
  {
    id: "comparables_recency",
    category: "methodology",
    labelAr: "حداثة المقارنات (أقل من 12 شهر)",
    labelEn: "Comparables recency (<12 months)",
    level: "automated",
    isMandatory: true,
    checkFn: (data) => {
      const comps = data.comparables || [];
      if (comps.length === 0) return { passed: false, score: 0, messageAr: "لا توجد مقارنات", messageEn: "No comparables" };
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 12);
      const recent = comps.filter((c: any) => c.transaction_date && new Date(c.transaction_date) >= cutoff);
      const pct = Math.round((recent.length / comps.length) * 100);
      return {
        passed: pct >= 80,
        score: pct,
        messageAr: `${recent.length} من ${comps.length} مقارنات حديثة (${pct}%)`,
        messageEn: `${recent.length} of ${comps.length} comparables are recent (${pct}%)`,
      };
    },
  },
  {
    id: "inspection_complete",
    category: "inspection",
    labelAr: "اكتمال المعاينة الميدانية",
    labelEn: "Field inspection completed",
    level: "automated",
    isMandatory: true,
    checkFn: (data) => {
      const completed = data.inspection?.completed === true;
      return {
        passed: completed,
        score: completed ? 100 : 0,
        messageAr: completed ? "المعاينة مكتملة" : "المعاينة غير مكتملة",
        messageEn: completed ? "Inspection complete" : "Inspection not completed",
      };
    },
  },
  {
    id: "photos_minimum",
    category: "inspection",
    labelAr: "الحد الأدنى للصور (5+)",
    labelEn: "Minimum photos (5+)",
    level: "automated",
    isMandatory: false,
    checkFn: (data) => {
      const count = data.photos?.length || 0;
      return {
        passed: count >= 5,
        score: Math.min(100, Math.round((count / 5) * 100)),
        messageAr: count >= 5 ? `${count} صورة مرفقة` : `${count} فقط — يُوصى بـ 5 على الأقل`,
        messageEn: count >= 5 ? `${count} photos attached` : `Only ${count} — recommend at least 5`,
      };
    },
  },
  {
    id: "value_outlier",
    category: "results",
    labelAr: "فحص القيم المتطرفة",
    labelEn: "Value outlier check",
    level: "automated",
    isMandatory: false,
    checkFn: (data) => {
      const comps = data.comparables || [];
      if (comps.length < 2) return { passed: true, score: 100, messageAr: "غير قابل للتطبيق", messageEn: "N/A" };
      const prices = comps.map((c: any) => c.price_per_sqm).filter(Boolean);
      if (prices.length < 2) return { passed: true, score: 100, messageAr: "غير قابل للتطبيق", messageEn: "N/A" };
      const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
      const outliers = prices.filter((p: number) => Math.abs(p - avg) / avg > 0.5);
      return {
        passed: outliers.length === 0,
        score: Math.round(((prices.length - outliers.length) / prices.length) * 100),
        messageAr: outliers.length === 0 ? "لا توجد قيم متطرفة" : `${outliers.length} قيم تتجاوز 50% من المتوسط`,
        messageEn: outliers.length === 0 ? "No outliers detected" : `${outliers.length} values exceed 50% from mean`,
      };
    },
  },
];

const PEER_REVIEW_CHECKS: QCCheck[] = [
  { id: "methodology_appropriate", category: "methodology", labelAr: "ملاءمة المنهجية المستخدمة", labelEn: "Methodology appropriateness", level: "peer_review", isMandatory: true },
  { id: "adjustments_justified", category: "adjustments", labelAr: "تبرير التعديلات", labelEn: "Adjustments justified", level: "peer_review", isMandatory: true },
  { id: "market_analysis_depth", category: "market", labelAr: "عمق تحليل السوق", labelEn: "Market analysis depth", level: "peer_review", isMandatory: false },
  { id: "report_clarity", category: "report", labelAr: "وضوح التقرير وسلامة اللغة", labelEn: "Report clarity & language", level: "peer_review", isMandatory: false },
];

const SENIOR_REVIEW_CHECKS: QCCheck[] = [
  { id: "ivs_compliance", category: "compliance", labelAr: "الامتثال لمعايير IVS 2025", labelEn: "IVS 2025 compliance", level: "senior_review", isMandatory: true },
  { id: "taqeem_compliance", category: "compliance", labelAr: "الامتثال لمتطلبات تقييم", labelEn: "TAQEEM compliance", level: "senior_review", isMandatory: true },
  { id: "value_reasonableness", category: "results", labelAr: "معقولية القيمة النهائية", labelEn: "Final value reasonableness", level: "senior_review", isMandatory: true },
];

export function runAutomatedQC(data: {
  assignment: any;
  comparables: any[];
  inspection: any;
  photos: any[];
}): QCReport {
  const results: QCCheckResultItem[] = [];

  // Run automated checks
  for (const check of AUTOMATED_CHECKS) {
    const result = check.checkFn ? check.checkFn(data) : { passed: false, score: 0, messageAr: "فحص يدوي مطلوب", messageEn: "Manual check required" };
    results.push({ checkId: check.id, labelAr: check.labelAr, labelEn: check.labelEn, level: check.level, result, isMandatory: check.isMandatory });
  }

  // Placeholder for manual review levels
  const peerResults: QCCheckResultItem[] = PEER_REVIEW_CHECKS.map(c => ({
    checkId: c.id, labelAr: c.labelAr, labelEn: c.labelEn, level: c.level,
    result: { passed: false, score: 0, messageAr: "بانتظار مراجعة الأقران", messageEn: "Awaiting peer review" },
    isMandatory: c.isMandatory,
  }));

  const seniorResults: QCCheckResultItem[] = SENIOR_REVIEW_CHECKS.map(c => ({
    checkId: c.id, labelAr: c.labelAr, labelEn: c.labelEn, level: c.level,
    result: { passed: false, score: 0, messageAr: "بانتظار مراجعة كبير المقيمين", messageEn: "Awaiting senior review" },
    isMandatory: c.isMandatory,
  }));

  const allResults = [...results, ...peerResults, ...seniorResults];

  // Calculate level scores
  const levelResults: QCReport["levelResults"] = {
    automated: calcLevelScore(results),
    peer_review: calcLevelScore(peerResults),
    senior_review: calcLevelScore(seniorResults),
    final_approval: { score: 0, status: "pending", checks: [] },
  };

  const automatedScore = levelResults.automated.score;
  const blockers = allResults.filter(r => r.isMandatory && !r.result.passed);
  const warnings = allResults.filter(r => !r.isMandatory && !r.result.passed);

  return {
    overallScore: automatedScore,
    overallStatus: blockers.length > 0 ? "failed" : automatedScore >= 80 ? "passed" : "needs_revision",
    levelResults,
    blockers,
    warnings,
    timestamp: new Date().toISOString(),
  };
}

function calcLevelScore(items: QCCheckResultItem[]): { score: number; status: QCStatus; checks: QCCheckResultItem[] } {
  if (items.length === 0) return { score: 0, status: "pending", checks: items };
  const avgScore = Math.round(items.reduce((sum, i) => sum + i.result.score, 0) / items.length);
  const hasFails = items.some(i => i.isMandatory && !i.result.passed);
  return {
    score: avgScore,
    status: hasFails ? "failed" : avgScore >= 80 ? "passed" : "needs_revision",
    checks: items,
  };
}

export function getQCLevelLabel(level: QCLevel): string {
  switch (level) {
    case "automated": return "فحص آلي";
    case "peer_review": return "مراجعة الأقران";
    case "senior_review": return "مراجعة كبير المقيمين";
    case "final_approval": return "الاعتماد النهائي";
  }
}

export function getQCStatusBadge(status: QCStatus): { label: string; color: string } {
  switch (status) {
    case "passed": return { label: "ناجح", color: "bg-green-100 text-green-700 border-green-200" };
    case "failed": return { label: "لم يجتز", color: "bg-red-100 text-red-700 border-red-200" };
    case "needs_revision": return { label: "يحتاج تعديل", color: "bg-yellow-100 text-yellow-700 border-yellow-200" };
    case "pending": return { label: "معلّق", color: "bg-gray-100 text-gray-500 border-gray-200" };
  }
}
