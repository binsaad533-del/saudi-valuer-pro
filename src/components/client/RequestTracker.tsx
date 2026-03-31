import { Check } from "lucide-react";

const STAGES = [
  { key: "received", label: "تم الاستلام" },
  { key: "review", label: "قيد المراجعة" },
  { key: "valuation", label: "جاري التقييم" },
  { key: "final_review", label: "المراجعة النهائية" },
  { key: "completed", label: "مكتمل" },
];

const STATUS_TO_STAGE: Record<string, number> = {
  draft: 0,
  submitted: 0,
  received: 0,
  pending_payment: 0,
  quotation_sent: 0,
  payment_received: 1,
  under_review: 1,
  needs_clarification: 1,
  in_progress: 2,
  inspection_scheduled: 2,
  inspection_completed: 2,
  report_drafting: 2,
  draft_report_sent: 3,
  quality_review: 3,
  final_review: 3,
  approved: 4,
  completed: 4,
  archived: 4,
  cancelled: -1,
};

interface RequestTrackerProps {
  status: string;
  compact?: boolean;
}

export function RequestTracker({ status, compact = false }: RequestTrackerProps) {
  const currentStage = STATUS_TO_STAGE[status] ?? 0;
  const isCancelled = status === "cancelled";

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 text-destructive text-xs font-medium py-1">
        <span className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">✕</span>
        ملغي
      </div>
    );
  }

  return (
    <div className={`flex items-center w-full ${compact ? "gap-0" : "gap-0"}`}>
      {STAGES.map((stage, i) => {
        const isDone = i < currentStage;
        const isActive = i === currentStage;
        const isPending = i > currentStage;

        return (
          <div key={stage.key} className="flex items-center flex-1 last:flex-initial">
            {/* Node */}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0 ${
                  isDone
                    ? "bg-primary border-primary text-primary-foreground"
                    : isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {!compact && (
                <span
                  className={`text-[10px] mt-1.5 text-center whitespace-nowrap ${
                    isDone || isActive ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {stage.label}
                </span>
              )}
            </div>
            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 rounded-full transition-all ${
                  isDone ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
