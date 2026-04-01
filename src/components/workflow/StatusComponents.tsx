import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  WORKFLOW_STATUSES,
  getNextStatuses,
  getStatusIndex,
  transitionStatus,
  canTransition,
  CLIENT_STATUS_MAP,
  INSPECTOR_STATUS_MAP,
} from "@/lib/workflow-engine";
import { ChevronLeft, ArrowRight, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";


interface StatusBadgeProps {
  status: string;
  role?: "admin" | "client" | "inspector";
  size?: "sm" | "md";
}

export function StatusBadge({ status, role = "admin", size = "sm" }: StatusBadgeProps) {
  let label = STATUS_LABELS[status]?.ar || status;
  if (role === "client") label = CLIENT_STATUS_MAP[status] || label;
  if (role === "inspector") label = INSPECTOR_STATUS_MAP[status] || label;

  const colorClass = STATUS_COLORS[status] || "bg-muted text-muted-foreground";

  return (
    <Badge
      variant="secondary"
      className={`${colorClass} ${size === "md" ? "text-xs px-3 py-1" : "text-[10px] px-2 py-0.5"} gap-1`}
    >
      <span>{STATUS_LABELS[status]?.icon}</span>
      {label}
    </Badge>
  );
}

interface StatusProgressProps {
  currentStatus: string;
}

export function StatusProgress({ currentStatus }: StatusProgressProps) {
  const currentIdx = getStatusIndex(currentStatus);
  const total = WORKFLOW_STATUSES.length;
  const pct = total > 0 ? Math.round(((currentIdx + 1) / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{STATUS_LABELS[currentStatus]?.ar}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface StatusTransitionButtonProps {
  assignmentId: string;
  currentStatus: string;
  onTransition?: () => void;
}

export function StatusTransitionButton({ assignmentId, currentStatus, onTransition }: StatusTransitionButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const nextStatuses = getNextStatuses(currentStatus);

  if (nextStatuses.length === 0) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1">
        <Lock className="w-3 h-3" /> مغلق
      </Badge>
    );
  }

  const handleTransition = async (toStatus: string) => {
    setLoading(true);
    const result = await transitionStatus(assignmentId, currentStatus, toStatus, reason || undefined);
    if (result.success) {
      toast.success(`تم تحديث الحالة إلى: ${STATUS_LABELS[toStatus]?.ar}`);
      onTransition?.();
      setOpen(false);
      setReason("");
    } else {
      toast.error(result.error || "حدث خطأ");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1">
          <ArrowRight className="w-3 h-3" /> تقديم الحالة
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تغيير حالة التقييم</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">الحالة الحالية:</span>
            <StatusBadge status={currentStatus} size="md" />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">الانتقال إلى:</span>
            {nextStatuses.map((ns) => (
              <Button
                key={ns}
                variant="outline"
                className="w-full justify-between"
                disabled={loading}
                onClick={() => handleTransition(ns)}
              >
                <StatusBadge status={ns} size="md" />
                <ChevronLeft className="w-4 h-4" />
              </Button>
            ))}
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">سبب التغيير (اختياري)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="أدخل سبب تغيير الحالة..."
              rows={2}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StatusTimelineProps {
  history: Array<{
    from_status: string | null;
    to_status: string;
    created_at: string;
    reason: string | null;
  }>;
}

export function StatusTimeline({ history }: StatusTimelineProps) {
  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">لا يوجد سجل تغييرات</p>;
  }

  return (
    <div className="space-y-2">
      {history.map((entry, i) => (
        <div key={i} className="flex gap-3 text-xs">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-primary mt-1" />
            {i < history.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>
          <div className="pb-3">
            <div className="flex items-center gap-1 flex-wrap">
              {entry.from_status && (
                <>
                  <StatusBadge status={entry.from_status} />
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </>
              )}
              <StatusBadge status={entry.to_status} />
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {formatDateTime(entry.created_at)}
              {entry.reason && <span className="mr-2">• {entry.reason}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
