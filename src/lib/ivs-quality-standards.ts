/**
 * معايير جودة تقارير التقييم — IVS 2025
 * مستخرج من: نموذج قياس جودة تقارير التقييم
 * 
 * نظام التقييم:
 * 0 = غير مذكور / مفقود / خطأ جوهري
 * 1 = ذكر سطحي بدون شرح أو دليل
 * 2 = ذكر ومبرر جزئياً / دعم محدود
 * 3 = واضح، مبرر، مدعوم بمصادر/بيانات ويمكن التحقق منه
 */

export type IVSStandardCode =
  | "IVS101" | "IVS102" | "IVS103" | "IVS104"
  | "IVS105" | "IVS106" | "IVS400" | "IVS410";

export type QCGrade = "excellent" | "very_good" | "good" | "acceptable" | "poor";

export interface IVSCheckItem {
  ref: string;           // e.g. "20.1(أ)"
  question_ar: string;
  weight_pct: number;    // weight within the standard (sums to 100%)
  optional?: boolean;    // "إن وجد" or "إن أمكن"
  condition?: "market_approach" | "income_approach" | "cost_approach" | "development_property";
}

export interface IVSStandard {
  code: IVSStandardCode;
  title_ar: string;
  title_en: string;
  weight_pct: number;    // overall weight (all standards sum to 100%)
  items: IVSCheckItem[];
}

export const IVS_GRADE_THRESHOLDS: { min: number; grade: QCGrade; label_ar: string; label_en: string; color: string }[] = [
  { min: 86, grade: "excellent", label_ar: "ممتاز", label_en: "Excellent", color: "text-green-600" },
  { min: 76, grade: "very_good", label_ar: "جيد جداً", label_en: "Very Good", color: "text-blue-600" },
  { min: 66, grade: "good", label_ar: "جيد", label_en: "Good", color: "text-amber-600" },
  { min: 51, grade: "acceptable", label_ar: "مقبول", label_en: "Acceptable", color: "text-orange-600" },
  { min: 0, grade: "poor", label_ar: "ضعيف", label_en: "Poor", color: "text-red-600" },
];

export function getGrade(score: number) {
  return IVS_GRADE_THRESHOLDS.find(t => score >= t.min) || IVS_GRADE_THRESHOLDS[IVS_GRADE_THRESHOLDS.length - 1];
}

export const IVS_STANDARDS: IVSStandard[] = [
  // ═══════════════════════════════════════════
  // IVS 101 — نطاق العمل (20%)
  // ═══════════════════════════════════════════
  {
    code: "IVS101",
    title_ar: "IVS 101 نطاق العمل",
    title_en: "IVS 101 Scope of Work",
    weight_pct: 20,
    items: [
      { ref: "20.1(أ)", question_ar: "هل تم تحديد الأصل أو الالتزام محل التقييم بوضوح؟", weight_pct: 7 },
      { ref: "20.1(ب)", question_ar: "هل تم تحديد هوية العميل أو العملاء بشكل صريح؟", weight_pct: 7 },
      { ref: "20.1(ج)", question_ar: "هل تم ذكر الاستخدام المقصود بوضوح؟", weight_pct: 7 },
      { ref: "20.1(د)", question_ar: "هل تم تحديد المستخدم المقصود؟", weight_pct: 7, optional: true },
      { ref: "20.1(هـ)", question_ar: "هل تم الإفصاح عن أي تضارب محتمل في المصالح أو تحيز بين المقيّم والعميل؟", weight_pct: 7 },
      { ref: "20.1(و)", question_ar: "هل تم تحديد عملة التقييم؟", weight_pct: 3 },
      { ref: "20.1(ز)", question_ar: "هل تم تحديد تاريخ التقييم صراحة؟", weight_pct: 7 },
      { ref: "20.1(ط)", question_ar: "هل تم ذكر طبيعة عمل المقيّم ونطاق أو أي قيود مفروضة عليه؟", weight_pct: 7 },
      { ref: "20.1(ي)", question_ar: "هل تم توضيح طبيعة ومصدر المعلومات الهامة التي يعتمد عليها المُقيّم والتحقق منها؟", weight_pct: 7 },
      { ref: "20.1(ك)", question_ar: "هل تم ذكر الافتراضات الخاصة محل التقييم؟", weight_pct: 7 },
      { ref: "20.1(ل)", question_ar: "هل تم الإفصاح عن أي أخصائي خارجي تم الاستعانة به؟", weight_pct: 7, optional: true },
      { ref: "20.1(م)", question_ar: "هل تم توضيح العوامل البيئية والاجتماعية والحوكمة للأصل محل التقييم؟", weight_pct: 5 },
      { ref: "20.1(ن)", question_ar: "هل تم ذكر نوع التقرير أو الوثائق الأخرى قيد الإعداد؟", weight_pct: 5 },
      { ref: "20.1(س)", question_ar: "هل تم ذكر القيود المفروضة على استخدام التقرير وتوزيعه ونشره؟", weight_pct: 7 },
      { ref: "20.1(ع)", question_ar: "هل تم ذكر أن المقيّم ملتزم بمعايير التقييم الدولية IVS؟", weight_pct: 10 },
    ],
  },

  // ═══════════════════════════════════════════
  // IVS 102 — أسس القيمة (10%)
  // ═══════════════════════════════════════════
  {
    code: "IVS102",
    title_ar: "IVS 102 أسس القيمة",
    title_en: "IVS 102 Bases of Value",
    weight_pct: 10,
    items: [
      { ref: "3.10", question_ar: "هل فرضية القيمة محددة بوضوح؟ (أعلى وأفضل استخدام، الاستخدام الحالي، التصفية المنظمة، البيع القسري)", weight_pct: 25 },
      { ref: "2.20", question_ar: "هل تم ذكر أساس القيمة المستخدم؟", weight_pct: 20 },
      { ref: "4.20", question_ar: "هل أساس القيمة المستخدم مناسب للغرض من التقييم وللاستخدام المقصود؟", weight_pct: 25 },
      { ref: "6.20", question_ar: "هل تم تعريف أساس القيمة المستخدم؟", weight_pct: 15 },
      { ref: "50.4", question_ar: "هل الافتراضات الجوهرية معقولة، مدعومة بالأدلة، ومناسبة للغرض؟", weight_pct: 15 },
    ],
  },

  // ═══════════════════════════════════════════
  // IVS 103 — أساليب التقييم (20%)
  // ═══════════════════════════════════════════
  {
    code: "IVS103",
    title_ar: "IVS 103 أساليب التقييم",
    title_en: "IVS 103 Valuation Approaches",
    weight_pct: 20,
    items: [
      // General
      { ref: "1.10", question_ar: "هل تم ذكر أسلوب التقييم المتبع؟ (السوق، الدخل، التكلفة)", weight_pct: 3 },
      { ref: "3.10", question_ar: "هل تم ذكر طريقة التقييم المتبعة من المقيّم؟", weight_pct: 3 },
      { ref: "10.4(أ)", question_ar: "هل أسلوب التقييم مناسب لأساس القيمة والغرض والبيانات من السوق؟", weight_pct: 3 },
      { ref: "10.4(ج)", question_ar: "هل طريقة التقييم المستخدمة ملائمة لطبيعة الأصل؟", weight_pct: 3 },
      { ref: "10.7", question_ar: "في حال استخدام أكثر من أسلوب هل كانت طريقة الترجيح صحيحة؟", weight_pct: 3 },
      { ref: "10.9", question_ar: "هل تم تبرير استخدام أو استبعاد الأسلوب أو الأساليب؟", weight_pct: 5 },
      // Market approach
      { ref: "10-السوق-1", question_ar: "هل تم توضيح بيانات مفصلة قابلة للمقارنة؟", weight_pct: 7, condition: "market_approach" },
      { ref: "10-السوق-2", question_ar: "هل تم إرفاق خريطة الموقع تبين موقع مبيعات المقارنة مع صور لكل أصل مباع؟", weight_pct: 3, condition: "market_approach" },
      { ref: "10-السوق-3", question_ar: "هل تم إجراء تحليل مقارن منهجي وتطبيق التعديلات وشرح أسبابها؟", weight_pct: 8, condition: "market_approach" },
      { ref: "10-السوق-4", question_ar: "هل تم عمل جدول التسويات يختصر جميع البيانات المذكورة في سرد التقرير؟", weight_pct: 8, condition: "market_approach" },
      // Income approach
      { ref: "20-الدخل-1", question_ar: "هل تم توضيح المؤشرات الاقتصادية المهمة؟ (معدل العائد، الخصم، المصاريف التشغيلية، الرسملة، النمو)", weight_pct: 3, condition: "income_approach" },
      { ref: "20-الدخل-2", question_ar: "هل تم ذكر مصدر بيانات المؤشرات الاقتصادية؟", weight_pct: 2, condition: "income_approach" },
      { ref: "20-الدخل-3", question_ar: "هل تم ذكر العمليات الحسابية بشكل صحيح في تقرير التقييم؟", weight_pct: 5, condition: "income_approach" },
      { ref: "20-الدخل-4", question_ar: "هل تم توضيح البيانات المستخدمة لأسلوب الدخل؟", weight_pct: 3, condition: "income_approach" },
      { ref: "20-الدخل-5", question_ar: "هل تم توضيح المخاطر الخاصة بالأصل أو الالتزام محل التقييم؟", weight_pct: 3, condition: "income_approach" },
      { ref: "20-الدخل-6", question_ar: "هل تمت مطابقة مؤشرات العائد السوقي لتعكس العوائد السوقية للأصل؟", weight_pct: 3, condition: "income_approach" },
      { ref: "20-الدخل-7", question_ar: "هل تم استنتاج القيمة وتبريرها بشكل صحيح؟", weight_pct: 5, condition: "income_approach" },
      { ref: "20-الدخل-8", question_ar: "هل تم ذكر ملخص للقيمة المحددة باستخدام هذا الأسلوب؟", weight_pct: 2, condition: "income_approach" },
      // Cost approach
      { ref: "30-التكلفة-1", question_ar: "هل تمت مناقشة الإهلاك المادي والوظيفي والخارجي مع دعم عوامل الإهلاك المطبقة؟", weight_pct: 5, condition: "cost_approach" },
      { ref: "30-التكلفة-2", question_ar: "هل تم توضيح مؤشر القيمة باستخدام أسلوب التكلفة؟", weight_pct: 2, condition: "cost_approach" },
      { ref: "30-التكلفة-3", question_ar: "هل تم دعم قيمة الموقع باستخدام أسلوب مقارنة المبيعات للأرض؟", weight_pct: 5, condition: "cost_approach" },
      { ref: "30-التكلفة-4", question_ar: "هل تم توضيح بيانات مفصلة قابلة للمقارنة للأرض؟", weight_pct: 5, condition: "cost_approach" },
      { ref: "30-التكلفة-5", question_ar: "هل تم إرفاق خريطة الموقع لمبيعات المقارنة مع صور الأصول المباعة؟", weight_pct: 2, condition: "cost_approach" },
      { ref: "30-التكلفة-6", question_ar: "هل تم تطوير جدول تسويات للأرض؟", weight_pct: 5, condition: "cost_approach" },
      { ref: "30-التكلفة-7", question_ar: "هل تم استخدام خدمة تقدير التكلفة أو تكاليف البناء المفصلة مع تحديد المصادر بوضوح؟", weight_pct: 3, condition: "cost_approach" },
    ],
  },

  // ═══════════════════════════════════════════
  // IVS 104 — البيانات (20%)
  // ═══════════════════════════════════════════
  {
    code: "IVS104",
    title_ar: "IVS 104 البيانات",
    title_en: "IVS 104 Data and Inputs",
    weight_pct: 20,
    items: [
      { ref: "20", question_ar: "هل أوضح المُقيّم الاستعانة بأخصائي والتحقق من كفاءته في جمع البيانات؟", weight_pct: 10, optional: true },
      { ref: "30.1", question_ar: "هل البيانات ملائمة للأصل، ونطاق العمل، وطريقة التقييم؟", weight_pct: 15 },
      { ref: "30.2(أ)", question_ar: "هل البيانات دقيقة وخالية من التحيز وتعكس ما يُفترض قياسه؟", weight_pct: 15 },
      { ref: "30.2(ب)", question_ar: "هل البيانات كاملة بما يكفي لتغطية خصائص الأصل/الالتزام محل التقييم؟", weight_pct: 10 },
      { ref: "30.2(ج)", question_ar: "هل البيانات تعكس ظروف السوق كما في تاريخ التقييم؟", weight_pct: 10 },
      { ref: "30.2(د)", question_ar: "هل يمكن تتبع مصدر البيانات بوضوح؟", weight_pct: 10 },
      { ref: "40.2", question_ar: "هل المدخلات كافية لتشغيل النموذج/الطريقة فعلياً (لا يوجد نقص جوهري)؟", weight_pct: 10 },
      { ref: "50.1/50.2", question_ar: "هل تم شرح مصدر المدخلات الرئيسية وسبب اختيارها وكيف تم استخدامها؟", weight_pct: 10 },
      { ref: "6-10أ", question_ar: "هل تم قياس العوامل البيئية والاجتماعية والحوكمة وتوضيح مخاطر عدم التطبيق؟", weight_pct: 10 },
    ],
  },

  // ═══════════════════════════════════════════
  // IVS 105 — نماذج التقييم (10%)
  // ═══════════════════════════════════════════
  {
    code: "IVS105",
    title_ar: "IVS 105 نماذج التقييم",
    title_en: "IVS 105 Valuation Models",
    weight_pct: 10,
    items: [
      { ref: "20", question_ar: "هل أوضح المُقيّم الاستعانة بأخصائي لتقديم نموذج تقييم والتحقق من كفاءته؟", weight_pct: 20, optional: true },
      { ref: "40", question_ar: "هل استخدم المقيّم نموذج تقييم مناسب للأصل ونطاق العمل؟", weight_pct: 50 },
      { ref: "50", question_ar: "هل نموذج التقييم يوثق سبب اختيار النموذج والمعلومات والمدخلات والقيود وإجراءات الجودة؟", weight_pct: 30 },
    ],
  },

  // ═══════════════════════════════════════════
  // IVS 106 — التوثيق وإعداد التقارير (10%)
  // ═══════════════════════════════════════════
  {
    code: "IVS106",
    title_ar: "IVS 106 التوثيق وإعداد التقارير",
    title_en: "IVS 106 Documentation and Reporting",
    weight_pct: 10,
    items: [
      { ref: "20", question_ar: "هل تم توثيق المستندات والسجلات الخطية لدعم التبريرات والاستنتاجات؟", weight_pct: 40 },
      { ref: "30", question_ar: "هل تم توثيق معلومات الأصل أو الالتزام محل التقييم؟", weight_pct: 40 },
      { ref: "6.30(ص)", question_ar: "هل التقرير يوضح تاريخ التقرير ويميزه عن تاريخ التقييم إذا اختلفوا؟", weight_pct: 20, optional: true },
    ],
  },

  // ═══════════════════════════════════════════
  // IVS 400 — المصالح العقارية (10%)
  // ═══════════════════════════════════════════
  {
    code: "IVS400",
    title_ar: "IVS 400 معايير الأصول - المصالح العقارية",
    title_en: "IVS 400 Real Property Interests",
    weight_pct: 10,
    items: [
      { ref: "2.20-أ", question_ar: "هل تم تعريف الملكية ووصف المصلحة العقارية محل التقييم؟", weight_pct: 50 },
      { ref: "2.20-ب", question_ar: "هل تم تحديد المصالح العليا أو الدنيا أو حقوق الاستخدام التي تؤثر على المصلحة محل التقييم؟", weight_pct: 50 },
    ],
  },

  // ═══════════════════════════════════════════
  // IVS 410 — العقارات التطويرية (اختياري 0% افتراضي)
  // ═══════════════════════════════════════════
  {
    code: "IVS410",
    title_ar: "IVS 410 العقارات التطويرية",
    title_en: "IVS 410 Development Property",
    weight_pct: 0, // يتم تفعيله فقط عند تقييم العقارات التطويرية
    items: [
      { ref: "410-1", question_ar: "هل الوضع التنظيمي/الترخيصي للأرض أو المشروع واضح؟", weight_pct: 20, condition: "development_property" },
      { ref: "410-2", question_ar: "هل نموذج القيمة المتبقية موضح: قيمة نهائية مطروح منها تكاليف التطوير والربح؟", weight_pct: 15, condition: "development_property" },
      { ref: "410-3", question_ar: "هل تكاليف البناء والتمويل والبنية التحتية والتسويق مأخوذة من مصادر معقولة؟", weight_pct: 20, condition: "development_property" },
      { ref: "410-4", question_ar: "هل معدل العائد/الخصم المستخدم يعكس مخاطر المشروع فعلاً؟", weight_pct: 15, condition: "development_property" },
      { ref: "410-5", question_ar: "هل تم تحليل مخاطر الجدول الزمني (تأخير، تمويل إضافي، تغيير سوق)؟", weight_pct: 10, condition: "development_property" },
      { ref: "410-6", question_ar: "هل تم اختبار حساسية القيمة لتغير التكاليف أو الأسعار أو المدة؟", weight_pct: 10, condition: "development_property" },
      { ref: "410-7", question_ar: "هل التقرير يشرح الافتراضات والمخاطر بشكل يسمح بمراجعة مستقلة؟", weight_pct: 10, condition: "development_property" },
    ],
  },
];

/**
 * Determines the severity based on the standard's weight and item weight.
 * Standards ≥20% weight with items ≥7% = mandatory
 * Standards ≥10% weight = quality
 * Otherwise = enhancement
 */
export function getItemSeverity(standard: IVSStandard, item: IVSCheckItem): "mandatory" | "quality" | "enhancement" {
  if (item.optional) return "quality";
  if (standard.weight_pct >= 20 && item.weight_pct >= 5) return "mandatory";
  if (standard.weight_pct >= 10 && item.weight_pct >= 15) return "mandatory";
  if (standard.weight_pct >= 10) return "quality";
  return "enhancement";
}

/**
 * Filter applicable items based on valuation approaches used
 */
export function getApplicableItems(
  standard: IVSStandard,
  usedApproaches: { market?: boolean; income?: boolean; cost?: boolean; development?: boolean }
): IVSCheckItem[] {
  return standard.items.filter(item => {
    if (!item.condition) return true;
    if (item.condition === "market_approach") return usedApproaches.market;
    if (item.condition === "income_approach") return usedApproaches.income;
    if (item.condition === "cost_approach") return usedApproaches.cost;
    if (item.condition === "development_property") return usedApproaches.development;
    return true;
  });
}

/**
 * Calculate weighted score for a standard
 */
export function calculateStandardScore(
  items: IVSCheckItem[],
  scores: Map<string, number> // ref -> score (0-3)
): number {
  const applicableItems = items.filter(i => scores.has(i.ref));
  if (applicableItems.length === 0) return 100; // no applicable items = full score

  // Redistribute weights among applicable items
  const totalWeight = applicableItems.reduce((s, i) => s + i.weight_pct, 0);
  if (totalWeight === 0) return 100;

  let weightedSum = 0;
  for (const item of applicableItems) {
    const score = scores.get(item.ref) || 0;
    const normalizedWeight = item.weight_pct / totalWeight;
    weightedSum += (score / 3) * normalizedWeight;
  }

  return Math.round(weightedSum * 100);
}

/**
 * Calculate overall report score across all standards
 */
export function calculateOverallScore(
  standardScores: Map<IVSStandardCode, number>,
  isDevelopment: boolean = false
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const std of IVS_STANDARDS) {
    let weight = std.weight_pct;
    if (std.code === "IVS410" && !isDevelopment) continue;
    if (std.code === "IVS410" && isDevelopment) weight = 10; // activate with 10%

    const score = standardScores.get(std.code) ?? 100;
    totalWeight += weight;
    weightedSum += score * weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}
