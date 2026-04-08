import type { AggregatedData, ReportDraft } from "./types";

export const MOCK_AGGREGATED_DATA: AggregatedData = {
  request: {
    id: "mock-demo-001",
    property_type: "فيلا سكنية",
    property_city_ar: "الرياض",
    property_district_ar: "حي النرجس",
    valuation_purpose: "تمويل بنكي",
    status: "in_production",
  },
  assignment: {
    id: "mock-assign-001",
    reference_number: "VAL-2026-0042",
    valuation_approach: "مقارنة سوقية (رئيسي) + تكلفة (ثانوي)",
    effective_date: "2026-03-28",
  },
  client: {
    record: { name_ar: "أحمد المالكي", email: "ahmed@almalkivaluation.sa", phone: "0551234567" },
    profile: { full_name_ar: "أحمد المالكي" },
  },
  subject: {
    property_type: "villa",
    land_area: 625,
    building_area: 480,
    city_ar: "الرياض",
    district_ar: "حي النرجس",
    address_ar: "شارع الأمير سلطان، حي النرجس، الرياض",
    year_built: 2021,
    number_of_floors: 2,
    zoning_ar: "سكني",
    condition: "ممتازة",
    finishing_level: "سوبر ديلوكس",
    description_ar: "فيلا سكنية مكونة من دورين وملحق علوي، تشطيب سوبر ديلوكس، تتضمن 5 غرف نوم و6 دورات مياه وصالة استقبال ومجلس وغرفة خادمة ومطبخ مجهز وموقف سيارتين مغطى وحديقة خلفية.",
  },
  inspection: {
    inspection_date: "2026-03-25",
    inspector_name: "خالد بن سعد الدوسري",
    condition_rating: "ممتازة",
    notes_ar: "العقار بحالة ممتازة، التشطيبات عالية الجودة، لا توجد عيوب ظاهرية. الموقع مميز بالقرب من طريق الملك سلمان.",
    gps_verified: true,
    latitude: 24.8234,
    longitude: 46.6721,
  },
  comparables: [
    { id: "c1", property_type: "villa", city_ar: "الرياض", district_ar: "حي النرجس", land_area: 600, price: 2750000, price_per_sqm: 4583, transaction_date: "2026-02-15", confidence_score: 94 },
    { id: "c2", property_type: "villa", city_ar: "الرياض", district_ar: "حي النرجس", land_area: 650, price: 3000000, price_per_sqm: 4615, transaction_date: "2026-01-20", confidence_score: 92 },
    { id: "c3", property_type: "villa", city_ar: "الرياض", district_ar: "حي النرجس", land_area: 580, price: 2650000, price_per_sqm: 4568, transaction_date: "2025-12-10", confidence_score: 90 },
    { id: "c4", property_type: "villa", city_ar: "الرياض", district_ar: "حي النرجس", land_area: 700, price: 3100000, price_per_sqm: 4428, transaction_date: "2026-03-01", confidence_score: 87 },
  ],
  final_value: {
    amount: 2850000,
    currency: "ر.س",
    text_ar: "مليونان وثمانمائة وخمسون ألف ريال سعودي",
    basis_of_value_ar: "القيمة السوقية",
    confidence_level: "high",
    effective_date: "2026-03-28",
  },
  valuer: { full_name_ar: "أحمد بن سعد المالكي", taqeem_id: "1210000XXX", rics_number: "RICS-12345" },
  reviewer: { full_name_ar: "أواب المالكي" },
  organization: { name_ar: "المالكي والشركاء للتقييم العقاري", license_number: "1210000001", cr_number: "1010XXXXXX" },
} as any;

export const MOCK_REPORT_DRAFT: ReportDraft = {
  reference_number: "VAL-2026-0042",
  report_date: "2026-03-28",
  final_value: {
    amount: 2850000,
    currency: "ر.س",
    text_ar: "مليونان وثمانمائة وخمسون ألف ريال سعودي",
    basis_of_value_ar: "القيمة السوقية",
    confidence_level: "high",
    effective_date: "2026-03-28",
  },
  metadata: {
    standards_referenced: ["المعايير الدولية للتقييم IVS 2024", "معايير تقييم العقارات السعودية"],
    approaches_used: ["مقارنة سوقية", "تكلفة"],
    data_completeness_pct: 94,
    sections_needing_review: [],
    missing_data_items: [],
  },
  sections: {
    executive_summary: {
      title_ar: "الملخص التنفيذي",
      content_ar: `## ملخص التقييم\n\nتم إجراء تقييم عقاري شامل لفيلا سكنية تقع في حي النرجس بمدينة الرياض، بناءً على طلب العميل **أحمد المالكي** لغرض **التمويل البنكي**.\n\n### بيانات العقار الأساسية\n- **النوع:** فيلا سكنية مكونة من دورين وملحق علوي\n- **المساحة:** 625 م² (أرض) / 480 م² (بناء)\n- **الموقع:** شارع الأمير سلطان، حي النرجس، الرياض\n- **سنة البناء:** 2021\n- **الحالة:** ممتازة - تشطيب سوبر ديلوكس\n\n### القيمة المستنتجة\nبناءً على تحليل السوق واستخدام أسلوب المقارنة بالمبيعات كمنهج رئيسي وأسلوب التكلفة كمنهج مساند، تم التوصل إلى أن **القيمة السوقية العادلة** للعقار بتاريخ 28 مارس 2026 هي:\n\n> **2,850,000 ريال سعودي** (مليونان وثمانمائة وخمسون ألف ريال سعودي)\n\nتم الاعتماد على 4 مقارنات سوقية من نفس الحي خلال الأشهر الستة الأخيرة، مما يعزز موثوقية النتيجة.`,
    },
    scope_of_work: {
      title_ar: "نطاق العمل",
      content_ar: `## نطاق العمل والمهمة\n\n### تعريف المهمة\nتم تكليفنا بإعداد تقرير تقييم عقاري شامل للعقار الموصوف أدناه وفقاً للمعايير الدولية للتقييم (IVS 2024) ومعايير الهيئة السعودية للمقيمين المعتمدين (تقييم).\n\n### أساس القيمة\n- **القيمة السوقية** وفقاً لتعريف المعايير الدولية للتقييم\n- تاريخ التقييم: 28 مارس 2026\n\n### منهجيات التقييم المستخدمة\n1. **أسلوب المقارنة بالمبيعات** (المنهج الرئيسي)\n2. **أسلوب التكلفة** (المنهج المساند)`,
    },
    property_description: {
      title_ar: "وصف العقار",
      content_ar: `## الوصف التفصيلي للعقار\n\n### المواصفات العامة\n| البند | التفاصيل |\n|-------|--------|\n| نوع العقار | فيلا سكنية |\n| مساحة الأرض | 625 م² |\n| مساحة البناء | 480 م² |\n| عدد الأدوار | دوران وملحق علوي |\n| سنة البناء | 2021 |\n| مستوى التشطيب | سوبر ديلوكس |`,
      tables: [{
        caption_ar: "ملخص المساحات",
        headers: ["المكون", "المساحة (م²)", "النسبة"],
        rows: [
          ["الدور الأرضي", "240", "50%"],
          ["الدور الأول", "200", "42%"],
          ["الملحق العلوي", "40", "8%"],
          ["إجمالي البناء", "480", "100%"],
        ],
      }],
    },
    location_analysis: {
      title_ar: "تحليل الموقع",
      content_ar: `## تحليل الموقع والبيئة المحيطة\n\nيقع العقار في **حي النرجس** شمال مدينة الرياض.`,
    },
    market_overview: {
      title_ar: "نظرة عامة على السوق",
      content_ar: `## تحليل السوق العقاري\n\nيشهد السوق العقاري السكني في شمال الرياض استقراراً نسبياً مع ميل طفيف نحو الارتفاع.`,
    },
    sales_comparison_approach: {
      title_ar: "أسلوب المقارنة بالمبيعات",
      content_ar: `## تحليل المقارنة بالمبيعات\n\nتم اختيار 4 مقارنات من صفقات فعلية في **حي النرجس**.`,
      tables: [{
        caption_ar: "ملخص المقارنات السوقية",
        headers: ["المقارن", "الحي", "المساحة (م²)", "السعر (ر.س)", "سعر/م²", "التاريخ", "الثقة"],
        rows: [
          ["مقارن 1", "النرجس", "600", "2,750,000", "4,583", "2026-02", "94%"],
          ["مقارن 2", "النرجس", "650", "3,000,000", "4,615", "2026-01", "92%"],
          ["مقارن 3", "النرجس", "580", "2,650,000", "4,568", "2025-12", "90%"],
          ["مقارن 4", "النرجس", "700", "3,100,000", "4,428", "2026-03", "87%"],
        ],
      }],
    },
    cost_approach: {
      title_ar: "أسلوب التكلفة",
      content_ar: `## تحليل أسلوب التكلفة (المنهج المساند)\n\nتم استخدام أسلوب التكلفة كمنهج مساند للتحقق من معقولية النتيجة.`,
    },
    reconciliation: {
      title_ar: "التسوية واستنتاج القيمة",
      content_ar: `## التسوية واستنتاج القيمة النهائية\n\n> **القيمة السوقية العادلة = 2,850,000 ريال سعودي**`,
    },
    assumptions_and_limiting_conditions: {
      title_ar: "الافتراضات والقيود",
      content_ar: `## الافتراضات والشروط المقيدة\n\n1. أن جميع المعلومات المقدمة صحيحة ودقيقة\n2. أن العقار خالٍ من أي رهونات`,
    },
    compliance_statement: {
      title_ar: "بيان الامتثال",
      content_ar: `## بيان الامتثال والتوافق\n\nيشهد المقيّم أن هذا التقرير أُعد وفقاً لـ IVS 2024 ومعايير تقييم.`,
    },
    valuer_certification: {
      title_ar: "شهادة المقيّم",
      content_ar: `## شهادة وتوقيع المقيّم\n\n- **الاسم:** أحمد بن سعد المالكي\n- **رقم العضوية:** 1210000XXX`,
    },
  },
};
