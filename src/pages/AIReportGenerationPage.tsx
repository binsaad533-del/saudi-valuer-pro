import { useState, useRef, useCallback } from "react";
import { formatNumber } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, FileText, Wand2, CheckCircle2, Loader2, Copy, RefreshCw,
  Edit3, ChevronDown, ChevronUp, AlertCircle, Database, Layers,
  FileCheck, Download, Eye, ArrowLeft, ArrowRight, Search, Link2, Send,
  Building2, User, MapPin, ClipboardCheck, BarChart3, Scale, XCircle,
  BookOpen, Target, Landmark, Map, TrendingUp, Home, Gavel, Calculator,
  DollarSign, ShieldCheck, Award, Paperclip, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ──────────────────── Types ──────────────────── */
type PipelineStep = 0 | 1 | 2 | 3 | 4 | 5;

interface ReportDraft {
  report_title_ar?: string;
  report_title_en?: string;
  reference_number?: string;
  report_date?: string;
  sections?: Record<string, {
    title_ar?: string;
    title_en?: string;
    content_ar?: string;
    content_en?: string;
    tables?: { caption_ar?: string; headers?: string[]; rows?: string[][] }[];
  }>;
  final_value?: {
    amount?: number;
    currency?: string;
    text_ar?: string;
    text_en?: string;
    effective_date?: string;
    basis_of_value_ar?: string;
    confidence_level?: string;
  };
  metadata?: {
    standards_referenced?: string[];
    approaches_used?: string[];
    data_completeness_pct?: number;
    sections_needing_review?: string[];
    missing_data_items?: string[];
  };
}

interface AggregatedData {
  request?: any;
  client?: any;
  assignment?: any;
  subject?: any;
  inspection?: any;
  inspection_analysis?: any;
  inspection_photos?: any[];
  inspection_checklist?: any[];
  comparables?: any[];
  document_extractions?: any[];
  assumptions?: any[];
  reconciliation?: any;
  compliance_checks?: any[];
  portfolio_assets?: any[];
  valuer?: any;
  reviewer?: any;
  organization?: any;
}

const PIPELINE_STEPS = [
  { key: "data", label: "جمع البيانات", icon: Database, desc: "ربط الطلب وجمع جميع البيانات" },
  { key: "generate", label: "توليد المسودة", icon: Wand2, desc: "توليد أقسام التقرير بالذكاء الاصطناعي" },
  { key: "sections", label: "مراجعة الأقسام", icon: Layers, desc: "مراجعة وتعديل كل قسم" },
  { key: "review", label: "فحص الجودة", icon: Eye, desc: "مراجعة شاملة وتحسينات" },
  { key: "preview", label: "المعاينة", icon: FileCheck, desc: "معاينة التقرير النهائي" },
  { key: "export", label: "التصدير", icon: Download, desc: "إنشاء مسودة التقرير" },
];

const SECTION_ICONS: Record<string, LucideIcon> = {
  cover_page: FileText,
  table_of_contents: BookOpen,
  executive_summary: Sparkles,
  engagement_letter: FileCheck,
  purpose_and_intended_use: Target,
  scope_of_work: ClipboardCheck,
  property_identification: Landmark,
  property_description: Building2,
  legal_description: Gavel,
  location_analysis: Map,
  market_overview: TrendingUp,
  highest_and_best_use: Home,
  valuation_approaches: Layers,
  sales_comparison_approach: BarChart3,
  cost_approach: Calculator,
  income_approach: DollarSign,
  reconciliation: Scale,
  assumptions_and_limiting_conditions: AlertCircle,
  compliance_statement: ShieldCheck,
  valuer_certification: Award,
  appendices: Paperclip,
};

/* Section color themes: [bg class, text class, ring class] */
const SECTION_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  executive_summary:       { bg: "bg-primary/10",        text: "text-primary",        accent: "border-primary/30" },
  scope_of_work:           { bg: "bg-info/10",           text: "text-info",           accent: "border-info/30" },
  property_description:    { bg: "bg-amber-500/10",      text: "text-amber-600",      accent: "border-amber-500/30" },
  location_analysis:       { bg: "bg-emerald-500/10",    text: "text-emerald-600",    accent: "border-emerald-500/30" },
  market_overview:         { bg: "bg-cyan-500/10",       text: "text-cyan-600",       accent: "border-cyan-500/30" },
  sales_comparison_approach: { bg: "bg-violet-500/10",   text: "text-violet-600",     accent: "border-violet-500/30" },
  cost_approach:           { bg: "bg-orange-500/10",     text: "text-orange-600",     accent: "border-orange-500/30" },
  reconciliation:          { bg: "bg-rose-500/10",       text: "text-rose-600",       accent: "border-rose-500/30" },
  assumptions_and_limiting_conditions: { bg: "bg-yellow-500/10", text: "text-yellow-600", accent: "border-yellow-500/30" },
  compliance_statement:    { bg: "bg-teal-500/10",       text: "text-teal-600",       accent: "border-teal-500/30" },
  valuer_certification:    { bg: "bg-indigo-500/10",     text: "text-indigo-600",     accent: "border-indigo-500/30" },
  cover_page:              { bg: "bg-slate-500/10",      text: "text-slate-600",      accent: "border-slate-500/30" },
  table_of_contents:       { bg: "bg-gray-500/10",       text: "text-gray-600",       accent: "border-gray-500/30" },
  engagement_letter:       { bg: "bg-sky-500/10",        text: "text-sky-600",        accent: "border-sky-500/30" },
  purpose_and_intended_use:{ bg: "bg-fuchsia-500/10",    text: "text-fuchsia-600",    accent: "border-fuchsia-500/30" },
  property_identification: { bg: "bg-lime-500/10",       text: "text-lime-600",       accent: "border-lime-500/30" },
  legal_description:       { bg: "bg-stone-500/10",      text: "text-stone-600",      accent: "border-stone-500/30" },
  highest_and_best_use:    { bg: "bg-pink-500/10",       text: "text-pink-600",       accent: "border-pink-500/30" },
  valuation_approaches:    { bg: "bg-blue-500/10",       text: "text-blue-600",       accent: "border-blue-500/30" },
  income_approach:         { bg: "bg-green-500/10",      text: "text-green-600",      accent: "border-green-500/30" },
  appendices:              { bg: "bg-neutral-500/10",     text: "text-neutral-600",    accent: "border-neutral-500/30" },
};

const DEFAULT_SECTION_COLOR = { bg: "bg-primary/10", text: "text-primary", accent: "border-primary/30" };


const DATA_CATEGORIES = [
  { key: "request", label: "بيانات الطلب", icon: FileText },
  { key: "client", label: "بيانات العميل", icon: User },
  { key: "subject", label: "وصف العقار", icon: Building2 },
  { key: "inspection", label: "المعاينة الميدانية", icon: ClipboardCheck },
  { key: "comparables", label: "المقارنات السوقية", icon: BarChart3 },
  { key: "reconciliation", label: "التسوية والقيمة", icon: Scale },
];

const MOCK_AGGREGATED_DATA: AggregatedData = {
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

const MOCK_REPORT_DRAFT: ReportDraft = {
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
      content_ar: `## ملخص التقييم

تم إجراء تقييم عقاري شامل لفيلا سكنية تقع في حي النرجس بمدينة الرياض، بناءً على طلب العميل **أحمد المالكي** لغرض **التمويل البنكي**.

### بيانات العقار الأساسية
- **النوع:** فيلا سكنية مكونة من دورين وملحق علوي
- **المساحة:** 625 م² (أرض) / 480 م² (بناء)
- **الموقع:** شارع الأمير سلطان، حي النرجس، الرياض
- **سنة البناء:** 2021
- **الحالة:** ممتازة - تشطيب سوبر ديلوكس

### القيمة المستنتجة
بناءً على تحليل السوق واستخدام أسلوب المقارنة بالمبيعات كمنهج رئيسي وأسلوب التكلفة كمنهج مساند، تم التوصل إلى أن **القيمة السوقية العادلة** للعقار بتاريخ 28 مارس 2026 هي:

> **2,850,000 ريال سعودي** (مليونان وثمانمائة وخمسون ألف ريال سعودي)

تم الاعتماد على 4 مقارنات سوقية من نفس الحي خلال الأشهر الستة الأخيرة، مما يعزز موثوقية النتيجة.`,
    },
    scope_of_work: {
      title_ar: "نطاق العمل",
      content_ar: `## نطاق العمل والمهمة

### تعريف المهمة
تم تكليفنا بإعداد تقرير تقييم عقاري شامل للعقار الموصوف أدناه وفقاً للمعايير الدولية للتقييم (IVS 2024) ومعايير الهيئة السعودية للمقيمين المعتمدين (تقييم).

### أساس القيمة
- **القيمة السوقية** وفقاً لتعريف المعايير الدولية للتقييم
- تاريخ التقييم: 28 مارس 2026

### منهجيات التقييم المستخدمة
1. **أسلوب المقارنة بالمبيعات** (المنهج الرئيسي): تحليل مقارن مع صفقات مماثلة في حي النرجس
2. **أسلوب التكلفة** (المنهج المساند): تقدير تكلفة إعادة الإنشاء مع خصم الإهلاك

### مصادر البيانات
- بيانات صفقات وزارة العدل
- قاعدة بيانات الشركة للمقارنات السوقية
- المعاينة الميدانية المباشرة
- بيانات السوق العقاري من الهيئة العامة للعقار`,
    },
    property_description: {
      title_ar: "وصف العقار",
      content_ar: `## الوصف التفصيلي للعقار

### المواصفات العامة
| البند | التفاصيل |
|-------|---------|
| نوع العقار | فيلا سكنية |
| مساحة الأرض | 625 م² |
| مساحة البناء | 480 م² |
| عدد الأدوار | دوران وملحق علوي |
| سنة البناء | 2021 |
| مستوى التشطيب | سوبر ديلوكس |

### المكونات الداخلية
- 5 غرف نوم رئيسية مع حمامات خاصة (إن سويت)
- 6 دورات مياه إجمالاً
- صالة استقبال واسعة بمساحة 45 م²
- مجلس رجال مستقل بمدخل خاص
- مطبخ مجهز بالكامل بأجهزة مدمجة
- غرفة خادمة مع حمام مستقل
- غرفة غسيل منفصلة

### المكونات الخارجية
- موقف سيارتين مغطى بمظلة حديدية
- حديقة خلفية مُنسّقة بمساحة 80 م²
- سور خارجي بارتفاع 3 أمتار مع بوابة كهربائية
- إضاءة خارجية للحديقة والممرات`,
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
      content_ar: `## تحليل الموقع والبيئة المحيطة

### الموقع الجغرافي
يقع العقار في **حي النرجس** شمال مدينة الرياض، وهو من الأحياء السكنية الراقية التي شهدت نمواً عمرانياً ملحوظاً خلال السنوات الخمس الأخيرة.

### إحداثيات الموقع
- خط العرض: 24.8234
- خط الطول: 46.6721

### المميزات الموقعية
- **القرب من الطرق الرئيسية:** يبعد 500 متر عن طريق الملك سلمان و1.2 كم عن طريق أنس بن مالك
- **الخدمات التعليمية:** مدارس أهلية وحكومية ضمن نطاق 1 كم
- **الخدمات الصحية:** مراكز طبية ومستشفيات ضمن نطاق 2 كم
- **الخدمات التجارية:** مراكز تسوق ومحلات تجارية متنوعة
- **المساجد:** مسجد الحي ضمن مسافة مشي (200 متر)

### تقييم البيئة المحيطة
الحي يتميز بتخطيط عمراني منظم وشوارع عريضة (عرض 20-30 متر) مع أرصفة وإنارة حديثة. المنطقة هادئة وآمنة مع كثافة سكانية متوسطة، مما يجعلها مثالية للسكن العائلي.`,
    },
    market_overview: {
      title_ar: "نظرة عامة على السوق",
      content_ar: `## تحليل السوق العقاري

### السوق العقاري في الرياض - الربع الأول 2026
يشهد السوق العقاري السكني في شمال الرياض استقراراً نسبياً مع ميل طفيف نحو الارتفاع بنسبة 3-5% سنوياً، مدفوعاً بالطلب المتزايد على الفلل السكنية في الأحياء الراقية.

### مؤشرات السوق الرئيسية
- **متوسط سعر المتر المربع للفلل في حي النرجس:** 4,400 - 4,700 ر.س/م²
- **حجم الصفقات خلال 6 أشهر:** 47 صفقة فلل في حي النرجس
- **اتجاه الأسعار:** ارتفاع تدريجي بنسبة 4.2% خلال 12 شهراً
- **متوسط فترة البيع:** 45-60 يوماً

### العوامل المؤثرة على السوق
1. **إيجابية:** مشاريع البنية التحتية الجديدة وقرب المنطقة من محور التنمية الشمالي
2. **إيجابية:** ارتفاع الطلب على الفلل ذات التشطيبات العالية
3. **محايدة:** استقرار أسعار الفائدة على التمويل العقاري
4. **سلبية محدودة:** زيادة المعروض من المشاريع الجديدة قيد الإنشاء`,
    },
    sales_comparison_approach: {
      title_ar: "أسلوب المقارنة بالمبيعات",
      content_ar: `## تحليل المقارنة بالمبيعات

### المقارنات السوقية المختارة
تم اختيار 4 مقارنات من صفقات فعلية في **حي النرجس** خلال الأشهر الستة الأخيرة، وهي الأقرب تشابهاً مع العقار موضوع التقييم من حيث النوع والمساحة والموقع.

### التعديلات المطبقة
تم إجراء تعديلات على المقارنات لمراعاة الفروقات في:
- المساحة (تعديل نسبي)
- العمر والحالة (تعديل نسبي)
- مستوى التشطيب (تعديل مبلغي)
- الموقع الدقيق ضمن الحي (تعديل نسبي)

### نتيجة التحليل المقارن
بعد إجراء التعديلات اللازمة، تراوحت القيم المعدلة بين **2,720,000** و **2,980,000** ريال سعودي، بمتوسط مرجح **2,850,000** ريال سعودي.

يُعتبر هذا النطاق ضيقاً (انحراف ±4.5%) مما يشير إلى **موثوقية عالية** في النتيجة.`,
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
      content_ar: `## تحليل أسلوب التكلفة (المنهج المساند)

### منهجية الحساب
تم استخدام أسلوب التكلفة كمنهج مساند للتحقق من معقولية النتيجة المستخلصة من أسلوب المقارنة.

### تفاصيل الحساب

**1. قيمة الأرض:**
- مساحة الأرض: 625 م²
- سعر المتر المربع للأراضي في حي النرجس: 3,200 ر.س/م²
- قيمة الأرض = 625 × 3,200 = **2,000,000 ر.س**

**2. تكلفة إعادة الإنشاء:**
- مساحة البناء: 480 م²
- تكلفة البناء (سوبر ديلوكس): 2,800 ر.س/م²
- تكلفة الإنشاء الجديدة = 480 × 2,800 = **1,344,000 ر.س**

**3. الإهلاك المتراكم:**
- عمر المبنى: 5 سنوات
- العمر الافتراضي المقدر: 50 سنة
- نسبة الإهلاك الفعلي: 8% (مع مراعاة الحالة الممتازة)
- قيمة الإهلاك = 1,344,000 × 8% = **107,520 ر.س**

**4. القيمة بأسلوب التكلفة:**
- 2,000,000 + 1,344,000 - 107,520 = **3,236,480 ر.س**

### ملاحظة
القيمة بأسلوب التكلفة أعلى من قيمة المقارنة بنسبة 13.5%، وهو أمر طبيعي نظراً لأن أسلوب التكلفة لا يعكس بالضرورة ديناميكيات العرض والطلب في السوق. لذلك تم اعتماد أسلوب المقارنة كأساس رئيسي.`,
    },
    reconciliation: {
      title_ar: "التسوية واستنتاج القيمة",
      content_ar: `## التسوية واستنتاج القيمة النهائية

### ملخص نتائج المنهجيات
| المنهجية | القيمة المستنتجة | الوزن الترجيحي |
|----------|-----------------|---------------|
| أسلوب المقارنة بالمبيعات | 2,850,000 ر.س | 85% |
| أسلوب التكلفة | 3,236,480 ر.س | 15% |

### مبررات الترجيح
- **أسلوب المقارنة (85%):** يُعتبر الأكثر ملاءمة لهذا النوع من العقارات السكنية نظراً لتوفر مقارنات كافية ومتجانسة من نفس الحي وخلال فترة زمنية قريبة.
- **أسلوب التكلفة (15%):** يُستخدم كمرجع تأكيدي فقط، حيث أن السوق يوفر بيانات مقارنة كافية.

### القيمة النهائية المستنتجة
بعد الترجيح والتسوية، وبناءً على التحليل الشامل للسوق والعقار:

> **القيمة السوقية العادلة = 2,850,000 ريال سعودي**
> (مليونان وثمانمائة وخمسون ألف ريال سعودي)

### مستوى الثقة
**عالٍ** - بناءً على توفر 4 مقارنات من نفس الحي بنطاق سعري ضيق وبيانات سوقية حديثة.`,
    },
    assumptions_and_limiting_conditions: {
      title_ar: "الافتراضات والقيود",
      content_ar: `## الافتراضات والشروط المقيدة

### الافتراضات العامة
1. أن جميع المعلومات المقدمة من العميل والجهات الرسمية صحيحة ودقيقة
2. أن العقار خالٍ من أي رهونات أو قيود لم يُفصح عنها
3. أن الصك صادر بشكل نظامي ومطابق للعقار على الطبيعة
4. أن التصنيف النظامي للعقار (سكني) سارٍ ولن يتغير في المدى المنظور
5. أن العقار مطابق لأنظمة البناء واشتراطات البلدية

### الشروط المقيدة
1. هذا التقرير مُعد حصرياً لغرض **التمويل البنكي** ولا يجوز استخدامه لأغراض أخرى
2. القيمة المقدرة صالحة بتاريخ التقييم فقط وقد تتغير بتغير ظروف السوق
3. لم يتم إجراء فحص إنشائي متخصص للعقار
4. المقيّم غير مسؤول عن أي عيوب خفية لم تظهر أثناء المعاينة
5. يجب الرجوع للمقيّم في حال مرور أكثر من 90 يوماً على تاريخ التقييم`,
    },
    compliance_statement: {
      title_ar: "بيان الامتثال",
      content_ar: `## بيان الامتثال والتوافق

### الامتثال للمعايير
يشهد المقيّم الموقّع أدناه بأن هذا التقرير أُعد وفقاً لـ:
- **المعايير الدولية للتقييم (IVS 2024)** الصادرة عن مجلس معايير التقييم الدولي
- **معايير وأخلاقيات مهنة التقييم** الصادرة عن الهيئة السعودية للمقيمين المعتمدين (تقييم)
- **نظام المقيمين المعتمدين** الصادر بالمرسوم الملكي رقم (م/43)
- **اللائحة التنفيذية** لنظام المقيمين المعتمدين

### إقرارات المقيّم
1. ليس للمقيّم أي مصلحة حالية أو مستقبلية في العقار موضوع التقييم
2. أتعاب التقييم غير مرتبطة بالقيمة المقدرة أو بنتيجة التقييم
3. تمت المعاينة الميدانية شخصياً من قبل المقيّم
4. لم يتم الاستعانة بأي طرف خارجي في إعداد هذا التقرير دون الإفصاح عن ذلك
5. المقيّم يمتلك الخبرة والكفاءة اللازمة لتقييم هذا النوع من العقارات`,
    },
    valuer_certification: {
      title_ar: "شهادة المقيّم",
      content_ar: `## شهادة وتوقيع المقيّم

### بيانات المقيّم المعتمد
- **الاسم:** أحمد بن سعد المالكي
- **رقم العضوية في تقييم:** 1210000XXX
- **عضوية RICS:** RICS-12345
- **التخصص:** تقييم العقارات
- **سنوات الخبرة:** 12 سنة

### بيانات المراجع
- **الاسم:** أواب المالكي
- **الصفة:** مدير إدارة التقييم

### بيانات المنشأة
- **الاسم:** المالكي والشركاء للتقييم العقاري
- **رقم الترخيص:** 1210000001
- **رقم السجل التجاري:** 1010XXXXXX

### التاريخ والتوقيع
- تاريخ إعداد التقرير: 28 مارس 2026
- تاريخ التقييم الفعلي: 28 مارس 2026

---
*هذا التقرير مُعد وموقّع إلكترونياً ويحمل قوة التقرير الورقي الموقّع.*`,
    },
  },
};

/* ──────────────────── Streaming helper for review ──────────────────── */
async function streamReportContent(
  params: { mode: string; existingText?: string; context: Record<string, any> },
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report-content`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "خطأ غير معروف" }));
    onError(err.error || "خطأ في التوليد");
    return;
  }

  if (!resp.body) { onError("لا يوجد استجابة"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  onDone();
}

/* ──────────────────── Main Component ──────────────────── */
export default function AIReportGenerationPage({ embedded }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRequestId = searchParams.get("request_id") || "";

  const [step, setStep] = useState<PipelineStep>(0);
  const [requestId, setRequestId] = useState(initialRequestId);
  const [stepErrors, setStepErrors] = useState<Record<number, string | null>>({});

  // Data collection state
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [editedSections, setEditedSections] = useState<Set<string>>(new Set());
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [sectionConfidence, setSectionConfidence] = useState<Record<string, number>>({});

  // Review state
  const [reviewOutput, setReviewOutput] = useState("");
  const reviewRef = useRef("");
  const [isReviewing, setIsReviewing] = useState(false);

  // Helper to determine step status
  const getStepStatus = (idx: number): "idle" | "loading" | "done" | "error" => {
    if (stepErrors[idx]) return "error";
    if (idx < step) return "done";
    if (idx === step) {
      if (idx === 0 && isLoadingData) return "loading";
      if (idx === 1 && isGenerating) return "loading";
      if (idx === 3 && isReviewing) return "loading";
      return "idle";
    }
    return "idle";
  };

  /* ─── Step 0: Collect Data ─── */
  const handleCollectData = useCallback(async () => {
    if (!requestId.trim()) {
      toast.error("يرجى إدخال معرّف الطلب");
      return;
    }
    setIsLoadingData(true);
    setDataError(null);
    setStepErrors(prev => ({ ...prev, 0: null }));

    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { request_id: requestId.trim(), mode: "collect_data" },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setAggregatedData(data);
      toast.success("تم جمع جميع البيانات المرتبطة بالطلب");
    } catch (err: any) {
      const msg = err.message || "خطأ في جمع البيانات";
      setDataError(msg);
      setStepErrors(prev => ({ ...prev, 0: msg }));
      toast.error(msg);
    } finally {
      setIsLoadingData(false);
    }
  }, [requestId]);

  /* ─── Step 1: Generate Draft ─── */
  const handleGenerateDraft = useCallback(async () => {
    setIsGenerating(true);
    setStep(1);
    setStepErrors(prev => ({ ...prev, 1: null }));

    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { request_id: requestId.trim(), mode: "generate_draft" },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.success && data.report_draft) {
        setReportDraft(data.report_draft);
        // Set initial confidence for all generated sections
        if (data.report_draft.sections) {
          const initialConfidence: Record<string, number> = {};
          Object.entries(data.report_draft.sections).forEach(([key, sec]: [string, any]) => {
            initialConfidence[key] = Math.min(95, Math.max(55, Math.round((sec.content_ar?.length || 0) / 20)));
          });
          setSectionConfidence(initialConfidence);
        }
        setStep(2);
        toast.success("تم توليد مسودة التقرير بنجاح");
      } else if (data?.raw_content) {
        toast.warning("تم التوليد لكن لم يتم تحليل الاستجابة كـ JSON");
        setStep(2);
      } else {
        throw new Error("لم يتم توليد التقرير");
      }
    } catch (err: any) {
      const msg = err.message || "خطأ في توليد التقرير";
      setStepErrors(prev => ({ ...prev, 1: msg }));
      setStep(0);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [requestId]);

  /* ─── Handlers ─── */
  const handleSaveEdit = (sectionKey: string) => {
    if (reportDraft?.sections?.[sectionKey]) {
      setReportDraft({
        ...reportDraft,
        sections: {
          ...reportDraft.sections,
          [sectionKey]: {
            ...reportDraft.sections[sectionKey],
            content_ar: editBuffer,
          },
        },
      });
    }
    setEditedSections(prev => new Set(prev).add(sectionKey));
    setEditingSection(null);
    setEditBuffer("");
    toast.success("تم حفظ التعديل");
  };

  /* ─── Regenerate single section ─── */
  const handleRegenerateSection = useCallback(async (sectionKey: string) => {
    if (!aggregatedData || !reportDraft) return;
    setRegeneratingSection(sectionKey);
    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { request_id: requestId.trim(), mode: "generate_draft", sections: [sectionKey] },
      });
      if (error) throw new Error(error.message);
      if (data?.report_draft?.sections?.[sectionKey]) {
        const newSec = data.report_draft.sections[sectionKey];
        setReportDraft(prev => prev ? {
          ...prev,
          sections: { ...prev.sections, [sectionKey]: newSec },
        } : prev);
        setEditedSections(prev => { const s = new Set(prev); s.delete(sectionKey); return s; });
        // Estimate confidence from content length ratio
        const confidence = Math.min(95, Math.max(60, Math.round((newSec.content_ar?.length || 0) / 20)));
        setSectionConfidence(prev => ({ ...prev, [sectionKey]: confidence }));
        toast.success(`تم إعادة توليد قسم "${newSec.title_ar || sectionKey}"`);
      } else {
        throw new Error("لم يتم توليد القسم");
      }
    } catch (err: any) {
      toast.error(err.message || "خطأ في إعادة التوليد");
    } finally {
      setRegeneratingSection(null);
    }
  }, [aggregatedData, reportDraft, requestId]);

  const handleReviewAll = useCallback(() => {
    if (!reportDraft?.sections) return;
    setIsReviewing(true);
    setReviewOutput("");
    reviewRef.current = "";
    setStep(3);
    setStepErrors(prev => ({ ...prev, 3: null }));

    const allText = Object.entries(reportDraft.sections)
      .map(([key, sec]) => `## ${sec.title_ar || key}\n${sec.content_ar || ""}`)
      .join("\n\n");

    const context = {
      assetType: aggregatedData?.request?.property_type || "عقاري",
      assetDescription: aggregatedData?.request?.property_description_ar || "",
      assetCity: aggregatedData?.request?.property_city_ar || "",
    };

    streamReportContent(
      { mode: "review", existingText: allText, context },
      (delta) => { reviewRef.current += delta; setReviewOutput(reviewRef.current); },
      () => { setIsReviewing(false); toast.success("تم فحص الجودة"); },
      (err) => { setIsReviewing(false); setStepErrors(prev => ({ ...prev, 3: err })); toast.error(err); }
    );
  }, [reportDraft, aggregatedData]);

  const handleCreateDraft = () => {
    toast.success("تم إنشاء مسودة التقرير بنجاح");
    navigate("/reports/generate");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const sectionEntries = reportDraft?.sections ? Object.entries(reportDraft.sections) : [];
  const sectionCount = sectionEntries.length;

  // Data completeness indicators
  const dataChecks = aggregatedData ? [
    { label: "بيانات الطلب", ok: !!aggregatedData.request?.id },
    { label: "بيانات العميل", ok: !!aggregatedData.client?.profile || !!aggregatedData.client?.record },
    { label: "المهمة", ok: !!aggregatedData.assignment?.id },
    { label: "وصف العقار", ok: !!aggregatedData.subject },
    { label: "المعاينة", ok: !!aggregatedData.inspection?.id },
    { label: "تحليل المعاينة", ok: !!aggregatedData.inspection_analysis },
    { label: "المقارنات", ok: (aggregatedData.comparables?.length || 0) > 0 },
    { label: "المستندات", ok: (aggregatedData.document_extractions?.length || 0) > 0 },
    { label: "التسوية", ok: !!aggregatedData.reconciliation },
    { label: "المنشأة", ok: !!aggregatedData.organization },
  ] : [];

  const completeness = dataChecks.length > 0
    ? Math.round((dataChecks.filter(d => d.ok).length / dataChecks.length) * 100)
    : 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">نظام توليد التقارير الآلي</h1>
            <p className="text-sm text-muted-foreground">رقيم يُنشئ مسودة تقرير تقييم كاملة وفق IVS 2025 ومعايير تقييم</p>
          </div>
        </div>
        {aggregatedData?.assignment?.reference_number && (
          <Badge variant="outline" className="gap-1 text-xs">
            <FileText className="w-3 h-3" />
            {aggregatedData.assignment.reference_number}
          </Badge>
        )}
      </div>

      {/* ─── Pipeline Stepper ─── */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            {PIPELINE_STEPS.map((ps, idx) => {
              const status = getStepStatus(idx);
              const done = status === "done";
              const active = idx === step;
              const hasError = status === "error";
              const isLoading = status === "loading";
              const Icon = ps.icon;
              return (
                <div key={ps.key} className="flex items-center flex-1 last:flex-none">
                  <div
                    className="flex flex-col items-center gap-1 cursor-pointer group relative"
                    onClick={() => { if (done || hasError) setStep(idx as PipelineStep); }}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      hasError ? "bg-destructive/10 border-destructive text-destructive shadow-md shadow-destructive/20"
                        : done ? "bg-primary border-primary text-primary-foreground"
                        : active ? "border-primary text-primary bg-primary/10 shadow-md shadow-primary/20"
                        : "border-muted-foreground/20 text-muted-foreground/40 bg-muted/20"
                    }`}>
                      {hasError ? <XCircle className="w-4.5 h-4.5" />
                        : done ? <CheckCircle2 className="w-4.5 h-4.5" />
                        : isLoading ? <Loader2 className="w-4.5 h-4.5 animate-spin" />
                        : <Icon className="w-4.5 h-4.5" />}
                    </div>
                    <span className={`text-[10px] font-medium whitespace-nowrap ${
                      hasError ? "text-destructive font-bold"
                        : done ? "text-primary"
                        : active ? "text-primary font-bold"
                        : "text-muted-foreground/40"
                    }`}>
                      {ps.label}
                    </span>
                    {/* Status label */}
                    <span className={`text-[8px] font-medium ${
                      hasError ? "text-destructive"
                        : isLoading ? "text-primary animate-pulse"
                        : done ? "text-primary/60"
                        : "text-transparent"
                    }`}>
                      {hasError ? "خطأ" : isLoading ? "جارٍ..." : done ? "مكتمل" : "—"}
                    </span>
                    {/* Error tooltip */}
                    {hasError && stepErrors[idx] && (
                      <div className="absolute top-full mt-1 z-10 hidden group-hover:block bg-destructive text-destructive-foreground text-[9px] px-2 py-1 rounded-md shadow-lg max-w-[180px] text-center whitespace-normal">
                        {stepErrors[idx]}
                      </div>
                    )}
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div className="flex-1 mx-1.5">
                      <div className={`h-0.5 rounded-full transition-all ${
                        hasError ? "bg-destructive/40"
                          : idx < step ? "bg-primary"
                          : "bg-muted-foreground/15"
                      }`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════ */}
      {/* Step 0: Data Collection via request_id     */}
      {/* ═══════════════════════════════════════════ */}
      {step === 0 && (
        <div className="space-y-4">
          {/* Request ID Input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                ربط الطلب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">معرّف الطلب (Request ID)</Label>
                  <Input
                    value={requestId}
                    onChange={(e) => setRequestId(e.target.value)}
                    placeholder="أدخل معرّف الطلب (UUID)..."
                    className="text-sm font-mono"
                    dir="ltr"
                  />
                </div>
                <Button
                  onClick={handleCollectData}
                  disabled={isLoadingData || !requestId.trim()}
                  className="gap-2"
                >
                  {isLoadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  جمع البيانات
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRequestId("mock-demo-001");
                    setAggregatedData(MOCK_AGGREGATED_DATA);
                    setReportDraft(MOCK_REPORT_DRAFT);
                    const initConf: Record<string, number> = {};
                    Object.entries(MOCK_REPORT_DRAFT.sections || {}).forEach(([k, s]: [string, any]) => {
                      initConf[k] = Math.min(95, Math.max(70, Math.round((s.content_ar?.length || 0) / 25)));
                    });
                    setSectionConfidence(initConf);
                    setStep(2);
                    toast.success("تم تحميل البيانات التجريبية مع مسودة التقرير");
                  }}
                  className="gap-2 text-xs"
                >
                  <Database className="w-4 h-4" /> بيانات تجريبية
                </Button>
              </div>

              {dataError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {dataError}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aggregated Data Summary */}
          {aggregatedData && (
            <>
              {/* Completeness bar */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">اكتمال البيانات</span>
                    <Badge variant={completeness >= 80 ? "default" : completeness >= 50 ? "secondary" : "destructive"} className="text-xs">
                      {completeness}%
                    </Badge>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${completeness >= 80 ? "bg-primary" : completeness >= 50 ? "bg-yellow-500" : "bg-destructive"}`}
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {dataChecks.map((check) => (
                      <Badge key={check.label} variant={check.ok ? "default" : "outline"} className={`text-[10px] gap-1 ${check.ok ? "" : "text-muted-foreground"}`}>
                        {check.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {check.label}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Data Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Request Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      بيانات الطلب
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    <InfoRow label="النوع" value={aggregatedData.request?.property_type} />
                    <InfoRow label="الغرض" value={aggregatedData.request?.purpose} />
                    <InfoRow label="أساس القيمة" value={aggregatedData.request?.basis_of_value} />
                    <InfoRow label="الحالة" value={aggregatedData.request?.status} />
                    <InfoRow label="مساحة الأرض" value={aggregatedData.request?.land_area ? `${aggregatedData.request.land_area} م²` : null} />
                    <InfoRow label="مساحة البناء" value={aggregatedData.request?.building_area ? `${aggregatedData.request.building_area} م²` : null} />
                  </CardContent>
                </Card>

                {/* Client Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      بيانات العميل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    <InfoRow label="الاسم" value={aggregatedData.client?.record?.name_ar || aggregatedData.client?.profile?.full_name_ar} />
                    <InfoRow label="النوع" value={aggregatedData.client?.record?.client_type} />
                    <InfoRow label="الهوية" value={aggregatedData.client?.record?.id_number} />
                    <InfoRow label="الهاتف" value={aggregatedData.client?.record?.phone || aggregatedData.client?.profile?.phone} />
                    <InfoRow label="البريد" value={aggregatedData.client?.record?.email || aggregatedData.client?.profile?.email} />
                  </CardContent>
                </Card>

                {/* Property Subject */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      العقار
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    {aggregatedData.subject ? (
                      <>
                        <InfoRow label="الصك" value={aggregatedData.subject.title_deed_number} />
                        <InfoRow label="المدينة" value={aggregatedData.subject.city_ar} />
                        <InfoRow label="الحي" value={aggregatedData.subject.district_ar} />
                        <InfoRow label="المساحة" value={aggregatedData.subject.land_area ? `${aggregatedData.subject.land_area} م²` : null} />
                        <InfoRow label="الاستخدام" value={aggregatedData.subject.current_use_ar} />
                        <InfoRow label="الحالة" value={aggregatedData.subject.building_condition} />
                      </>
                    ) : (
                      <p className="text-muted-foreground">لا توجد بيانات عقار مسجّلة</p>
                    )}
                  </CardContent>
                </Card>

                {/* Inspection */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-primary" />
                      المعاينة الميدانية
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    {aggregatedData.inspection ? (
                      <>
                        <InfoRow label="التاريخ" value={aggregatedData.inspection.inspection_date} />
                        <InfoRow label="الحالة" value={aggregatedData.inspection.status} />
                        <InfoRow label="GPS" value={aggregatedData.inspection.gps_verified ? "✓ تم التحقق" : "✗"} />
                        {aggregatedData.inspection_analysis && (
                          <>
                            <InfoRow label="تقييم الحالة" value={aggregatedData.inspection_analysis.condition_rating} />
                            <InfoRow label="درجة الجودة" value={aggregatedData.inspection_analysis.quality_score?.toString()} />
                            <InfoRow label="الإهلاك المادي" value={aggregatedData.inspection_analysis.physical_depreciation_pct ? `${aggregatedData.inspection_analysis.physical_depreciation_pct}%` : null} />
                          </>
                        )}
                        <InfoRow label="الصور" value={`${aggregatedData.inspection_photos?.length || 0} صورة`} />
                      </>
                    ) : (
                      <p className="text-muted-foreground">لم تتم المعاينة بعد</p>
                    )}
                  </CardContent>
                </Card>

                {/* Comparables */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      المقارنات ({aggregatedData.comparables?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1.5">
                    {aggregatedData.comparables?.length ? (
                      aggregatedData.comparables.slice(0, 4).map((comp: any, i: number) => (
                        <div key={i} className="flex justify-between p-1.5 rounded bg-muted/40">
                          <span>{comp.comparable?.district_ar || comp.comparable?.city_ar || `مقارنة ${i + 1}`}</span>
                          <span className="font-mono text-primary">
                            {comp.comparable?.price ? `${formatNumber(Number(comp.comparable.price))} ر.س` : "—"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">لا توجد مقارنات مسجّلة</p>
                    )}
                  </CardContent>
                </Card>

                {/* Reconciliation & Organization */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Scale className="w-4 h-4 text-primary" />
                      التسوية والمنشأة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    {aggregatedData.reconciliation ? (
                      <>
                        <InfoRow label="القيمة النهائية" value={`${formatNumber(Number(aggregatedData.reconciliation.final_value))} ر.س`} />
                        <InfoRow label="مستوى الثقة" value={aggregatedData.reconciliation.confidence_level} />
                      </>
                    ) : (
                      <InfoRow label="التسوية" value="لم تتم بعد" />
                    )}
                    <Separator className="my-1.5" />
                    <InfoRow label="المنشأة" value={aggregatedData.organization?.name_ar} />
                    <InfoRow label="المقيّم" value={aggregatedData.valuer?.full_name_ar} />
                    <InfoRow label="المراجع" value={aggregatedData.reviewer?.full_name_ar} />
                  </CardContent>
                </Card>
              </div>

              {/* Generate Button */}
              <div className="flex justify-center pt-2">
                <Button size="lg" className="gap-2 min-w-[280px]" onClick={handleGenerateDraft}>
                  <Wand2 className="w-5 h-5" />
                  توليد مسودة التقرير الكاملة
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Step 1: Generating                         */}
      {/* ═══════════════════════════════════════════ */}
      {step === 1 && (
        <Card className="border-primary/20">
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-foreground">جارٍ توليد التقرير...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                رقيم يحلل جميع البيانات ويكتب 20+ قسماً وفقاً لمعايير IVS 2025 وتقييم
              </p>
              <p className="text-xs text-muted-foreground mt-2">قد يستغرق هذا 30-60 ثانية</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Step 2: Section Review                     */}
      {/* ═══════════════════════════════════════════ */}
      {step === 2 && reportDraft && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              أقسام التقرير المُولّدة
              <Badge variant="secondary" className="text-[10px]">{sectionCount} قسم</Badge>
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(0)} className="gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع
              </Button>
              <Button size="sm" onClick={handleReviewAll} className="gap-1">
                فحص الجودة <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col-reverse lg:flex-row gap-4">
            {/* ─── Main Content ─── */}
            <div className="flex-1 min-w-0 space-y-4">

          {/* Metadata summary */}
          {reportDraft.metadata && (
            <Card className="bg-muted/30">
              <CardContent className="py-3">
                <div className="flex flex-wrap gap-4 text-xs">
                  {reportDraft.metadata.data_completeness_pct != null && (
                    <span>اكتمال البيانات: <strong>{reportDraft.metadata.data_completeness_pct}%</strong></span>
                  )}
                  {reportDraft.metadata.approaches_used?.length ? (
                    <span>الأساليب: <strong>{reportDraft.metadata.approaches_used.join("، ")}</strong></span>
                  ) : null}
                  {reportDraft.metadata.standards_referenced?.length ? (
                    <span>المعايير: <strong>{reportDraft.metadata.standards_referenced.join("، ")}</strong></span>
                  ) : null}
                </div>
                {reportDraft.metadata.missing_data_items?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reportDraft.metadata.missing_data_items.map((item, i) => (
                      <Badge key={i} variant="destructive" className="text-[9px]">{item}</Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Final Value Card */}
          {reportDraft.final_value && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">القيمة النهائية المستنتجة</p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {formatNumber(reportDraft.final_value.amount ?? 0)} {reportDraft.final_value.currency || "ر.س"}
                    </p>
                    {reportDraft.final_value.text_ar && (
                      <p className="text-xs text-muted-foreground mt-1">{reportDraft.final_value.text_ar}</p>
                    )}
                  </div>
                  <div className="text-left text-xs space-y-1">
                    {reportDraft.final_value.basis_of_value_ar && (
                      <p>أساس القيمة: <strong>{reportDraft.final_value.basis_of_value_ar}</strong></p>
                    )}
                    {reportDraft.final_value.confidence_level && (
                      <Badge variant={reportDraft.final_value.confidence_level === "high" ? "default" : "secondary"} className="text-[9px]">
                        ثقة: {reportDraft.final_value.confidence_level === "high" ? "عالية" : reportDraft.final_value.confidence_level === "medium" ? "متوسطة" : "منخفضة"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sections List */}
          <div className="space-y-2">
            {sectionEntries.map(([key, sec]) => {
              const isExpanded = expandedSection === key;
              const isEditing = editingSection === key;

              const SectionIcon = SECTION_ICONS[key] || FileText;
              const sColor = SECTION_COLORS[key] || DEFAULT_SECTION_COLOR;

              return (
                <Card key={key} className={`transition-all ${isExpanded ? `border-l-2 ${sColor.accent}` : ""}`}>
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedSection(isExpanded ? null : key)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg ${sColor.bg} flex items-center justify-center shrink-0`}>
                        <SectionIcon className={`w-3.5 h-3.5 ${sColor.text}`} />
                      </div>
                      <span className="font-medium text-sm">{sec.title_ar || key}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {editedSections.has(key) ? (
                        <Badge variant="outline" className="text-[9px] gap-1 border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-500/10">
                          <Edit3 className="w-2.5 h-2.5" /> معدّل يدوياً
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] gap-1 border-primary/50 text-primary bg-primary/5">
                          <Sparkles className="w-2.5 h-2.5" /> مولّد بالذكاء
                        </Badge>
                      )}
                      {sec.content_ar && (
                        <Badge variant="secondary" className="text-[9px]">
                          {sec.content_ar.length} حرف
                        </Badge>
                      )}
                      {sec.tables?.length ? (
                        <Badge variant="outline" className="text-[9px]">{sec.tables.length} جدول</Badge>
                      ) : null}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <CardContent className="pt-0 space-y-3">
                      <Separator />
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editBuffer}
                            onChange={(e) => setEditBuffer(e.target.value)}
                            rows={10}
                            className="text-sm"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setEditingSection(null)}>إلغاء</Button>
                            <Button size="sm" onClick={() => handleSaveEdit(key)}>حفظ</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="prose prose-sm dark:prose-invert max-w-none text-right bg-muted/20 rounded-lg p-3 max-h-[350px] overflow-y-auto">
                            <ReactMarkdown>{sec.content_ar || "لا يوجد محتوى"}</ReactMarkdown>
                          </div>

                          {/* Tables */}
                          {sec.tables?.map((tbl, tIdx) => (
                            <div key={tIdx} className="overflow-x-auto">
                              {tbl.caption_ar && <p className="text-xs font-bold mb-1">{tbl.caption_ar}</p>}
                              <table className="w-full text-xs border border-border rounded-lg">
                                <thead>
                                  <tr className="bg-muted/50">
                                    {tbl.headers?.map((h, hIdx) => (
                                      <th key={hIdx} className="p-2 text-right border-b border-border">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {tbl.rows?.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-muted/20">
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="p-2 border-b border-border/50">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}

                          {/* Confidence indicator */}
                          {sectionConfidence[key] && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">نسبة الثقة:</span>
                              <div className="flex items-center gap-1.5">
                                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      sectionConfidence[key] >= 80 ? "bg-primary" : sectionConfidence[key] >= 60 ? "bg-yellow-500" : "bg-destructive"
                                    }`}
                                    style={{ width: `${sectionConfidence[key]}%` }}
                                  />
                                </div>
                                <span className={`font-bold ${
                                  sectionConfidence[key] >= 80 ? "text-primary" : sectionConfidence[key] >= 60 ? "text-yellow-600" : "text-destructive"
                                }`}>
                                  {sectionConfidence[key]}%
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() => handleCopy(sec.content_ar || "")}
                            >
                              <Copy className="w-3 h-3" /> نسخ
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() => { setEditingSection(key); setEditBuffer(sec.content_ar || ""); }}
                            >
                              <Edit3 className="w-3 h-3" /> تعديل
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs text-primary"
                              disabled={regeneratingSection === key}
                              onClick={() => handleRegenerateSection(key)}
                            >
                              {regeneratingSection === key
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <RefreshCw className="w-3 h-3" />}
                              إعادة توليد
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
            </div>

            {/* ─── Sticky Sidebar: Report Summary ─── */}
            <div className="w-full lg:w-72 shrink-0">
              <div className="sticky top-4 space-y-3">
                {/* Final Value */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                      <Scale className="w-3.5 h-3.5" /> القيمة النهائية المقترحة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    {reportDraft.final_value?.amount ? (
                      <div className="space-y-2">
                        <p className="text-xl font-extrabold text-primary">
                          {formatNumber(reportDraft.final_value.amount)} <span className="text-sm">{reportDraft.final_value.currency || "ر.س"}</span>
                        </p>
                        {reportDraft.final_value.text_ar && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{reportDraft.final_value.text_ar}</p>
                        )}
                        {reportDraft.final_value.basis_of_value_ar && (
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-muted-foreground">أساس القيمة:</span>
                            <span className="font-medium">{reportDraft.final_value.basis_of_value_ar}</span>
                          </div>
                        )}
                        {reportDraft.final_value.confidence_level && (
                          <Badge variant={reportDraft.final_value.confidence_level === "high" ? "default" : "secondary"} className="text-[9px]">
                            ثقة: {reportDraft.final_value.confidence_level === "high" ? "عالية" : reportDraft.final_value.confidence_level === "medium" ? "متوسطة" : "منخفضة"}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">لم تُحدد بعد</p>
                    )}
                  </CardContent>
                </Card>

                {/* Report Info */}
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="w-3.5 h-3.5" /> ملخص التقرير
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 text-[11px] space-y-2">
                    <InfoRow label="العميل" value={aggregatedData?.client?.record?.name_ar || aggregatedData?.client?.profile?.full_name_ar} />
                    <InfoRow label="نوع العقار" value={aggregatedData?.request?.property_type} />
                    <InfoRow label="الموقع" value={aggregatedData?.request?.property_city_ar} />
                    <InfoRow label="الرقم المرجعي" value={reportDraft.reference_number || aggregatedData?.assignment?.reference_number} />
                    <InfoRow label="المقيّم" value={aggregatedData?.valuer?.full_name_ar} />
                    <InfoRow label="المنشأة" value={aggregatedData?.organization?.name_ar} />
                    <Separator className="my-1" />
                    <InfoRow label="المنهجية الرئيسية" value={
                      reportDraft.metadata?.approaches_used?.[0] ||
                      aggregatedData?.assignment?.valuation_approach ||
                      "—"
                    } />
                    <InfoRow label="عدد المقارنات" value={
                      String(aggregatedData?.comparables?.length ?? "—")
                    } />
                  </CardContent>
                </Card>

                {/* Sections Navigation */}
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="w-3.5 h-3.5" /> تقدّم الأقسام
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-1.5">
                    {/* Overall progress bar */}
                    {(() => {
                      const completed = sectionEntries.filter(([, s]) => s.content_ar && s.content_ar.length > 20).length;
                      const pct = sectionCount > 0 ? Math.round((completed / sectionCount) * 100) : 0;
                      return (
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">الاكتمال</span>
                            <span className="font-bold text-primary">{pct}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })()}

                    {sectionEntries.map(([key, sec]) => {
                      const SIcon = SECTION_ICONS[key] || FileText;
                      const sColor = SECTION_COLORS[key] || DEFAULT_SECTION_COLOR;
                      const isEdited = editedSections.has(key);
                      const hasContent = !!(sec.content_ar && sec.content_ar.length > 20);
                      const conf = sectionConfidence[key];
                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-1.5 text-[10px] p-1.5 rounded cursor-pointer hover:bg-muted/40 transition-colors ${expandedSection === key ? sColor.bg : ""}`}
                          onClick={() => setExpandedSection(expandedSection === key ? null : key)}
                        >
                          <SIcon className={`w-3 h-3 shrink-0 ${hasContent ? sColor.text : "text-muted-foreground/40"}`} />
                          <span className={`flex-1 truncate ${hasContent ? "text-foreground" : "text-muted-foreground/60"}`}>
                            {sec.title_ar || key}
                          </span>
                          {conf && (
                            <span className={`text-[8px] font-mono ${conf >= 80 ? "text-primary" : conf >= 60 ? "text-yellow-600" : "text-destructive"}`}>
                              {conf}%
                            </span>
                          )}
                          {isEdited ? (
                            <Edit3 className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                          ) : hasContent ? (
                            <CheckCircle2 className="w-2.5 h-2.5 text-primary shrink-0" />
                          ) : (
                            <AlertCircle className="w-2.5 h-2.5 text-muted-foreground/30 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                    <Separator className="my-1.5" />
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">مكتمل</span>
                      <span className="font-bold text-primary">
                        {sectionEntries.filter(([, s]) => s.content_ar && s.content_ar.length > 20).length}/{sectionCount}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button className="w-full gap-1.5 text-xs" size="sm" onClick={handleReviewAll}>
                    <Eye className="w-3.5 h-3.5" /> فحص الجودة والامتثال
                  </Button>
                  <Button className="w-full gap-1.5 text-xs bg-primary hover:bg-primary/90" size="sm" onClick={() => { toast.success("تم اعتماد المسودة وإرسالها للمراجعة"); }}>
                    <Send className="w-3.5 h-3.5" /> اعتماد المسودة وإرسال للمراجعة
                  </Button>
                  <Button variant="outline" className="w-full gap-1.5 text-xs" size="sm" onClick={() => { toast.info("يمكنك إضافة ملاحظاتك على الأقسام أعلاه"); }}>
                    <Edit3 className="w-3.5 h-3.5" /> طلب تعديلات إضافية
                  </Button>
                  <Button className="w-full gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" onClick={() => { toast.success("جاري تصدير التقرير بصيغة PDF..."); navigate("/report-generator?assignment_id=" + (aggregatedData?.assignment?.id || "")); }}>
                    <Download className="w-3.5 h-3.5" /> تصدير PDF
                  </Button>
                  <Button variant="ghost" className="w-full gap-1.5 text-xs text-muted-foreground" size="sm" onClick={() => setStep(0)}>
                    <ArrowRight className="w-3.5 h-3.5" /> رجوع للبيانات
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Step 3: Quality Review                     */}
      {/* ═══════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> فحص الجودة والامتثال
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع
              </Button>
              <Button size="sm" onClick={() => setStep(4)} className="gap-1" disabled={isReviewing}>
                التالي <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {!isReviewing && !reviewOutput && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center space-y-3">
                <Eye className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">رقيم سيراجع جميع الأقسام ويفحص الامتثال لمعايير IVS 2025</p>
                <Button className="gap-2" onClick={handleReviewAll}>
                  <Sparkles className="w-4 h-4" /> بدء فحص الجودة
                </Button>
              </CardContent>
            </Card>
          )}

          {(isReviewing || reviewOutput) && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> تقرير الجودة
                  {isReviewing && <Badge variant="secondary" className="gap-1 text-[10px]"><Loader2 className="w-3 h-3 animate-spin" /> جارٍ المراجعة</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none text-right bg-muted/20 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <ReactMarkdown>{reviewOutput || "..."}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Step 4: Preview                            */}
      {/* ═══════════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" /> معاينة التقرير
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(3)} className="gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع
              </Button>
              <Button size="sm" onClick={() => setStep(5)} className="gap-1">
                إنشاء المسودة <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* ─── Cover Page ─── */}
          <Card className="border-2 border-primary/20 overflow-hidden">
            <div className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 md:p-12">
              {/* Decorative corner accents */}
              <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-primary/30 rounded-tl-lg" />
              <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-primary/30 rounded-br-lg" />

              <div className="flex flex-col items-center text-center space-y-6 py-6">
                {/* Organization Logo/Name */}
                {aggregatedData?.organization?.name_ar && (
                  <div className="space-y-1">
                    <p className="text-sm tracking-widest text-muted-foreground font-medium uppercase">
                      {aggregatedData.organization.name_en || "Valuation Report"}
                    </p>
                    <h3 className="text-lg font-bold text-foreground">
                      {aggregatedData.organization.name_ar}
                    </h3>
                    {aggregatedData.organization.taqeem_registration && (
                      <p className="text-[10px] text-muted-foreground">
                        رقم التسجيل: {aggregatedData.organization.taqeem_registration}
                      </p>
                    )}
                  </div>
                )}

                <Separator className="w-1/3 mx-auto" />

                {/* Report Title */}
                <div className="space-y-2">
                  <p className="text-xs tracking-[0.3em] text-primary font-semibold uppercase">
                    تقرير تقييم عقاري
                  </p>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight">
                    {reportDraft?.report_title_ar || "تقرير تقييم القيمة السوقية"}
                  </h2>
                  {reportDraft?.report_title_en && (
                    <p className="text-sm text-muted-foreground" dir="ltr">
                      {reportDraft.report_title_en}
                    </p>
                  )}
                </div>

                <Separator className="w-1/3 mx-auto" />

                {/* Cover Page Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg text-right">
                  {/* Client Name */}
                  <div className="p-4 rounded-xl bg-background/80 border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <User className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium">اسم العميل</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {aggregatedData?.client?.record?.name_ar
                        || aggregatedData?.client?.profile?.full_name_ar
                        || "—"}
                    </p>
                    {(aggregatedData?.client?.record?.id_number || aggregatedData?.client?.record?.cr_number) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {aggregatedData.client.record.id_type || "هوية"}: {aggregatedData.client.record.id_number || aggregatedData.client.record.cr_number}
                      </p>
                    )}
                  </div>

                  {/* Property Type */}
                  <div className="p-4 rounded-xl bg-background/80 border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium">نوع العقار</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {aggregatedData?.request?.property_type || "—"}
                    </p>
                    {aggregatedData?.request?.property_city_ar && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {aggregatedData.request.property_city_ar}
                        {aggregatedData.request.property_district_ar ? ` — ${aggregatedData.request.property_district_ar}` : ""}
                      </p>
                    )}
                  </div>

                  {/* Report Number */}
                  <div className="p-4 rounded-xl bg-background/80 border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium">رقم التقرير</span>
                    </div>
                    <p className="text-sm font-bold text-foreground font-mono" dir="ltr">
                      {reportDraft?.reference_number
                        || aggregatedData?.assignment?.reference_number
                        || "—"}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="p-4 rounded-xl bg-background/80 border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium">تاريخ التقرير</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {reportDraft?.report_date
                        || new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Standards Badge */}
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  <Badge variant="outline" className="text-[10px] gap-1">IVS 2025</Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">معايير تقييم</Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">سرّي وخاص</Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* ─── Sections Preview ─── */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <h3 className="text-sm font-bold text-foreground mb-2">فهرس أقسام التقرير</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {sectionEntries.map(([key, sec], idx) => (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-primary">{sec.title_ar || key}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{sec.content_ar?.substring(0, 150)}...</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Step 5: Export                             */}
      {/* ═══════════════════════════════════════════ */}
      {step === 5 && (
        <Card className="border-primary/20">
          <CardContent className="py-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">التقرير جاهز للإنشاء</h3>
              <p className="text-sm text-muted-foreground mt-1">
                تم توليد ومراجعة جميع أقسام التقرير وفق معايير IVS 2025 ومعايير الهيئة السعودية للمقيمين المعتمدين
              </p>
            </div>

            <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto text-center">
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-2xl font-bold text-primary">{sectionCount}</p>
                <p className="text-[10px] text-muted-foreground">أقسام مُولّدة</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-2xl font-bold text-primary">{aggregatedData?.comparables?.length || 0}</p>
                <p className="text-[10px] text-muted-foreground">مقارنات</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-2xl font-bold text-primary">{completeness}%</p>
                <p className="text-[10px] text-muted-foreground">اكتمال</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-2xl font-bold text-primary">IVS</p>
                <p className="text-[10px] text-muted-foreground">2025</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" className="gap-2" onClick={() => setStep(2)}>
                <Edit3 className="w-4 h-4" /> تعديل الأقسام
              </Button>
              <Button size="lg" className="gap-2" onClick={handleCreateDraft}>
                <FileText className="w-4 h-4" /> إنشاء مسودة التقرير
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Helper Component ─── */
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}
