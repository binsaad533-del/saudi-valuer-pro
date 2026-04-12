import { Progress } from "@/components/ui/progress";

const STAGES = [
  { key: "intake", label: "الاستلام", color: "bg-blue-50 text-blue-500 border-blue-200", description: "تم استلام طلبك بنجاح" },
  { key: "scope_payment", label: "النطاق والدفع", color: "bg-red-50 text-red-500 border-red-200", description: "اعتماد نطاق العمل ودفع الرسوم" },
  { key: "inspection", label: "المعاينة", color: "bg-indigo-50 text-indigo-500 border-indigo-200", description: "معاينة العقار ميدانياً" },
  { key: "drafting", label: "إعداد التقرير", color: "bg-amber-50 text-amber-500 border-amber-200", description: "مراجعة واعتماد التقرير" },
  { key: "signing", label: "توقيع التقرير", color: "bg-emerald-50 text-emerald-500 border-emerald-200", description: "توقيع المالك وإصدار التقرير" },
  { key: "issued", label: "الإصدار", color: "bg-violet-50 text-violet-500 border-violet-200", description: "تقريرك جاهز للتحميل" },
];

const STATUS_TO_STAGE: Record<string, number> = {
  draft: 0, stage_1_processing: 0, stage_2_client_review: 0,
  stage_3_owner_scope: 1, stage_4_client_scope: 1, pending_payment_1: 1,
  stage_5_inspection: 2,
  stage_6_owner_draft: 3, stage_7_client_draft: 3, pending_payment_2: 3,
  signing: 4,
  issued: 5, archived: 5,
  cancelled: -1,
};

const STAGE_DURATION_DAYS = [1, 2, 1, 3, 5, 1];

interface EnhancedRequestTrackerProps {
  status: string;
  createdAt?: string;
  compact?: boolean;
}

export function EnhancedRequestTracker({ status, createdAt, compact = false }: EnhancedRequestTrackerProps) {
  const currentStage = STATUS_TO_STAGE[status] ?? 0;
  const isCancelled = status === "cancelled";

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm font-medium py-2">
        <span className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center text-xs">✕</span>
        تم إلغاء الطلب
      </div>
    );
  }

  const totalStages = STAGES.length;
  const progressPercent = Math.round(((currentStage + 1) / totalStages) * 100);

  const startDate = createdAt ? new Date(createdAt) : null;
  const stageDates = STAGES.map((_, i) => {
    if (!startDate) return null;
    let days = 0;
    for (let j = 0; j < i; j++) days += STAGE_DURATION_DAYS[j];
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    return d;
  });

  const estimatedEnd = startDate
    ? (() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + STAGE_DURATION_DAYS.reduce((a, b) => a + b, 0));
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
          {STAGES.map((stage, i) => {
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
                {i < STAGES.length - 1 && (
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
      <Progress value={progressPercent} className="h-2.5" />

      {/* Timeline */}
      <div className="relative pr-4">
        {STAGES.map((stage, i) => {
          const isDone = i < currentStage;
          const isActive = i === currentStage;
          const isPending = i > currentStage;
          const stageDate = stageDates[i];

          return (
            <div key={stage.key} className="relative flex gap-3 pb-5 last:pb-0">
              {/* Vertical line */}
              {i < STAGES.length - 1 && (
                <div
                  className={`absolute right-[13px] top-8 w-0.5 h-[calc(100%-12px)] ${
                    isDone ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              {/* Emoji node */}
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
