import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Loader2,
  Building2, MapPin, RefreshCw, Edit3, Calculator, Shield, Clock, Star,
  Wrench, Layers, Home, Target, Landmark, Scale, Gavel,
  Briefcase, TrendingUp, RotateCcw, HeartPulse, DollarSign,
  FileText, Ruler, ClipboardList, FileSearch, ListChecks, CreditCard,
  ThumbsUp,
} from "lucide-react";
import { SAR } from "@/components/ui/saudi-riyal";
import { formatNumber } from "@/lib/utils";
import type { ScopeData } from "@/pages/scope-pricing/types";

// ── Discipline Analysis Card ──
export function DisciplineAnalysisCard({ scope }: { scope: ScopeData }) {
  if (!scope.disciplineAnalysis) return null;

  const cfg: Record<string, { label: string; icon: typeof Home; desc: string }> = {
    real_estate: { label: "تقييم عقاري", icon: Home, desc: "أراضي ومباني وعقارات" },
    machinery: { label: "تقييم آلات ومعدات", icon: Wrench, desc: "معدات وأصول متحركة وصناعية" },
    mixed: { label: "تقييم مختلط", icon: Layers, desc: "عقاري + آلات ومعدات" },
  };
  const selected = cfg[scope.disciplineAnalysis.discipline];
  const SelectedIcon = selected.icon;

  return (
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
              scope.disciplineAnalysis.confidence >= 85
                ? "text-emerald-600 dark:text-emerald-400"
                : scope.disciplineAnalysis.confidence >= 65
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {scope.disciplineAnalysis.confidence}%
            </p>
            <p className="text-[9px] text-muted-foreground">نسبة الثقة</p>
          </div>
        </div>

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

        {scope.disciplineAnalysis.reason && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <FileText className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-relaxed">{scope.disciplineAnalysis.reason}</p>
          </div>
        )}

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
  );
}

// ── Purpose Analysis Card ──
export function PurposeAnalysisCard({ scope }: { scope: ScopeData }) {
  if (!scope.purposeAnalysis) return null;

  const purposeIcons: Record<string, typeof Landmark> = {
    "تمويل بنكي": Landmark, "تمويل عقاري": Landmark,
    "شراء": DollarSign, "بيع": DollarSign, "بيع وشراء": DollarSign,
    "رهن": Shield, "تقسيم تركة": Scale, "فض نزاع": Gavel,
    "حكم قضائي": Gavel, "تصفية": RotateCcw, "محاسبة": Briefcase,
    "قوائم مالية": Briefcase, "تأمين": HeartPulse, "استثمار": TrendingUp,
    "إعادة تقييم": RotateCcw,
  };
  const getIcon = (label: string) => {
    for (const [key, Icon] of Object.entries(purposeIcons)) {
      if (label.includes(key)) return Icon;
    }
    return Target;
  };
  const pa = scope.purposeAnalysis;
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
              pa.confidence >= 85 ? "text-emerald-600 dark:text-emerald-400"
                : pa.confidence >= 65 ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400"
            }`}>{pa.confidence}%</p>
            <p className="text-[9px] text-muted-foreground">نسبة الثقة</p>
          </div>
        </div>

        {pa.allPurposes.filter(p => p.key !== pa.selectedPurpose).length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2">أغراض محتملة أخرى</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pa.allPurposes.filter(p => p.key !== pa.selectedPurpose).map((p) => {
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
}

// ── Basis of Value Card ──
export function BasisOfValueCard({ scope }: { scope: ScopeData }) {
  if (!scope.basisOfValueAnalysis) return null;

  const basisIcons: Record<string, typeof DollarSign> = {
    "القيمة السوقية": DollarSign, "Market Value": DollarSign,
    "القيمة العادلة": Scale, "Fair Value": Scale,
    "قيمة التصفية": RotateCcw, "Liquidation Value": RotateCcw,
    "قيمة الإيجار": Landmark, "Rental Value": Landmark,
    "قيمة الاستثمار": TrendingUp, "Investment Value": TrendingUp,
    "قيمة التأمين": HeartPulse, "Insurable Value": HeartPulse,
  };
  const getIcon = (label: string) => {
    for (const [key, Icon] of Object.entries(basisIcons)) {
      if (label.includes(key)) return Icon;
    }
    return DollarSign;
  };
  const ba = scope.basisOfValueAnalysis;
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
              ba.confidence >= 85 ? "text-emerald-600 dark:text-emerald-400"
                : ba.confidence >= 65 ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400"
            }`}>{ba.confidence}%</p>
            <p className="text-[9px] text-muted-foreground">نسبة الثقة</p>
          </div>
        </div>

        {ba.ivsReference && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
            <Shield className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">{ba.ivsReference}</p>
          </div>
        )}

        {ba.allBases.filter(b => b.key !== ba.selectedBasis).length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2">أسس قيمة محتملة أخرى</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ba.allBases.filter(b => b.key !== ba.selectedBasis).map((b) => {
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
}

// ── Methodology Analysis Card ──
export function MethodologyAnalysisCard({ scope }: { scope: ScopeData }) {
  if (!scope.methodologyAnalysis) return null;

  const methodIcons: Record<string, typeof Calculator> = {
    "مقارنة": TrendingUp, "سوق": TrendingUp, "Market": TrendingUp,
    "دخل": Landmark, "Income": Landmark, "رسملة": Landmark,
    "تكلفة": Briefcase, "Cost": Briefcase, "إحلال": Briefcase,
  };
  const getMethodIcon = (label: string) => {
    for (const [key, Icon] of Object.entries(methodIcons)) {
      if (label.includes(key)) return Icon;
    }
    return Calculator;
  };
  const ma = scope.methodologyAnalysis;
  const roleLabels: Record<string, string> = { primary: "رئيسي", secondary: "ثانوي", supporting: "داعم" };
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
        <div className="grid grid-cols-1 gap-2.5">
          {ma.allApproaches
            .sort((a, b) => {
              const order: Record<string, number> = { primary: 0, secondary: 1, supporting: 2 };
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
                      ap.confidence >= 85 ? "text-emerald-600 dark:text-emerald-400"
                        : ap.confidence >= 65 ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>{ap.confidence}%</p>
                  </div>
                </div>
              );
            })}
        </div>

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
}
