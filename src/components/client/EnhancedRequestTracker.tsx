import { Progress } from "@/components/ui/progress";

const ALL_STAGES = [
  { key: "submitted", label: "تم التقديم", color: "bg-blue-50 text-blue-500 border-blue-200", description: "تم استلام طلبك بنجاح", durationDays: 1 },
  { key: "payment", label: "الدفع", color: "bg-red-50 text-red-500 border-red-200", description: "تأكيد الدفع وعرض السعر", durationDays: 2 },
  { key: "assigned", label: "تعيين المقيّم", color: "bg-emerald-50 text-emerald-500 border-emerald-200", description: "تم تعيين مقيّم معتمد", durationDays: 1 },
  { key: "inspection", label: "المعاينة", color: "bg-indigo-50 text-indigo-500 border-indigo-200", description: "معاينة العقار ميدانياً", durationDays: 3, fieldOnly: true },
  { key: "drafting", label: "إعداد التقرير", color: "bg-amber-50 text-amber-500 border-amber-200", description: "إعداد ومراجعة التقرير", durationDays: 5 },
  { key: "delivered", label: "التسليم", color: "bg-violet-50 text-violet-500 border-violet-200", description: "تقريرك جاهز للتحميل", durationDays: 1 },
];

const STATUS_TO_STAGE_KEY: Record<string, string> = {
  draft: "submitted", ai_review: "submitted", submitted: "submitted", needs_clarification: "submitted",
  under_pricing: "payment", quotation_sent: "payment", quotation_approved: "payment", quotation_rejected: "payment",
  awaiting_payment: "payment", payment_uploaded: "payment", payment_under_review: "payment",
  partially_paid: "payment", fully_paid: "assigned",
  in_production: "assigned", inspection_scheduled: "inspection", inspection_completed: "inspection",
  report_drafting: "drafting", draft_report_sent: "drafting", client_comments: "drafting",
  quality_review: "drafting", final_review: "drafting",
  final_payment_pending: "drafting", final_payment_uploaded: "drafting", final_payment_approved: "drafting",
  final_report_ready: "delivered", completed: "delivered", archived: "delivered",
  cancelled: "cancelled",
};

interface EnhancedRequestTrackerProps {
  status: string;
  createdAt?: string;
  compact?: boolean;
  valuationMode?: "field" | "desktop";
}

export function EnhancedRequestTracker({ status, createdAt, compact = false, valuationMode = "field" }: EnhancedRequestTrackerProps) {
  const isDesktop = valuationMode === "desktop";
  const stages = isDesktop ? ALL_STAGES.filter(s => !s.fieldOnly) : ALL_STAGES;

  const stageKey = STATUS_TO_STAGE_KEY[status] ?? "submitted";
  const currentStage = Math.max(0, stages.findIndex(s => s.key === stageKey));
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

      {/* Timeline */}
      <div className="relative pr-4">
        {stages.map((stage, i) => {
          const isDone = i < currentStage;
          const isActive = i === currentStage;
          const isPending = i > currentStage;
          const stageDate = stageDates[i];

          return (
            <div key={stage.key} className="relative flex gap-3 pb-5 last:pb-0">
              {/* Vertical line */}
              {i < stages.length - 1 && (
                <div
                  className={`absolute right-[13px] top-8 w-0.5 h-[calc(100%-12px)] ${
                    isDone ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              {/* Node */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 z-10 transition-all text-xs font-semibold border ${
                  isDone
                    ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                    : isActive
                    ? `${stage.color} border-2 shadow-md`
                    : "bg-muted text-muted-foreground border-transparent"
                }`}
              >
                {isDone ? "✓" : <span dir="ltr" style={{ fontFamily: "system-ui" }}>{i + 1}</span>}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-sm font-medium ${
                      isDone ? "text-foreground" : isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {stage.label}
                    {isActive && (
                      <span className="inline-flex items-center mr-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                        الحالية
                      </span>
                    )}
                  </p>
                  {stageDate && (isDone || isActive) && (
                    <span className="text-[10px] text-muted-foreground">
                      {stageDate.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
                    </span>
                  )}
                  {stageDate && isPending && (
                    <span className="text-[10px] text-muted-foreground/50">
                      ~{stageDate.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 ${isDone || isActive ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                  {stage.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
