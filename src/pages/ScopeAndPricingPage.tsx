import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, FileText, Ruler, ClipboardList, DollarSign, CheckCircle2,
  AlertTriangle, ArrowRight, Loader2, Building2, MapPin, RefreshCw,
  Edit3, ChevronDown, ChevronUp, Calculator, Shield, Clock, Star,
  Wrench, Layers, Home, Target, Landmark, Scale, Gavel,
  Briefcase, TrendingUp, RotateCcw, HeartPulse,
} from "lucide-react";

interface PurposeOption {
  key: string;
  label: string;
  confidence: number;
  reason: string;
}

interface PurposeAnalysis {
  selectedPurpose: string;
  confidence: number;
  reason: string;
  allPurposes: PurposeOption[];
}

interface BasisOption {
  key: string;
  label: string;
  labelEn: string;
  confidence: number;
  reason: string;
  ivsReference?: string;
}

interface BasisOfValueAnalysis {
  selectedBasis: string;
  selectedBasisEn: string;
  confidence: number;
  reason: string;
  ivsReference: string;
  allBases: BasisOption[];
}

interface ApproachOption {
  key: string;
  label: string;
  labelEn: string;
  role: "primary" | "secondary" | "supporting";
  confidence: number;
  reason: string;
  ivsReference?: string;
}

interface MethodologyAnalysis {
  primaryApproach: ApproachOption;
  secondaryApproach: ApproachOption;
  allApproaches: ApproachOption[];
  justification: string;
}

interface DisciplineAnalysis {
  discipline: "real_estate" | "machinery" | "mixed";
  disciplineLabel: string;
  confidence: number;
  reason: string;
  signals: string[];
  subTypes?: string[];
}

interface ScopeData {
  valuationType: string;
  valuationStandard: string;
  valuationBasis: string;
  approaches: string[];
  primaryApproach: string;
  secondaryApproach?: string;
  approachJustification?: string;
  inspectionType: string;
  inspectionRequirements?: string[];
  deliverables: string[];
  estimatedDays: number;
  assumptions: string[];
  limitations: string[];
  requiredDocuments?: string[];
  specialConsiderations?: string[];
  complianceNotes?: string[];
  disciplineAnalysis?: DisciplineAnalysis;
  purposeAnalysis?: PurposeAnalysis;
  basisOfValueAnalysis?: BasisOfValueAnalysis;
  methodologyAnalysis?: MethodologyAnalysis;
}

interface PricingBreakdown {
  complexityAdjustment: number;
  complexityFactor: number;
  complexityReason: string;
  urgencyAdjustment: number;
  urgencyFactor: number;
  rentalAnalysisSurcharge: number;
  portfolioDiscount: number;
  additionalServices: { name: string; price: number }[];
  additionalTotal: number;
}

interface PricingData {
  basePrice: number;
  cityMultiplier: number;
  adjustedBase: number;
  sizeCategory: string;
  breakdown: PricingBreakdown;
  totalPrice: number;
  justification: string;
}

const MOCK_EXTRACTED_DATA = {
  asset: {
    description: "فيلا سكنية",
    city: "الرياض",
    district: "حي النرجس",
    area: 625,
    buildingArea: 480,
    floors: 2,
    yearBuilt: 2021,
    address: "حي النرجس، شارع الأمير محمد بن سلمان",
  },
  suggestedPurpose: "تمويل بنكي",
  clientName: "شركة الرياض للتطوير العقاري",
};

const MOCK_SCOPE: ScopeData = {
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
    reason: "المستندات تشير بوضوح إلى عقار سكني (فيلا) مع صك ملكية ورخصة بناء — لا توجد إشارات لآلات أو معدات",
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
      role: "primary", confidence: 92, reason: "توفر بيانات مبيعات مماثلة كافية في المنطقة المستهدفة",
    },
    secondaryApproach: {
      key: "income", label: "الدخل", labelEn: "Income Approach",
      role: "secondary", confidence: 85, reason: "وجود عقد إيجار ساري يتيح تطبيق أسلوب الدخل للتحقق من القيمة السوقية",
    },
    allApproaches: [
      { key: "market", label: "المقارنة السوقية", labelEn: "Market Comparison", role: "primary", confidence: 92, reason: "توفر بيانات مبيعات مماثلة كافية في المنطقة" },
      { key: "income", label: "الدخل", labelEn: "Income Approach", role: "secondary", confidence: 85, reason: "عقد إيجار ساري يدعم تحليل التدفقات النقدية" },
      { key: "cost", label: "التكلفة", labelEn: "Cost Approach", role: "supporting", confidence: 55, reason: "داعمة للتحقق من تكلفة الإحلال" },
    ],
    justification: "وفقاً لمعيار IVS 105، تم اختيار المقارنة السوقية كمنهجية رئيسية مع أسلوب الدخل كمنهجية ثانوية نظراً لوجود عقد إيجار ساري يوفر بيانات تدفقات نقدية فعلية",
  },
};

const MOCK_PRICING: PricingData = {
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
    rentalAnalysisSurcharge: 500,
    portfolioDiscount: 0,
    additionalServices: [
      { name: "تصوير فوتوغرافي احترافي", price: 350 },
      { name: "تقرير ملخص تنفيذي إضافي", price: 200 },
    ],
    additionalTotal: 550,
  },
  totalPrice: 5478,
  justification: "تم احتساب التسعير بناءً على الرسوم الأساسية (3,500 ر.س) مع معامل الموقع الجغرافي للرياض (×1.15) ودرجة التعقيد لمنهجيتين مطلوبتين",
};

export default function ScopeAndPricingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const extractedData = location.state?.extractedData || MOCK_EXTRACTED_DATA;

  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<ScopeData | null>(MOCK_SCOPE);
  const [pricing, setPricing] = useState<PricingData | null>(MOCK_PRICING);
  const [editingScope, setEditingScope] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [clientApproved, setClientApproved] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");

  useEffect(() => {
    if (extractedData) {
      generateScopeAndPricing();
    }
  }, []);

  const generateScopeAndPricing = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-scope-pricing", {
        body: { extractedData },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setScope(data.scope);
      setPricing(data.pricing);
      toast.success("تم توليد نطاق العمل والتسعير بنجاح");
    } catch (err: any) {
      console.error("Scope generation error:", err);
      if (err.message?.includes("429") || err.message?.includes("حد الطلبات")) {
        toast.error("تم تجاوز حد الطلبات، يرجى المحاولة بعد قليل");
      } else if (err.message?.includes("402") || err.message?.includes("رصيد")) {
        toast.error("رصيد غير كافٍ، يرجى شحن الرصيد");
      } else {
        toast.error("حدث خطأ أثناء توليد نطاق العمل");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-SA").format(Math.round(amount)) + " ر.س";

  if (!extractedData) {
    return (
      <div className="min-h-screen" dir="rtl">
        <TopBar />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-lg font-bold text-foreground">لا توجد بيانات مستخرجة</h2>
          <p className="text-sm text-muted-foreground">يرجى تحليل المستندات أولاً من صفحة معالجة المستندات</p>
          <Button onClick={() => navigate("/ai-document-processing")} className="gap-2">
            <ArrowRight className="w-4 h-4" />
            العودة لمعالجة المستندات
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir="rtl">
      <TopBar />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">نطاق العمل والتسعير الذكي</h1>
              <p className="text-xs text-muted-foreground">تم التوليد بواسطة الذكاء الاصطناعي بناءً على المستندات المستخرجة</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={generateScopeAndPricing} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            إعادة التوليد
          </Button>
        </div>

        {/* Property Summary */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground">ملخص العقار</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "النوع", value: extractedData.asset?.description || "—", icon: Building2 },
              { label: "المدينة", value: extractedData.asset?.city || "—", icon: MapPin },
              { label: "المساحة", value: extractedData.asset?.area ? `${extractedData.asset.area} م²` : "—", icon: Ruler },
              { label: "الغرض", value: extractedData.suggestedPurpose || "—", icon: FileText },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className="text-xs font-medium text-foreground truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Discipline Analysis — System Decision, Approval Only */}
        {scope?.disciplineAnalysis && !loading && (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-gradient-to-l from-accent/10 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">تحليل نوع التقييم</h3>
                    <p className="text-[10px] text-muted-foreground">تم التحديد تلقائياً بواسطة الذكاء الاصطناعي — للمراجعة والموافقة</p>
                  </div>
                </div>
                <Badge className="text-[9px] bg-primary/10 text-primary border-0 gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  قرار النظام
                </Badge>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Selected discipline — prominent */}
              {(() => {
                const cfg: Record<string, { label: string; icon: typeof Home; desc: string }> = {
                  real_estate: { label: "تقييم عقاري", icon: Home, desc: "أراضي ومباني وعقارات" },
                  machinery: { label: "تقييم آلات ومعدات", icon: Wrench, desc: "معدات وأصول متحركة وصناعية" },
                  mixed: { label: "تقييم مختلط", icon: Layers, desc: "عقاري + آلات ومعدات" },
                };
                const selected = cfg[scope.disciplineAnalysis!.discipline];
                const SelectedIcon = selected.icon;
                return (
                  <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-primary bg-primary/5">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <SelectedIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-foreground">{selected.label}</p>
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground">{selected.desc}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className={`text-lg font-bold ${
                        scope.disciplineAnalysis!.confidence >= 85
                          ? "text-emerald-600 dark:text-emerald-400"
                          : scope.disciplineAnalysis!.confidence >= 65
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {scope.disciplineAnalysis!.confidence}%
                      </p>
                      <p className="text-[9px] text-muted-foreground">نسبة الثقة</p>
                    </div>
                  </div>
                );
              })()}

              {/* Other types — greyed out */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "real_estate", label: "عقاري", icon: Home },
                  { key: "machinery", label: "آلات ومعدات", icon: Wrench },
                  { key: "mixed", label: "مختلط", icon: Layers },
                ] as const)
                  .filter((d) => d.key !== scope.disciplineAnalysis!.discipline)
                  .map((d) => (
                    <div key={d.key} className="flex items-center gap-2 p-2 rounded-lg border border-border/30 bg-muted/10 opacity-40">
                      <d.icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{d.label}</span>
                    </div>
                  ))}
              </div>

              {/* Reason */}
              {scope.disciplineAnalysis.reason && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <FileText className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground leading-relaxed">{scope.disciplineAnalysis.reason}</p>
                </div>
              )}

              {/* Signals */}
              {scope.disciplineAnalysis.signals.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">إشارات التصنيف المكتشفة</p>
                  <div className="flex flex-wrap gap-1.5">
                    {scope.disciplineAnalysis.signals.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px] gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-types */}
              {scope.disciplineAnalysis.subTypes && scope.disciplineAnalysis.subTypes.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">الأنواع الفرعية المحددة</p>
                  <div className="flex flex-wrap gap-1.5">
                    {scope.disciplineAnalysis.subTypes.map((t, i) => (
                      <Badge key={i} variant="outline" className="text-[9px]">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Purpose Analysis — Smart AI Suggestion */}
        {scope?.purposeAnalysis && !loading && (() => {
          const purposeIcons: Record<string, typeof Landmark> = {
            "تمويل بنكي": Landmark,
            "تمويل عقاري": Landmark,
            "شراء": DollarSign,
            "بيع": DollarSign,
            "بيع وشراء": DollarSign,
            "رهن": Shield,
            "تقسيم تركة": Scale,
            "فض نزاع": Gavel,
            "حكم قضائي": Gavel,
            "تصفية": RotateCcw,
            "محاسبة": Briefcase,
            "قوائم مالية": Briefcase,
            "تأمين": HeartPulse,
            "استثمار": TrendingUp,
            "إعادة تقييم": RotateCcw,
          };
          const getIcon = (label: string) => {
            for (const [key, Icon] of Object.entries(purposeIcons)) {
              if (label.includes(key)) return Icon;
            }
            return Target;
          };
          const pa = scope.purposeAnalysis!;
          const SelectedIcon = getIcon(pa.selectedPurpose);

          return (
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border bg-gradient-to-l from-accent/10 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Target className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">الغرض من التقييم</h3>
                      <p className="text-[10px] text-muted-foreground">تم تحديده تلقائياً من المستندات — اقتراح ذكي للمراجعة</p>
                    </div>
                  </div>
                  <Badge className="text-[9px] bg-primary/10 text-primary border-0 gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    اقتراح ذكي
                  </Badge>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Selected Purpose — prominent card */}
                <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-primary bg-primary/5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <SelectedIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-foreground">{pa.selectedPurpose}</p>
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{pa.reason}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className={`text-lg font-bold ${
                      pa.confidence >= 85
                        ? "text-emerald-600 dark:text-emerald-400"
                        : pa.confidence >= 65
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {pa.confidence}%
                    </p>
                    <p className="text-[9px] text-muted-foreground">نسبة الثقة</p>
                  </div>
                </div>

                {/* Other possible purposes as smaller cards */}
                {pa.allPurposes.filter(p => p.key !== pa.selectedPurpose).length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-2">أغراض محتملة أخرى</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {pa.allPurposes
                        .filter(p => p.key !== pa.selectedPurpose)
                        .map((p) => {
                          const PIcon = getIcon(p.label);
                          return (
                            <div key={p.key} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/50 bg-muted/20 opacity-60">
                              <PIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-medium text-foreground truncate">{p.label}</p>
                                <p className="text-[9px] text-muted-foreground truncate">{p.reason}</p>
                              </div>
                              <span className="text-[9px] text-muted-foreground shrink-0">{p.confidence}%</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Basis of Value Analysis — IVS Compliant */}
        {scope?.basisOfValueAnalysis && !loading && (() => {
          const basisIcons: Record<string, typeof DollarSign> = {
            "القيمة السوقية": DollarSign,
            "Market Value": DollarSign,
            "القيمة العادلة": Scale,
            "Fair Value": Scale,
            "قيمة التصفية": RotateCcw,
            "Liquidation Value": RotateCcw,
            "قيمة الإيجار": Landmark,
            "Rental Value": Landmark,
            "قيمة الاستثمار": TrendingUp,
            "Investment Value": TrendingUp,
            "قيمة التأمين": HeartPulse,
            "Insurable Value": HeartPulse,
          };
          const getIcon = (label: string) => {
            for (const [key, Icon] of Object.entries(basisIcons)) {
              if (label.includes(key)) return Icon;
            }
            return DollarSign;
          };
          const ba = scope.basisOfValueAnalysis!;
          const SelectedIcon = getIcon(ba.selectedBasis);

          return (
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border bg-gradient-to-l from-accent/10 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Scale className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">أساس القيمة</h3>
                      <p className="text-[10px] text-muted-foreground">محدد تلقائياً وفق IVS 104 — للمراجعة والموافقة</p>
                    </div>
                  </div>
                  <Badge className="text-[9px] bg-primary/10 text-primary border-0 gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    IVS 104
                  </Badge>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Selected Basis — prominent card */}
                <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-primary bg-primary/5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <SelectedIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-foreground">{ba.selectedBasis}</p>
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{ba.selectedBasisEn}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">{ba.reason}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className={`text-lg font-bold ${
                      ba.confidence >= 85
                        ? "text-emerald-600 dark:text-emerald-400"
                        : ba.confidence >= 65
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {ba.confidence}%
                    </p>
                    <p className="text-[9px] text-muted-foreground">نسبة الثقة</p>
                  </div>
                </div>

                {/* IVS Reference */}
                {ba.ivsReference && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <Shield className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{ba.ivsReference}</p>
                  </div>
                )}

                {/* Other possible bases as smaller cards */}
                {ba.allBases.filter(b => b.key !== ba.selectedBasis).length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-2">أسس قيمة محتملة أخرى</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ba.allBases
                        .filter(b => b.key !== ba.selectedBasis)
                        .map((b) => {
                          const BIcon = getIcon(b.label);
                          return (
                            <div key={b.key} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/50 bg-muted/20 opacity-60">
                              <BIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-medium text-foreground truncate">{b.label}</p>
                                <p className="text-[9px] text-muted-foreground truncate">{b.labelEn}</p>
                              </div>
                              <span className="text-[9px] text-muted-foreground shrink-0">{b.confidence}%</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Methodology Analysis — IVS 105 */}
        {scope?.methodologyAnalysis && !loading && (() => {
          const methodIcons: Record<string, typeof Calculator> = {
            "مقارنة": TrendingUp,
            "سوق": TrendingUp,
            "Market": TrendingUp,
            "دخل": Landmark,
            "Income": Landmark,
            "رسملة": Landmark,
            "تكلفة": Briefcase,
            "Cost": Briefcase,
            "إحلال": Briefcase,
          };
          const getMethodIcon = (label: string) => {
            for (const [key, Icon] of Object.entries(methodIcons)) {
              if (label.includes(key)) return Icon;
            }
            return Calculator;
          };
          const ma = scope.methodologyAnalysis!;
          const roleLabels: Record<string, string> = {
            primary: "رئيسي",
            secondary: "ثانوي",
            supporting: "داعم",
          };
          const roleBorderColors: Record<string, string> = {
            primary: "border-primary bg-primary/5",
            secondary: "border-accent bg-accent/5",
            supporting: "border-border/50 bg-muted/20 opacity-60",
          };

          return (
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border bg-gradient-to-l from-accent/10 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Calculator className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">منهجية التقييم المقترحة</h3>
                      <p className="text-[10px] text-muted-foreground">محددة تلقائياً وفق IVS 105 — للمراجعة والموافقة</p>
                    </div>
                  </div>
                  <Badge className="text-[9px] bg-primary/10 text-primary border-0 gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    IVS 105
                  </Badge>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* All approaches as cards sorted by role */}
                <div className="grid grid-cols-1 gap-2.5">
                  {ma.allApproaches
                    .sort((a, b) => {
                      const order = { primary: 0, secondary: 1, supporting: 2 };
                      return (order[a.role] ?? 2) - (order[b.role] ?? 2);
                    })
                    .map((ap) => {
                      const ApIcon = getMethodIcon(ap.label);
                      const isPrimary = ap.role === "primary";
                      return (
                        <div key={ap.key} className={`flex items-center gap-4 p-4 rounded-xl border-2 ${roleBorderColors[ap.role]}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPrimary ? "bg-primary/10" : "bg-muted/30"}`}>
                            <ApIcon className={`w-5 h-5 ${isPrimary ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className={`text-xs font-bold ${isPrimary ? "text-foreground" : "text-foreground/80"}`}>{ap.label}</p>
                              {isPrimary && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                              <Badge variant={isPrimary ? "default" : "secondary"} className="text-[8px] px-1.5 py-0">
                                {roleLabels[ap.role]}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{ap.labelEn}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{ap.reason}</p>
                          </div>
                          <div className="text-left shrink-0">
                            <p className={`text-sm font-bold ${
                              ap.confidence >= 85
                                ? "text-emerald-600 dark:text-emerald-400"
                                : ap.confidence >= 65
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-red-600 dark:text-red-400"
                            }`}>
                              {ap.confidence}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Justification */}
                {ma.justification && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">تبرير اختيار المنهجيات (IVS 105)</p>
                      <p className="text-xs text-foreground leading-relaxed">{ma.justification}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Loading State */}
        {loading && (
          <div className="bg-card rounded-xl border border-border p-12 flex flex-col items-center gap-4">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <Sparkles className="w-4 h-4 text-yellow-500 absolute -top-1 -left-1 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">جاري توليد نطاق العمل والتسعير...</p>
              <p className="text-xs text-muted-foreground mt-1">الذكاء الاصطناعي يحلل البيانات المستخرجة ويحدد المنهجيات والتسعير المناسب</p>
            </div>
          </div>
        )}

        {/* Scope of Work — Auto-generated per IVS & TAQEEM */}
        {scope && !loading && (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-gradient-to-l from-primary/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">نطاق العمل المقترح</h3>
                    <p className="text-[10px] text-muted-foreground">مُولّد تلقائياً وفق معايير IVS 2025 والهيئة السعودية للمقيّمين المعتمدين</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setEditingScope(!editingScope)}>
                  <Edit3 className="w-3 h-3" />
                  {editingScope ? "إغلاق" : "تعديل"}
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border">
              {/* Standards Reference Bar */}
              <div className="px-4 py-2.5 bg-muted/20 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[9px] gap-1 border-primary/30 text-primary">
                  <Shield className="w-2.5 h-2.5" />
                  IVS 2025
                </Badge>
                <Badge variant="outline" className="text-[9px] gap-1 border-primary/30 text-primary">
                  <Shield className="w-2.5 h-2.5" />
                  معايير تقييم السعودية
                </Badge>
                <Badge variant="outline" className="text-[9px] gap-1 border-primary/30 text-primary">
                  <Shield className="w-2.5 h-2.5" />
                  الهيئة السعودية للمقيّمين المعتمدين
                </Badge>
                <Badge className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1 mr-auto">
                  <Sparkles className="w-2.5 h-2.5" />
                  قرار النظام — للمراجعة
                </Badge>
              </div>

              {/* Core Info Grid */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "نوع التقييم", value: scope.valuationType, icon: FileText },
                  { label: "المعيار المتبع", value: scope.valuationStandard, icon: Shield },
                  { label: "أساس القيمة", value: scope.valuationBasis, icon: Star },
                  { label: "نوع المعاينة", value: scope.inspectionType, icon: Building2 },
                  { label: "المنهجية الرئيسية", value: scope.primaryApproach, icon: Calculator },
                  { label: "المنهجية الثانوية", value: scope.secondaryApproach || "—", icon: Calculator },
                  { label: "المدة المتوقعة", value: `${scope.estimatedDays} أيام عمل`, icon: Clock },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/30">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p className="text-xs font-semibold text-foreground">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Approach Justification */}
              {scope.approachJustification && (
                <div className="p-4">
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">تبرير اختيار المنهجيات (وفق IVS 105)</p>
                      <p className="text-xs text-foreground leading-relaxed">{scope.approachJustification}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Approaches */}
              <div className="p-4">
                <h4 className="text-xs font-bold text-foreground mb-2">المنهجيات المطبقة</h4>
                <div className="flex flex-wrap gap-2">
                  {scope.approaches.map((approach, i) => (
                    <Badge key={i} variant={approach === scope.primaryApproach ? "default" : "secondary"} className="text-[10px]">
                      {approach === scope.primaryApproach && <Star className="w-2.5 h-2.5 ml-1" />}
                      {approach}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Deliverables */}
              <div className="p-4">
                <h4 className="text-xs font-bold text-foreground mb-2">المخرجات المطلوبة</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {scope.deliverables.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {d}
                    </div>
                  ))}
                </div>
              </div>

              {/* Required Documents */}
              {scope.requiredDocuments && scope.requiredDocuments.length > 0 && (
                <div className="p-4">
                  <h4 className="text-xs font-bold text-foreground mb-2">المستندات المطلوبة</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {scope.requiredDocuments.map((doc, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                        {doc}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inspection Requirements */}
              {scope.inspectionRequirements && scope.inspectionRequirements.length > 0 && (
                <div className="p-4">
                  <h4 className="text-xs font-bold text-foreground mb-2">متطلبات المعاينة الميدانية</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {scope.inspectionRequirements.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assumptions & Limiting Conditions — IVS + TAQEEM */}
              <div className="p-4">
                <button
                  onClick={() => setShowAssumptions(!showAssumptions)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-accent/20 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-accent-foreground" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground">الافتراضات والشروط المقيدة</span>
                      <p className="text-[9px] text-muted-foreground">وفق IVS 2024 ومعايير الهيئة السعودية للمقيّمين المعتمدين</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[8px] gap-1 border-primary/30 text-primary">
                      {scope.assumptions.length + scope.limitations.length} بند
                    </Badge>
                    {showAssumptions ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {showAssumptions && (
                  <div className="mt-3 space-y-4">
                    {/* Standards Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-[8px] gap-1 border-primary/20 text-primary">
                        <Shield className="w-2 h-2" />
                        IVS 2024 — Framework §20
                      </Badge>
                      <Badge variant="outline" className="text-[8px] gap-1 border-primary/20 text-primary">
                        <Shield className="w-2 h-2" />
                        IVS 104 — أسس القيمة
                      </Badge>
                      <Badge variant="outline" className="text-[8px] gap-1 border-primary/20 text-primary">
                        <Shield className="w-2 h-2" />
                        معايير تقييم السعودية — القسم 5
                      </Badge>
                    </div>

                    {/* Assumptions */}
                    {scope.assumptions.length > 0 && (
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        <div className="px-3 py-2 bg-muted/30 border-b border-border/50 flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-primary" />
                          <p className="text-[10px] font-bold text-foreground">الافتراضات العامة والخاصة</p>
                          <Badge variant="secondary" className="text-[8px] mr-auto">{scope.assumptions.length}</Badge>
                        </div>
                        <div className="divide-y divide-border/30">
                          {scope.assumptions.map((a, i) => (
                            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 text-xs text-foreground hover:bg-muted/10 transition-colors">
                              <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0 mt-0.5">{i + 1}</span>
                              <span className="leading-relaxed">{a}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Limiting Conditions */}
                    {scope.limitations.length > 0 && (
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        <div className="px-3 py-2 bg-muted/30 border-b border-border/50 flex items-center gap-2">
                          <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                          <p className="text-[10px] font-bold text-foreground">الشروط المقيدة والتحفظات</p>
                          <Badge variant="secondary" className="text-[8px] mr-auto">{scope.limitations.length}</Badge>
                        </div>
                        <div className="divide-y divide-border/30">
                          {scope.limitations.map((l, i) => (
                            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 text-xs text-foreground hover:bg-muted/10 transition-colors">
                              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{l}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Special Considerations */}
              {scope.specialConsiderations && scope.specialConsiderations.length > 0 && (
                <div className="p-4">
                  <h4 className="text-xs font-bold text-foreground mb-2">اعتبارات خاصة</h4>
                  {scope.specialConsiderations.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-foreground py-1">
                      <Sparkles className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" /> {s}
                    </div>
                  ))}
                </div>
              )}

              {/* Compliance Notes */}
              {scope.complianceNotes && scope.complianceNotes.length > 0 && (
                <div className="p-4">
                  <h4 className="text-xs font-bold text-foreground mb-2">ملاحظات الامتثال التنظيمي</h4>
                  {scope.complianceNotes.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-foreground py-1">
                      <Shield className="w-3 h-3 text-primary shrink-0 mt-0.5" /> {c}
                    </div>
                  ))}
                </div>
              )}

              {/* Editor */}
              {editingScope && (
                <div className="p-4 bg-muted/10">
                  <h4 className="text-xs font-bold text-foreground mb-2">ملاحظات تعديل النطاق</h4>
                  <Textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    placeholder="أضف ملاحظاتك أو تعديلاتك على نطاق العمل هنا..."
                    className="text-xs min-h-[80px]"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Smart Pricing */}
        {pricing && !loading && (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-gradient-to-l from-emerald-500/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">التسعير الذكي</h3>
                    <p className="text-[10px] text-muted-foreground">جدول أساسي + تعديلات AI</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-muted-foreground">الإجمالي</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(pricing.totalPrice)}</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border">
              {/* Base Price */}
              <div className="p-4">
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">تفاصيل التسعير</span>
                  </div>
                  {showBreakdown ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {showBreakdown && (
                  <div className="mt-3 space-y-2">
                    {/* Base row */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-xs text-foreground">السعر الأساسي</span>
                        <Badge variant="outline" className="text-[8px] h-4">فئة {pricing.sizeCategory}</Badge>
                      </div>
                      <span className="text-xs font-semibold text-foreground">{formatCurrency(pricing.basePrice)}</span>
                    </div>

                    {/* City multiplier */}
                    {pricing.cityMultiplier !== 1 && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-xs text-foreground">معامل المدينة</span>
                          <Badge variant="outline" className="text-[8px] h-4">×{pricing.cityMultiplier}</Badge>
                        </div>
                        <span className="text-xs font-semibold text-foreground">{formatCurrency(pricing.adjustedBase)}</span>
                      </div>
                    )}

                    {/* Complexity */}
                    {pricing.breakdown.complexityAdjustment !== 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="text-xs text-foreground">تعديل التعقيد</span>
                            <Badge className="text-[8px] h-4 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400 border-0">
                              <Sparkles className="w-2 h-2 ml-0.5" />
                              AI
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 mr-4">{pricing.breakdown.complexityReason}</p>
                        </div>
                        <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 shrink-0">
                          {pricing.breakdown.complexityAdjustment > 0 ? "+" : ""}{formatCurrency(pricing.breakdown.complexityAdjustment)}
                        </span>
                      </div>
                    )}

                    {/* Urgency */}
                    {pricing.breakdown.urgencyAdjustment > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-xs text-foreground">رسوم الاستعجال</span>
                        </div>
                        <span className="text-xs font-semibold text-red-700 dark:text-red-400">+{formatCurrency(pricing.breakdown.urgencyAdjustment)}</span>
                      </div>
                    )}

                    {/* Rental surcharge */}
                    {pricing.breakdown.rentalAnalysisSurcharge > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                          <span className="text-xs text-foreground">تحليل الإيجار</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">+{formatCurrency(pricing.breakdown.rentalAnalysisSurcharge)}</span>
                      </div>
                    )}

                    {/* Additional services */}
                    {pricing.breakdown.additionalServices.map((svc, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span className="text-xs text-foreground">{svc.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">+{formatCurrency(svc.price)}</span>
                      </div>
                    ))}

                    {/* Portfolio discount */}
                    {pricing.breakdown.portfolioDiscount > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs text-foreground">خصم المحفظة</span>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">-{formatCurrency(pricing.breakdown.portfolioDiscount)}</span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 mt-1">
                      <span className="text-sm font-bold text-foreground">الإجمالي (شامل الضريبة)</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(pricing.totalPrice)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Justification */}
              {pricing.justification && (
                <div className="p-4">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-border/30">
                    <Sparkles className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">تبرير التسعير (AI)</p>
                      <p className="text-xs text-foreground leading-relaxed">{pricing.justification}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Client Action Buttons */}
        {scope && pricing && !loading && (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            {clientApproved ? (
              <div className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-foreground">تمت الموافقة بنجاح</h3>
                <p className="text-xs text-muted-foreground max-w-md">تمت موافقتكم على نطاق العمل والتسعير المقترح. سيتم البدء بإجراءات التقييم وفق المعايير المعتمدة.</p>
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  معتمد من العميل
                </Badge>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-border bg-muted/10">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <p className="text-xs font-bold text-foreground">قرار العميل</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">يرجى مراجعة نطاق العمل والتسعير أعلاه ثم اتخاذ القرار المناسب</p>
                </div>
                <div className="p-4 flex flex-col sm:flex-row gap-3">
                  <Button
                    className="flex-1 gap-2 py-5 rounded-xl shadow-sm"
                    size="lg"
                    onClick={() => {
                      setClientApproved(true);
                      toast.success("تمت الموافقة على نطاق العمل والتسعير — سيتم البدء بالتقييم");
                    }}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    موافقة العميل
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 py-5 rounded-xl border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950/20"
                    size="lg"
                    onClick={() => setShowRevisionDialog(true)}
                  >
                    <Edit3 className="w-5 h-5" />
                    طلب تعديل
                  </Button>
                </div>
              </>
            )}

            {/* Revision Dialog */}
            {showRevisionDialog && (
              <div className="p-4 border-t border-border space-y-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-xs font-bold text-foreground">ملاحظات التعديل المطلوبة</p>
                </div>
                <Textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="اكتب ملاحظاتك حول التعديلات المطلوبة على النطاق أو التسعير..."
                  className="text-xs min-h-[100px] resize-none"
                  dir="rtl"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setShowRevisionDialog(false);
                      setRevisionNotes("");
                    }}
                  >
                    إلغاء
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs gap-1.5"
                    disabled={!revisionNotes.trim()}
                    onClick={() => {
                      toast.success("تم إرسال طلب التعديل — سيتم مراجعته من فريق التقييم");
                      setShowRevisionDialog(false);
                      setRevisionNotes("");
                    }}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    إرسال طلب التعديل
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
