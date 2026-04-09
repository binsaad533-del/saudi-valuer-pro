import { useState } from "react";
import {
  Loader2, CheckCircle2, TrendingUp,
  MapPin, BarChart3, Scale, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";
import {
  runComparableSelection,
  type ComparableSelectionResult,
  type ComparableSelectionParams,
  type SelectedComparable,
} from "@/lib/comparable-selection-api";

interface Props {
  assignmentId: string;
  subjectCity?: string;
  subjectDistrict?: string;
  subjectPropertyType?: string;
  subjectArea?: number;
  subjectAge?: number;
  onResultReady?: (result: ComparableSelectionResult) => void;
}

const ADJ_TYPE_LABELS: Record<string, string> = {
  location: "الموقع",
  size: "المساحة",
  age: "العمر",
  condition: "الحالة",
  time: "الوقت",
};

export default function ComparableSelectionEngine({
  assignmentId,
  subjectCity,
  subjectDistrict,
  subjectPropertyType,
  subjectArea,
  subjectAge,
  onResultReady,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparableSelectionResult | null>(null);
  const [expandedComp, setExpandedComp] = useState<string | null>(null);

  const runEngine = async () => {
    setLoading(true);
    try {
      const params: ComparableSelectionParams = {
        assignment_id: assignmentId,
        subject_city_ar: subjectCity,
        subject_district_ar: subjectDistrict,
        subject_property_type: subjectPropertyType,
        subject_area_sqm: subjectArea,
        subject_age_years: subjectAge,
        max_results: 6,
      };

      const data = await runComparableSelection(params);
      setResult(data);
      onResultReady?.(data);

      if (data.selected.length === 0) {
        toast.info("لم يتم العثور على مقارنات مناسبة");
      } else {
        toast.success(`تم اختيار ${data.selected.length} مقارنات بنجاح`);
      }
    } catch (err: any) {
      toast.error(err.message || "خطأ في محرك المقارنات");
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = (score: number) => {
    if (score >= 70) return "text-emerald-600";
    if (score >= 40) return "text-amber-600";
    return "text-destructive";
  };


  return (
    <div className="space-y-4">
      {/* Header + Trigger */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RaqeemIcon size={20} />
            <div>
              <h3 className="text-sm font-semibold text-foreground">محرك اختيار المقارنات الذكي</h3>
              <p className="text-[10px] text-muted-foreground">
                يقوم بتصفية وتعديل ووزن المقارنات تلقائياً وفقاً للمعايير المهنية
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={runEngine}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RaqeemIcon size={14} />
            )}
            {loading ? "جاري التحليل..." : "تشغيل المحرك"}
          </Button>
        </div>

        {/* Subject info pills */}
        {(subjectCity || subjectArea || subjectPropertyType) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {subjectCity && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <MapPin className="w-3 h-3" />
                {subjectCity} {subjectDistrict ? `- ${subjectDistrict}` : ""}
              </Badge>
            )}
            {subjectArea && (
              <Badge variant="outline" className="text-[10px]">
                {formatNumber(subjectArea)} م²
              </Badge>
            )}
            {subjectPropertyType && (
              <Badge variant="outline" className="text-[10px]">
                {subjectPropertyType}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              icon={<BarChart3 className="w-4 h-4 text-primary" />}
              label="مقارنات مختارة"
              value={`${result.selected.length}`}
              sub={`من ${result.summary.total_found}`}
            />
            <SummaryCard
              icon={<SAR size={14} className="text-primary" />}
              label="متوسط سعر/م²"
              value={formatNumber(result.weighted_average_sqm)}
              sub="ر.س/م²"
            />
            {result.estimated_value && (
              <SummaryCard
                icon={<Scale className="w-4 h-4 text-primary" />}
                label="القيمة المقدرة"
                value={formatNumber(result.estimated_value)}
                sub="ر.س"
              />
            )}
            <SummaryCard
              icon={<TrendingUp className="w-4 h-4 text-primary" />}
              label="درجة الثقة"
              value={`${result.confidence_score}%`}
              sub=""
              valueClass={confidenceColor(result.confidence_score)}
            />
          </div>

          {/* Confidence Bar */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground">مؤشر الثقة</span>
              <span className={`text-sm font-bold ${confidenceColor(result.confidence_score)}`}>
                {result.confidence_score}%
              </span>
            </div>
            <Progress
              value={result.confidence_score}
              className="h-2"
            />
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
              <span>ضعيف</span>
              <span>متوسط</span>
              <span>قوي</span>
            </div>
          </div>

          {/* Value Range */}
          {result.estimated_value && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">نطاق القيمة</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-sm font-mono text-foreground">
                    {formatNumber(result.value_range.min)}
                  </span>
                  <span className="text-muted-foreground">—</span>
                  <span className="text-lg font-bold text-primary">
                    {formatNumber(result.estimated_value)}
                  </span>
                  <span className="text-muted-foreground">—</span>
                  <span className="text-sm font-mono text-foreground">
                    {formatNumber(result.value_range.max)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">ر.س</p>
              </div>
            </div>
          )}

          {/* Pipeline Summary */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-xs font-semibold text-foreground">مسار التحليل</h4>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <PipelineStep label="الإجمالي" value={result.summary.total_found} />
              <span className="text-muted-foreground text-xs">→</span>
              <PipelineStep label="بعد التنظيف" value={result.summary.after_cleaning} />
              <span className="text-muted-foreground text-xs">→</span>
              <PipelineStep label="بعد الفلترة" value={result.summary.after_filtering} />
              <span className="text-muted-foreground text-xs">→</span>
              <PipelineStep label="المختارة" value={result.summary.final_selected} active />
            </div>
          </div>

          {/* Selected Comparables */}
          {result.selected.length > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">المقارنات المختارة</h4>
              </div>
              <div className="divide-y divide-border">
                {result.selected.map((comp, idx) => (
                  <ComparableRow
                    key={comp.id}
                    comp={comp}
                    rank={idx + 1}
                    expanded={expandedComp === comp.id}
                    onToggle={() =>
                      setExpandedComp(expandedComp === comp.id ? null : comp.id)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              التحليل والتبرير
            </h4>
            <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
              {result.explanation_ar}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function SummaryCard({
  icon, label, value, sub, valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-bold leading-none ${valueClass || "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function PipelineStep({ label, value, active }: { label: string; value: number; active?: boolean }) {
  return (
    <div className={`text-center px-3 py-1.5 rounded-lg border ${
      active ? "bg-primary/10 border-primary/30" : "bg-muted/50 border-border"
    }`}>
      <p className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ComparableRow({
  comp, rank, expanded, onToggle,
}: {
  comp: SelectedComparable;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-right"
      >
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-foreground">
              {comp.city_ar} - {comp.district_ar || "—"}
            </span>
            <Badge variant="outline" className="text-[10px] h-5">{comp.property_type}</Badge>
            {comp.is_verified && (
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
            <span>{formatNumber(comp.land_area)} م²</span>
            <span>{formatNumber(comp.price)} ر.س</span>
            <span>{comp.transaction_date?.substring(0, 10)}</span>
          </div>
        </div>
        <div className="text-left shrink-0">
          <p className="text-xs font-bold text-foreground">{formatNumber(comp.adjusted_price_per_sqm)}</p>
          <p className="text-[10px] text-muted-foreground">ر.س/م²</p>
        </div>
        <div className="shrink-0">
          <Badge
            variant="secondary"
            className={`text-[10px] ${
              comp.similarity_score >= 70 ? "bg-emerald-500/10 text-emerald-700" :
              comp.similarity_score >= 50 ? "bg-amber-500/10 text-amber-700" :
              "bg-destructive/10 text-destructive"
            }`}
          >
            {comp.similarity_score}%
          </Badge>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pr-14 space-y-2">
          {/* Adjustments */}
          {comp.adjustments.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-foreground mb-1.5">التعديلات المطبقة</p>
              <div className="space-y-1">
                {comp.adjustments.map((adj, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">
                      {ADJ_TYPE_LABELS[adj.type] || adj.type}
                    </span>
                    <span className={adj.percentage >= 0 ? "text-emerald-600" : "text-destructive"}>
                      {adj.percentage >= 0 ? "+" : ""}{(adj.percentage * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
                <div className="border-t border-border pt-1 flex items-center justify-between text-[10px] font-semibold">
                  <span className="text-foreground">إجمالي التعديل</span>
                  <span className={comp.total_adjustment_pct >= 0 ? "text-emerald-600" : "text-destructive"}>
                    {comp.total_adjustment_pct >= 0 ? "+" : ""}{comp.total_adjustment_pct}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sources */}
          {comp.sources.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-foreground">المصادر</p>
              {comp.sources.map((s, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">
                  {s.name_ar} {s.reference ? `(${s.reference})` : ""}
                </p>
              ))}
            </div>
          )}

          {/* Justifications */}
          {comp.adjustments.filter(a => a.justification_ar).length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-foreground">التبريرات</p>
              {comp.adjustments.filter(a => a.justification_ar).map((a, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">• {a.justification_ar}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
