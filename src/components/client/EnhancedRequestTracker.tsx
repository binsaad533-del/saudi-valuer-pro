import { Progress } from "@/components/ui/progress";
import { isDesktopValuationMode } from "@/lib/valuation-mode";

const ALL_STAGES = [
  { key: "submitted", label: "تم التقديم", color: "bg-blue-50 text-blue-500 border-blue-200", description: "تم استلام طلبك بنجاح", durationDays: 1 },
  { key: "payment", label: "الدفع", color: "bg-red-50 text-red-500 border-red-200", description: "تأكيد الدفع وعرض السعر", durationDays: 2 },
  { key: "assigned", label: "تعيين المقيّم", color: "bg-emerald-50 text-emerald-500 border-emerald-200", description: "تم تعيين مقيّم معتمد", durationDays: 1 },
  { key: "inspection", label: "المعاينة", color: "bg-indigo-50 text-indigo-500 border-indigo-200", description: "معاينة العقار ميدانياً", durationDays: 3, fieldOnly: true },
  { key: "drafting", label: "إعداد التقرير", color: "bg-amber-50 text-amber-500 border-amber-200", description: "إعداد ومراجعة التقرير", durationDays: 5 },
  { key: "delivered", label: "التسليم", color: "bg-violet-50 text-violet-500 border-violet-200", description: "تقريرك جاهز للتحميل", durationDays: 1 },
];

const STATUS_TO_STAGE_KEY: Record<string, string> = {
  // 19-status workflow engine (canonical)
  draft: "submitted", submitted: "submitted",
  scope_generated: "payment", scope_approved: "payment",
  first_payment_confirmed: "assigned",
  data_collection_open: "assigned", data_collection_complete: "assigned",
  inspection_pending: "inspection", inspection_completed: "inspection",
  data_validated: "drafting",
  analysis_complete: "drafting", professional_review: "drafting",
  draft_report_ready: "drafting", client_review: "drafting",
  draft_approved: "drafting",
  final_payment_confirmed: "delivered",
  issued: "delivered", archived: "delivered",
  cancelled: "cancelled",
  // Legacy fallbacks
  ai_review: "submitted", needs_clarification: "submitted",
  under_pricing: "submitted", quotation_sent: "payment", quotation_approved: "payment",
  awaiting_payment: "payment", payment_uploaded: "payment",
  partially_paid: "payment", fully_paid: "assigned",
  in_production: "assigned", inspection_scheduled: "inspection",
  report_drafting: "drafting", draft_report_sent: "drafting", client_comments: "drafting",
  quality_review: "drafting", final_review: "drafting",
  final_payment_pending: "drafting", final_payment_uploaded: "drafting", final_payment_approved: "drafting",
  final_report_ready: "delivered", completed: "delivered",
};

interface EnhancedRequestTrackerProps {
  status: string;
  createdAt?: string;
  compact?: boolean;
  valuationMode?: string;
}

export function EnhancedRequestTracker({ status, createdAt, compact = false, valuationMode = "field" }: EnhancedRequestTrackerProps) {
  const isDesktop = isDesktopValuationMode(valuationMode);
  const stages = isDesktop ? ALL_STAGES.filter(s => !s.fieldOnly) : ALL_STAGES;

  const stageKey = STATUS_TO_STAGE_KEY[status] ?? "submitted";
  const effectiveStageKey = isDesktop && stageKey === "inspection" ? "drafting" : stageKey;
  const currentStage = Math.max(0, stages.findIndex(s => s.key === effectiveStageKey));
  const isCancelled = status === "cancelled";

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm font-medium py-2">
        <span className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center text-xs">✕</span>
        تم إلغاء الطلب
      </div>
    );
  }

  const totalStages = stages.length;
  const progressPercent = Math.round(((currentStage + 1) / totalStages) * 100);

  const startDate = createdAt ? new Date(createdAt) : null;
  const stageDates = stages.map((_, i) => {
    if (!startDate) return null;
    let days = 0;
    for (let j = 0; j < i; j++) days += stages[j].durationDays;
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    return d;
  });

  const estimatedEnd = startDate
    ? (() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + stages.reduce((a, s) => a + s.durationDays, 0));
        return d;
      })()
    : null;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">التقدم</span>
          <span className="font-semibold text-primary">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex items-center gap-1.5">
          {stages.map((stage, i) => {
            const isDone = i < currentStage;
            const isActive = i === currentStage;
            return (
              <div key={stage.key} className="flex items-center flex-1 last:flex-initial">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all text-xs font-semibold border ${
                    isDone
                      ? "bg-primary/10 text-primary border-primary/20"
                      : isActive
                      ? `${stage.color} border-2`
                      : "bg-muted text-muted-foreground border-transparent"
                  }`}
                >
                  {isDone ? "✓" : <span dir="ltr" style={{ fontFamily: "system-ui" }}>{i + 1}</span>}
                </div>
                {i < stages.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-0.5 rounded-full ${isDone ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-[10px] font-bold">%</span>
          </div>
          <span className="text-sm text-muted-foreground">تقدم الطلب</span>
          {isDesktop && (
            <span className="text-[10px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-medium">تقييم مكتبي</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-primary">{progressPercent}%</span>
          {estimatedEnd && currentStage < totalStages - 1 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
              التسليم المتوقع: {estimatedEnd.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
      <Progress value={progressPercent} className="h-2.5" dir="rtl" />

      {/* Horizontal stages below progress bar */}
      <div className="flex items-start" dir="rtl">
        {stages.map((stage, i) => {
          const isDone = i < currentStage;
          const isActive = i === currentStage;
          const stageDate = stageDates[i];
          const isPending = i > currentStage;

          return (
            <div key={stage.key} className="flex-1 flex flex-col items-center text-center relative">
              {/* Connector line */}
              {i < stages.length - 1 && (
                <div
                  className={`absolute top-[14px] left-0 w-1/2 h-0.5 ${isDone ? "bg-primary" : "bg-border"}`}
                />
              )}
              {i > 0 && (
                <div
                  className={`absolute top-[14px] right-0 w-1/2 h-0.5 ${i <= currentStage ? "bg-primary" : "bg-border"}`}
                />
              )}
              {/* Node */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-semibold border ${
                  isDone
                    ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                    : isActive
                    ? `${stage.color} border-2 shadow-md`
                    : "bg-muted text-muted-foreground border-transparent"
                }`}
              >
                {isDone ? "✓" : <span dir="ltr" style={{ fontFamily: "system-ui" }}>{i + 1}</span>}
              </div>
              {/* Label */}
              <p
                className={`text-[11px] font-medium mt-1.5 leading-tight ${
                  isDone ? "text-foreground" : isActive ? "text-primary" : "text-muted-foreground/60"
                }`}
              >
                {stage.label}
              </p>
              {isActive && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-primary/10 text-primary mt-0.5">
                  الحالية
                </span>
              )}
              {stageDate && (
                <span className={`text-[9px] mt-0.5 ${isPending ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                  {isPending ? "~" : ""}{stageDate.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
