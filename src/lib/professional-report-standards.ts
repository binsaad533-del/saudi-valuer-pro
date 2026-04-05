/**
 * Professional Report Standards Configuration
 * معايير التقرير المهني الموحد
 * 
 * Enforces a single unified professional format for all reports.
 * All reports must comply with IVS 2025 and Taqeem standards.
 */

/**
 * Mandatory sections that MUST appear in every valuation report.
 * No section can be omitted or simplified.
 */
export const MANDATORY_REPORT_SECTIONS = [
  {
    key: "assignment_definition",
    titleAr: "تعريف مهمة التقييم",
    titleEn: "Assignment Definition",
    description: "تحديد نطاق العمل، الغرض، المستخدمين المقصودين، والقيود",
    order: 1,
  },
  {
    key: "basis_of_value",
    titleAr: "أساس القيمة",
    titleEn: "Basis of Value",
    description: "تحديد أساس القيمة المعتمد مع المرجع المعياري (IVS 104)",
    order: 2,
  },
  {
    key: "scope_of_work",
    titleAr: "نطاق العمل",
    titleEn: "Scope of Work",
    description: "وصف تفصيلي لنطاق المعاينة والتحليل ومصادر البيانات",
    order: 3,
  },
  {
    key: "asset_description",
    titleAr: "وصف الأصل",
    titleEn: "Asset Description",
    description: "وصف شامل للأصل محل التقييم مع الخصائص الفيزيائية والقانونية",
    order: 4,
  },
  {
    key: "valuation_methodology",
    titleAr: "منهجية التقييم",
    titleEn: "Valuation Methodology",
    description: "تحديد الأساليب المستخدمة مع تبرير الاختيار وفقاً لـ IVS 105",
    order: 5,
  },
  {
    key: "analysis_calculations",
    titleAr: "التحليل والحسابات",
    titleEn: "Analysis & Calculations",
    description: "عرض تفصيلي للحسابات والمقارنات والتعديلات مع المصادر",
    order: 6,
  },
  {
    key: "justification",
    titleAr: "المبررات المهنية",
    titleEn: "Professional Justification",
    description: "تبرير القرارات المهنية والنتائج بناءً على البيانات الفعلية",
    order: 7,
  },
  {
    key: "assumptions_limitations",
    titleAr: "الافتراضات والقيود",
    titleEn: "Assumptions & Limiting Conditions",
    description: "الافتراضات العامة والخاصة والشروط المقيدة",
    order: 8,
  },
  {
    key: "risk_analysis",
    titleAr: "تحليل المخاطر",
    titleEn: "Risk Analysis",
    description: "تحليل المخاطر المحددة وتأثيرها على القيمة",
    order: 9,
  },
  {
    key: "compliance_statement",
    titleAr: "بيان الامتثال",
    titleEn: "Compliance Statement",
    description: "إقرار بالامتثال للمعايير المهنية (IVS 2025، تقييم، RICS)",
    order: 10,
  },
  {
    key: "final_value_opinion",
    titleAr: "رأي القيمة النهائي",
    titleEn: "Final Value Opinion",
    description: "القيمة النهائية بالأرقام والحروف مع العملة وتاريخ التقييم",
    order: 11,
  },
] as const;

/**
 * Professional writing standards enforced on ALL report content.
 */
export const PROFESSIONAL_WRITING_STANDARDS = {
  /** Tone must be formal Arabic (فصحى مهنية) */
  tone: "formal_professional" as const,
  
  /** No casual, abbreviated, or overly brief summaries */
  prohibitions: [
    "casual_language",
    "brief_summaries",
    "missing_explanations",
    "generic_templates",
    "inconsistent_detail_level",
  ],
  
  /** Every justification must reference actual data */
  justificationRules: [
    "reference_actual_data",
    "explain_decisions_clearly",
    "reflect_risks_and_assumptions",
    "consistent_across_sections",
    "cite_ivs_standards",
  ],
  
  /** Minimum content requirements per section */
  minimumContentRequirements: {
    /** Minimum paragraphs per major section */
    minParagraphsPerSection: 2,
    /** Assumptions must list at least 4 items */
    minAssumptions: 4,
    /** Limiting conditions must list at least 3 items */
    minLimitingConditions: 3,
  },
} as const;

/**
 * Validates that a report has all mandatory sections with sufficient content.
 * Returns list of missing or incomplete sections.
 */
export function validateReportCompleteness(
  sections: Record<string, string>
): { valid: boolean; missing: string[]; incomplete: string[] } {
  const missing: string[] = [];
  const incomplete: string[] = [];

  for (const section of MANDATORY_REPORT_SECTIONS) {
    const content = sections[section.key];
    if (!content || content.trim().length === 0) {
      missing.push(section.titleAr);
    } else if (content.trim().length < 100) {
      incomplete.push(section.titleAr);
    }
  }

  return {
    valid: missing.length === 0 && incomplete.length === 0,
    missing,
    incomplete,
  };
}

/**
 * The unified system prompt enforcement block for all AI report generation.
 * Must be appended to every report generation prompt.
 */
export const PROFESSIONAL_REPORT_ENFORCEMENT_PROMPT = `
══════ معايير التقرير المهني الموحد ══════

【قواعد ملزمة — لا يمكن تجاوزها】

1. جميع التقارير تتبع تنسيقاً مهنياً موحداً — لا يوجد تبسيط أو اختصار بناءً على نوع العميل.

2. الأقسام الإلزامية (يجب تضمينها جميعاً في كل تقرير):
   - تعريف مهمة التقييم (النطاق، الغرض، المستخدمون المقصودون)
   - أساس القيمة مع المرجع المعياري
   - نطاق العمل التفصيلي
   - وصف الأصل الشامل
   - منهجية التقييم مع تبرير الاختيار
   - التحليل والحسابات التفصيلية
   - المبررات المهنية المبنية على البيانات
   - الافتراضات والقيود
   - تحليل المخاطر
   - بيان الامتثال
   - رأي القيمة النهائي

3. أسلوب الكتابة:
   - اللغة العربية الفصحى المهنية حصراً
   - لا يُقبل أي أسلوب غير رسمي أو مختصر
   - كل قسم يجب أن يحتوي على فقرات مترابطة ومفصلة
   - لا يُقبل الاقتصار على نقاط مختصرة بدون شرح

4. المبررات المهنية يجب أن:
   - تستند إلى بيانات فعلية من الطلب
   - تشرح القرارات بوضوح
   - تعكس المخاطر والافتراضات
   - تكون متسقة عبر جميع الأقسام
   - تستشهد بمعايير IVS و تقييم المحددة

5. لا يُسمح بـ:
   - أقسام فارغة أو ناقصة
   - تبسيط المحتوى لأي سبب
   - تفاوت في المستوى المهني بين الأقسام
   - صياغات عامة قابلة للتطبيق على أي عقار

6. كل تقرير يجب أن يكون جاهزاً للتقديم إلى:
   - البنوك وجهات التمويل
   - المحاكم والجهات القضائية
   - الجهات الحكومية والرقابية
   - بدون أي تعديل إضافي
`;
