import { Progress } from "@/components/ui/progress";
import { isDesktopValuationMode } from "@/lib/valuation-mode";

const ALL_STAGES = [
  { key: "submitted", label: "تم التقديم", fieldOnly: false },
  { key: "payment", label: "الدفع", fieldOnly: false },
  { key: "assigned", label: "تعيين المقيّم", fieldOnly: false },
  { key: "inspection", label: "المعاينة", fieldOnly: true },
  { key: "drafting", label: "إعداد التقرير", fieldOnly: false },
  { key: "delivered", label: "التسليم", fieldOnly: false },
];

const STATUS_TO_STAGE_KEY: Record<string, string> = {
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

interface ChatProgressBarProps {
  status: string;
  valuationMode?: string;
}

export default function ChatProgressBar({ status, valuationMode = "field" }: ChatProgressBarProps) {
  const isDesktop = isDesktopValuationMode(valuationMode);
  const stages = isDesktop ? ALL_STAGES.filter(s => !s.fieldOnly) : ALL_STAGES;

  const stageKey = STATUS_TO_STAGE_KEY[status] ?? "submitted";
  const effectiveStageKey = isDesktop && stageKey === "inspection" ? "drafting" : stageKey;
  const currentStage = Math.max(0, stages.findIndex(s => s.key === effectiveStageKey));
  const isCancelled = status === "cancelled";

  if (isCancelled) {
    return (
      <div className="px-4 py-2 bg-destructive/5 border border-destructive/20 rounded-lg text-center">
        <span className="text-xs text-destructive font-medium">تم إلغاء الطلب</span>
      </div>
    );
  }

  const totalStages = stages.length;
  const pct = Math.round(((currentStage + 1) / totalStages) * 100);

  return (
    <div className="space-y-2">
      {/* Percentage */}
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] text-muted-foreground font-medium">تقدم الطلب</span>
        <span className="text-[10px] font-bold text-primary">{pct}%</span>
      </div>

      {/* Progress bar */}
      <Progress value={pct} className="h-1.5" dir="rtl" />

      {/* Milestones - matching EnhancedRequestTracker stages */}
      <div className="flex items-start" dir="rtl">
        {stages.map((stage, i) => {
          const isDone = i < currentStage;
          const isActive = i === currentStage;

          return (
            <div key={stage.key} className="flex-1 flex flex-col items-center text-center relative">
              {/* Connector lines */}
              {i < stages.length - 1 && (
                <div className={`absolute top-[11px] left-0 w-1/2 h-0.5 ${isDone ? "bg-primary" : "bg-border"}`} />
              )}
              {i > 0 && (
                <div className={`absolute top-[11px] right-0 w-1/2 h-0.5 ${i <= currentStage ? "bg-primary" : "bg-border"}`} />
              )}
              {/* Node */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 text-[10px] font-semibold border transition-all ${
                  isDone
                    ? "bg-primary/10 text-primary border-primary/20"
                    : isActive
                    ? "border-primary border-2 bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground border-transparent"
                }`}
              >
                {isDone ? "✓" : <span dir="ltr" style={{ fontFamily: "system-ui" }}>{i + 1}</span>}
              </div>
              {/* Label */}
              <span
                className={`text-[9px] mt-1 leading-tight ${
                  isActive ? "text-primary font-bold" : isDone ? "text-foreground font-medium" : "text-muted-foreground/50"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
