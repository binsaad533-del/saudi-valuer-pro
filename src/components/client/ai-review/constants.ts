import type { KnowledgeRef } from "./types";

// ── Company Identity & Credentials ──
export const COMPANY = {
  name_ar: "شركة جسّاس للتقييم",
  name_en: "Jsaas Valuation",
  legal_form: "شركة ذات مسؤولية محدودة (مهنية)",
  cr_number: "1010625839",
  vat_number: "310625839900003",
  unified_number: "7016803038",
  cr_date: "2020/02/05",
  ceo: "أحمد سعد المالكي",
  ceo_id: "1017487701",
  website: "www.jsaas-valuation.com",
  email: "care@jsaas-valuation.com",
  phone: "920015029",
  mobile: "966500668089",
  address: "السعودية — الرياض — حي الياسمين — طريق الثمامة",
  bank: { name: "مصرف الراجحي", iban: "SA7080000611608010112580" },
  branches: [
    {
      name: "تقييم العقارات",
      name_en: "Real Estate Valuation",
      license: "1210001217",
      fellowship: "1210001217",
      label: "ترخيص وعضوية زمالة",
      expiry: "2026-12-31",
    },
    {
      name: "تقييم الآلات والمعدات",
      name_en: "Machinery & Equipment Valuation",
      license: "4114000015",
      fellowship: "4210000041",
      label: "ترخيص + عضوية زمالة",
      expiry: "2026-12-31",
    },
  ],
  authority: "الهيئة السعودية للمقيمين المعتمدين (تقييم)",
  accreditations: [
    "عضوية الزمالة — الهيئة السعودية للمقيمين المعتمدين (TAQEEM)",
    "اعتماد الجمعية الأمريكية للمقيّمين (ASA) — USPAP",
    "التوافق مع معايير التقييم الدولية (IVS)",
  ],
  services: [
    "تقييم العقارات",
    "تقييم الآلات والمعدات",
    "نزع الملكية والتعويضات",
  ],
  vision: "نصنع للأصل قيمة",
  mission: "نقيّم الأصول بعِلم وفنْ",
  values: "الكفاءة والاستقلالية",
  achievements: {
    total_assets_valued: "111,641+ أصل",
    total_value: "1.185+ مليار ريال سعودي",
  },
  strengths: [
    "الثقة — شركة سعودية مرخصة بسجل إنجازات معتمدة",
    "المرونة — نتعامل مع المشاريع الصغيرة والكبيرة بنفس الكفاءة",
    "القيمة مقابل التكلفة — جودة بأسعار منطقية وتنفيذ سريع",
    "الالتزام والتنظيم — إدارة رقمية وجدولة تضمن التسليم في الوقت",
  ],
  permitted_assets: ["عقارات", "أراضي", "مباني", "فلل", "شقق", "آلات", "معدات", "مركبات", "أثاث", "أجهزة"],
  excluded_scope: "تقييم المنشآت الاقتصادية (Business Valuation) — يتطلب ترخيصاً مستقلاً",
  valuation_purposes: [
    "التأمين", "الرهن", "التمويل", "البيع والشراء",
    "الاندماج والاستحواذ", "التصفية", "التركات ونزع الملكية",
    "تقدير القيمة الإيجارية", "تحليل القيمة المتبقية", "الحسابات والمراجعة",
  ],
};

// ── Professional Knowledge References ──
export const KB_INTANGIBLE: KnowledgeRef = {
  source: "IVS 210 — Intangible Assets",
  article: "الفقرة 210.1",
  principle: "الأصول غير الملموسة تتطلب ترخيصاً مستقلاً في فرع تقييم المنشآت الاقتصادية (Business Valuation) ولا تدخل ضمن ترخيص العقار أو الآلات والمعدات",
};

export const KB_CONTRACTUAL: KnowledgeRef = {
  source: "IVS 105 — Valuation Approaches",
  article: "الفقرة 105.3",
  principle: "الحقوق التعاقدية ليست أصولاً ملموسة قابلة للتقييم ضمن نطاق ترخيص العقار والآلات",
};

export const KB_FINANCIAL: KnowledgeRef = {
  source: "IVS 500 — Financial Instruments",
  article: "الفقرة 500.1",
  principle: "الأدوات المالية تخضع لمعايير تقييم مختلفة وتتطلب ترخيصاً في فرع تقييم المنشآت الاقتصادية",
};

export const KB_LICENSE: KnowledgeRef = {
  source: `نظام المقيمين المعتمدين — ${COMPANY.authority}`,
  article: "المادة 5 — فروع التقييم",
  principle: "يُرخص للمقيم في فروع محددة: العقار، الآلات والمعدات، المنشآت الاقتصادية، أو أضرار المركبات. لا يجوز ممارسة التقييم في فرع غير مرخص فيه",
};

// ── Exclusion Rules ──
export const INTANGIBLE_RULES: { keywords: string[]; tag: string; reason: string; ref: KnowledgeRef }[] = [
  { keywords: ["intangible", "أصول غير ملموسة", "غير ملموس"], tag: "Intangible", reason: "أصل غير ملموس — خارج نطاق ترخيص العقار والآلات", ref: KB_INTANGIBLE },
  { keywords: ["goodwill", "شهرة", "شهرة محل"], tag: "Intangible", reason: "شهرة محل (Goodwill) — أصل غير ملموس يتطلب ترخيص منشآت اقتصادية", ref: KB_INTANGIBLE },
  { keywords: ["trademark", "علامة تجارية", "brand", "logo", "شعار"], tag: "Intangible", reason: "علامة تجارية — أصل غير ملموس (IVS 210)", ref: KB_INTANGIBLE },
  { keywords: ["patent", "براءة اختراع", "براءة"], tag: "Intangible", reason: "براءة اختراع — ملكية فكرية خارج نطاق الترخيص", ref: KB_INTANGIBLE },
  { keywords: ["copyright", "حقوق ملكية فكرية", "حقوق نشر"], tag: "Intangible", reason: "حقوق ملكية فكرية — تتطلب ترخيص منشآت اقتصادية", ref: KB_INTANGIBLE },
  { keywords: ["software", "software_license", "رخصة برمجية", "برنامج", "برمجيات"], tag: "Intangible", reason: "برمجيات / رخصة برمجية — أصل غير ملموس (IVS 210)", ref: KB_INTANGIBLE },
  { keywords: ["license", "ترخيص", "رخصة"], tag: "Intangible", reason: "رخصة / ترخيص — أصل غير ملموس", ref: KB_INTANGIBLE },
  { keywords: ["customer_list", "قائمة عملاء", "customer relationship"], tag: "Intangible", reason: "علاقات عملاء — أصل غير ملموس (IVS 210)", ref: KB_INTANGIBLE },
  { keywords: ["domain_name", "نطاق", "اسم نطاق"], tag: "Intangible", reason: "اسم نطاق — أصل غير ملموس رقمي", ref: KB_INTANGIBLE },
];

export const CONTRACTUAL_RULES: { keywords: string[]; tag: string; reason: string; ref: KnowledgeRef }[] = [
  { keywords: ["contract", "عقد", "اتفاقية", "agreement"], tag: "Contractual", reason: "حق تعاقدي وليس أصل ملموس (IVS 105)", ref: KB_CONTRACTUAL },
  { keywords: ["concession", "امتياز حكومي", "حق انتفاع"], tag: "Contractual", reason: "حق امتياز / انتفاع — ليس أصلاً ملموساً", ref: KB_CONTRACTUAL },
  { keywords: ["franchise", "امتياز", "حق امتياز"], tag: "Contractual", reason: "حق امتياز تجاري — ليس أصلاً ملموساً (IVS 105)", ref: KB_CONTRACTUAL },
];

export const FINANCIAL_RULES: { keywords: string[]; tag: string; reason: string; ref: KnowledgeRef }[] = [
  { keywords: ["financial_instrument", "stock", "bond", "derivative", "أسهم", "سندات", "مشتقات", "أداة مالية"], tag: "Financial", reason: "أداة مالية — تخضع لمعيار IVS 500 المستقل", ref: KB_FINANCIAL },
  { keywords: ["cryptocurrency", "عملة رقمية", "بتكوين", "crypto"], tag: "Financial", reason: "عملة رقمية — أداة مالية خارج نطاق الترخيص", ref: KB_FINANCIAL },
];

export const EXCLUSION_RULES = [...INTANGIBLE_RULES, ...CONTRACTUAL_RULES, ...FINANCIAL_RULES];

// ── Type Labels ──
export const TYPE_LABELS: Record<string, string> = {
  real_estate: "عقار",
  machinery_equipment: "آلات ومعدات",
  both: "عقار + آلات ومعدات",
  furniture: "أثاث",
  vehicle: "مركبة",
  it_equipment: "تقنية",
  medical_equipment: "طبي",
  industrial: "صناعي",
  equipment: "معدات",
  machinery: "آلات",
  office: "مكتبي",
  electrical: "كهربائي",
  hvac: "تكييف وتبريد",
  plumbing: "سباكة",
  other: "أخرى",
};
