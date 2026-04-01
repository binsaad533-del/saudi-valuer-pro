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
  Wrench, Layers, Home,
} from "lucide-react";

interface DisciplineAnalysis {
  discipline: "real_estate" | "machinery" | "mixed";
  disciplineLabel: string;
  confidence: number;
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

export default function ScopeAndPricingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const extractedData = location.state?.extractedData;

  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<ScopeData | null>(null);
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [editingScope, setEditingScope] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(true);

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

        {/* Discipline Analysis */}
        {scope?.disciplineAnalysis && !loading && (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-gradient-to-l from-accent/10 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">تحليل نوع التقييم</h3>
                  <p className="text-[10px] text-muted-foreground">تم التحديد تلقائياً من المستندات المرفقة</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Discipline type cards */}
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: "real_estate", label: "عقاري", icon: Home, desc: "أراضي ومباني" },
                  { key: "machinery", label: "آلات ومعدات", icon: Wrench, desc: "معدات وأصول متحركة" },
                  { key: "mixed", label: "مختلط", icon: Layers, desc: "عقاري + آلات" },
                ] as const).map((d) => {
                  const isActive = scope.disciplineAnalysis!.discipline === d.key;
                  return (
                    <div
                      key={d.key}
                      className={`relative p-3 rounded-xl border-2 text-center transition-all ${
                        isActive
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/50 bg-muted/10 opacity-50"
                      }`}
                    >
                      {isActive && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                      <d.icon className={`w-6 h-6 mx-auto mb-1.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <p className={`text-xs font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{d.label}</p>
                      <p className="text-[9px] text-muted-foreground">{d.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Confidence bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">نسبة الثقة في التصنيف</span>
                    <span className={`text-xs font-bold ${
                      scope.disciplineAnalysis.confidence >= 85
                        ? "text-emerald-600 dark:text-emerald-400"
                        : scope.disciplineAnalysis.confidence >= 65
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {scope.disciplineAnalysis.confidence}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        scope.disciplineAnalysis.confidence >= 85
                          ? "bg-emerald-500"
                          : scope.disciplineAnalysis.confidence >= 65
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${scope.disciplineAnalysis.confidence}%` }}
                    />
                  </div>
                </div>
              </div>

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

        {/* Scope of Work */}
        {scope && !loading && (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-gradient-to-l from-primary/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">نطاق العمل</h3>
                  <Badge className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                    <Sparkles className="w-2.5 h-2.5 ml-1" />
                    مُولّد بالذكاء الاصطناعي
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setEditingScope(!editingScope)}>
                  <Edit3 className="w-3 h-3" />
                  {editingScope ? "إغلاق" : "تعديل"}
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border">
              {/* Core Info */}
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
                <div className="px-4 pb-2">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">تبرير اختيار المنهجيات</p>
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

              {/* Assumptions & Limitations */}
              <div className="p-4">
                <button
                  onClick={() => setShowAssumptions(!showAssumptions)}
                  className="flex items-center justify-between w-full text-xs font-bold text-foreground"
                >
                  <span>الافتراضات والقيود ({scope.assumptions.length + scope.limitations.length})</span>
                  {showAssumptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showAssumptions && (
                  <div className="mt-3 space-y-3">
                    {scope.assumptions.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5">الافتراضات</p>
                        {scope.assumptions.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-foreground py-1">
                            <span className="text-primary mt-0.5">•</span> {a}
                          </div>
                        ))}
                      </div>
                    )}
                    {scope.limitations.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5">القيود</p>
                        {scope.limitations.map((l, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-foreground py-1">
                            <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" /> {l}
                          </div>
                        ))}
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

              {/* Inspection Requirements */}
              {scope.inspectionRequirements && scope.inspectionRequirements.length > 0 && (
                <div className="p-4">
                  <h4 className="text-xs font-bold text-foreground mb-2">متطلبات المعاينة</h4>
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

              {/* Compliance Notes */}
              {scope.complianceNotes && scope.complianceNotes.length > 0 && (
                <div className="p-4">
                  <h4 className="text-xs font-bold text-foreground mb-2">ملاحظات الامتثال</h4>
                  {scope.complianceNotes.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-foreground py-1">
                      <Shield className="w-3 h-3 text-primary shrink-0 mt-0.5" /> {c}
                    </div>
                  ))}
                </div>
              )}

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

        {/* Action Buttons */}
        {scope && pricing && !loading && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="flex-1 gap-2 py-5 rounded-xl shadow-sm" size="lg"
              onClick={() => toast.success("تم اعتماد نطاق العمل والتسعير — جاري إنشاء الطلب")}>
              <CheckCircle2 className="w-4 h-4" />
              اعتماد نطاق العمل والتسعير
            </Button>
            <Button variant="outline" className="gap-2 py-5 rounded-xl" size="lg"
              onClick={() => navigate("/ai-document-processing")}>
              <ArrowRight className="w-4 h-4" />
              العودة للمستندات
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
