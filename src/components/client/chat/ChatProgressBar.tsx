import { CheckCircle, Circle } from "lucide-react";

// Simplified client-facing milestones (grouped from 19 statuses)
const CLIENT_MILESTONES = [
  { key: "request", label: "الطلب", statuses: ["draft", "submitted"] },
  { key: "scope", label: "النطاق والسعر", statuses: ["scope_generated", "scope_approved"] },
  { key: "payment1", label: "الدفعة الأولى", statuses: ["first_payment_confirmed"] },
  { key: "execution", label: "التنفيذ", statuses: ["data_collection_open", "data_collection_complete", "inspection_pending", "inspection_completed", "data_validated", "analysis_complete", "professional_review"] },
  { key: "draft", label: "المسودة", statuses: ["draft_report_ready", "client_review", "draft_approved"] },
  { key: "final", label: "التقرير النهائي", statuses: ["final_payment_confirmed", "issued", "archived"] },
];

interface ChatProgressBarProps {
  status: string;
}

export default function ChatProgressBar({ status }: ChatProgressBarProps) {
  // Find which milestone the current status belongs to
  let activeMilestoneIdx = -1;
  for (let i = 0; i < CLIENT_MILESTONES.length; i++) {
    if (CLIENT_MILESTONES[i].statuses.includes(status)) {
      activeMilestoneIdx = i;
      break;
    }
  }

  if (status === "cancelled") {
    return (
      <div className="px-4 py-2 bg-destructive/5 border border-destructive/20 rounded-lg text-center">
        <span className="text-xs text-destructive font-medium">تم إلغاء الطلب</span>
      </div>
    );
  }

  const completedCount = activeMilestoneIdx + 1;
  const total = CLIENT_MILESTONES.length;
  const pct = Math.round((completedCount / total) * 100);

  return (
    <div className="space-y-2">
      {/* Percentage */}
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] text-muted-foreground font-medium">تقدم الطلب</span>
        <span className="text-[10px] font-bold text-primary">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-l from-primary to-primary/70 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Milestones */}
      <div className="flex justify-between items-center gap-1">
        {CLIENT_MILESTONES.map((milestone, i) => {
          const isCompleted = i < activeMilestoneIdx;
          const isCurrent = i === activeMilestoneIdx;
          return (
            <div key={milestone.key} className="flex flex-col items-center gap-0.5 flex-1">
              {isCompleted ? (
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
              ) : isCurrent ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-primary bg-primary/20 animate-pulse" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />
              )}
              <span className={`text-[9px] text-center leading-tight ${isCurrent ? "text-primary font-bold" : isCompleted ? "text-foreground" : "text-muted-foreground/50"}`}>
                {milestone.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
