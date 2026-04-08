import type { ScopeData, PricingData } from "./types";

export const MOCK_EXTRACTED_DATA = {
  discipline: "real_estate",
  discipline_label: "تقييم عقاري",
  confidence: 88,
  description: "فيلا سكنية من دورين في حي النرجس بالرياض، مساحة الأرض 625 م²",
  inventory: [
    {
      id: 1, name: "فيلا سكنية دورين", type: "real_estate", category: "فيلا", quantity: 1, condition: "good",
      fields: [
        { key: "area_sqm", label: "المساحة م²", value: "625", confidence: 96 },
        { key: "city", label: "المدينة", value: "الرياض", confidence: 95 },
        { key: "district", label: "الحي", value: "حي النرجس", confidence: 95 },
        { key: "building_area_sqm", label: "مساحة البناء م²", value: "480", confidence: 91 },
        { key: "floors_count", label: "عدد الطوابق", value: "2", confidence: 91 },
        { key: "classification", label: "التصنيف", value: "سكني", confidence: 90 },
      ],
    },
  ],
  client: { clientName: "شركة الرياض للتطوير العقاري" },
  suggestedPurpose: "تمويل بنكي",
};

export const MOCK_SCOPE: ScopeData = {
  valuationType: "تقييم عقاري",
  valuationStandard: "IVS 2024 + معايير الهيئة السعودية للمقيمين المعتمدين",
  valuationBasis: "القيمة السوقية",
  approaches: ["المقارنة السوقية", "التكلفة", "الدخل"],
  primaryApproach: "المقارنة السوقية",
  secondaryApproach: "التكلفة",
  approachJustification: "تم اختيار منهجية المقارنة السوقية كمنهجية رئيسية نظراً لتوفر بيانات مقارنة كافية في حي النرجس بالرياض",
  inspectionType: "معاينة ميدانية شاملة",
  inspectionRequirements: ["فحص خارجي كامل", "فحص داخلي لجميع الأدوار", "تصوير فوتوغرافي شامل", "التحقق من إحداثيات GPS"],
  deliverables: ["تقرير تقييم شامل بالعربية", "ملخص تنفيذي", "صور المعاينة الميدانية", "خريطة الموقع"],
  estimatedDays: 7,
  assumptions: [
    "يُفترض أن المعلومات المقدمة من العميل صحيحة وكاملة",
    "يُفترض عدم وجود تلوث بيئي أو مخاطر خفية في العقار",
    "يُفترض أن العقار يتوافق مع أنظمة البناء والتخطيط المعمول بها",
    "يُفترض أن الوثائق القانونية سارية المفعول وصحيحة",
  ],
  limitations: [
    "لا يشمل التقييم أي أصول منقولة داخل العقار",
    "التقييم مبني على ظروف السوق في تاريخ التقييم فقط",
    "لم يتم إجراء فحص إنشائي تفصيلي أو فحص للتربة",
  ],
  disciplineAnalysis: {
    discipline: "real_estate",
    disciplineLabel: "تقييم عقاري",
    confidence: 94,
    reason: "المستندات تشير بوضوح إلى عقار سكني (فيلا) مع صك ملكية ورخصة بناء",
    signals: ["صك ملكية عقاري", "رخصة بناء سكنية", "عنوان عقاري واضح", "مخططات هندسية للمبنى"],
    subTypes: ["سكني — فيلا خاصة"],
  },
  purposeAnalysis: {
    selectedPurpose: "تمويل بنكي",
    confidence: 91,
    reason: "وجود خطاب من البنك الأهلي يطلب تقييم العقار لأغراض الرهن العقاري",
    allPurposes: [
      { key: "mortgage", label: "تمويل بنكي", confidence: 91, reason: "خطاب بنكي رسمي" },
      { key: "sale", label: "بيع وشراء", confidence: 45, reason: "احتمال ثانوي" },
      { key: "insurance", label: "تأمين", confidence: 20, reason: "احتمال ضعيف" },
    ],
  },
  basisOfValueAnalysis: {
    selectedBasis: "القيمة السوقية",
    selectedBasisEn: "Market Value",
    confidence: 96,
    reason: "غرض التمويل البنكي يتطلب تحديد القيمة السوقية العادلة وفق IVS 104",
    ivsReference: "IVS 104",
    allBases: [
      { key: "market", label: "القيمة السوقية", labelEn: "Market Value", confidence: 96, reason: "الأساس المطلوب للتمويل", ivsReference: "IVS 104" },
      { key: "investment", label: "القيمة الاستثمارية", labelEn: "Investment Value", confidence: 30, reason: "غير مطلوب حالياً" },
      { key: "liquidation", label: "قيمة التصفية", labelEn: "Liquidation Value", confidence: 10, reason: "غير مناسب" },
    ],
  },
  methodologyAnalysis: {
    primaryApproach: {
      key: "market", label: "المقارنة السوقية", labelEn: "Market Comparison",
      role: "primary", confidence: 92, reason: "توفر بيانات مبيعات مماثلة كافية",
    },
    secondaryApproach: {
      key: "income", label: "الدخل", labelEn: "Income Approach",
      role: "secondary", confidence: 85, reason: "عقد إيجار ساري يدعم تحليل التدفقات النقدية",
    },
    allApproaches: [
      { key: "market", label: "المقارنة السوقية", labelEn: "Market Comparison", role: "primary", confidence: 92, reason: "توفر بيانات مبيعات مماثلة كافية" },
      { key: "income", label: "الدخل", labelEn: "Income Approach", role: "secondary", confidence: 85, reason: "عقد إيجار ساري يدعم تحليل التدفقات النقدية" },
      { key: "cost", label: "التكلفة", labelEn: "Cost Approach", role: "supporting", confidence: 55, reason: "داعمة للتحقق من تكلفة الإحلال" },
    ],
    justification: "وفقاً لمعيار IVS 105، تم اختيار المقارنة السوقية كمنهجية رئيسية مع أسلوب الدخل كمنهجية ثانوية",
  },
};

export const MOCK_PRICING: PricingData = {
  basePrice: 3500,
  cityMultiplier: 1.15,
  adjustedBase: 4025,
  sizeCategory: "متوسط (500-1000 م²)",
  breakdown: {
    complexityAdjustment: 403,
    complexityFactor: 1.1,
    complexityReason: "منهجيتان مطلوبتان (مقارنة سوقية + دخل) — تعقيد متوسط",
    urgencyAdjustment: 0,
    urgencyFactor: 1.0,
    rentalAnalysisSurcharge: 0,
    portfolioDiscount: 0,
    additionalServices: [
      { name: "رسوم المعاينة الميدانية", price: 500 },
      { name: "رسوم تحليل الدخل (إضافية)", price: 1000 },
    ],
    additionalTotal: 1500,
  },
  subtotal: 5000,
  vatRate: 15,
  vatAmount: 750,
  totalPrice: 5750,
  justification: "تم احتساب التسعير بناءً على الرسوم الأساسية (3,500 ر.س) + رسوم المعاينة (500 ر.س) + رسوم تحليل الدخل (1,000 ر.س) = 5,000 ر.س قبل الضريبة",
};
