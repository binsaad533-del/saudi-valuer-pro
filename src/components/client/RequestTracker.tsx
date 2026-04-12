import { Check } from "lucide-react";

const STAGES = [
  { key: "intake", label: "الاستقبال" },
  { key: "scope", label: "النطاق والدفع" },
  { key: "inspection", label: "المعاينة" },
  { key: "draft", label: "مسودة التقرير" },
  { key: "issued", label: "الإصدار" },
];

const STATUS_TO_STAGE: Record<string, number> = {
  draft: 0,
  stage_1_processing: 0,
  stage_2_client_review: 0,
  stage_3_owner_scope: 1,
  stage_4_client_scope: 1,
  pending_payment_1: 1,
  stage_5_inspection: 2,
  stage_6_owner_draft: 3,
  stage_7_client_draft: 3,
  pending_payment_2: 3,
  signing: 4,
  issued: 4,
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
