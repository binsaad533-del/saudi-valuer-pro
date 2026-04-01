import { useState } from "react";
import { Report } from "@/types/report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  CheckCircle2,
  XCircle,
  Stamp,
  Truck,
  Ban,
  ClipboardList,
} from "lucide-react";
import {
  getAvailableActions,
  executeWorkflowAction,
  getStatusLabel,
  getStatusColor,
} from "@/utils/reportWorkflow";
import { toast } from "sonner";
import type { WorkflowAction } from "@/types/report";
import { formatDate } from "@/lib/utils";


interface ReportWorkflowPanelProps {
  report: Report;
  isOwner: boolean;
  onReportUpdate: (updated: Report) => void;
}

const ACTION_CONFIG: Record<
  WorkflowAction,
  { label: string; icon: React.ReactNode; variant: "default" | "destructive" | "outline" }
> = {
  create_draft: { label: "إنشاء مسودة", icon: <ClipboardList className="w-4 h-4" />, variant: "default" },
  submit_review: { label: "إرسال للمراجعة", icon: <Send className="w-4 h-4" />, variant: "default" },
  approve: { label: "اعتماد", icon: <CheckCircle2 className="w-4 h-4" />, variant: "default" },
  reject: { label: "إعادة للتعديل", icon: <XCircle className="w-4 h-4" />, variant: "outline" },
  issue: { label: "إصدار نهائي", icon: <Stamp className="w-4 h-4" />, variant: "default" },
  deliver: { label: "تسليم للعميل", icon: <Truck className="w-4 h-4" />, variant: "default" },
  cancel: { label: "إلغاء", icon: <Ban className="w-4 h-4" />, variant: "destructive" },
};

const STEPS = [
  { status: "draft", label: "مسودة" },
  { status: "review", label: "مراجعة" },
  { status: "approved", label: "معتمد" },
  { status: "issued", label: "صادر" },
  { status: "delivered", label: "مُسلَّم" },
] as const;

function getStepIndex(status: string): number {
  const idx = STEPS.findIndex((s) => s.status === status);
  return idx === -1 ? 0 : idx;
}

export default function ReportWorkflowPanel({
  report,
  isOwner,
  onReportUpdate,
}: ReportWorkflowPanelProps) {
  const [confirmAction, setConfirmAction] = useState<WorkflowAction | null>(null);
  const [details, setDetails] = useState("");

  const actions = getAvailableActions(report.status, isOwner);
  const currentStep = getStepIndex(report.status);
  const isCancelled = report.status === "cancelled";

  const handleExecute = () => {
    if (!confirmAction) return;
    try {
      const updated = executeWorkflowAction(
        report,
        confirmAction,
        "أحمد المالكي",
        isOwner,
        details || undefined
      );
      onReportUpdate(updated);
      toast.success(`تم تنفيذ: ${ACTION_CONFIG[confirmAction].label}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConfirmAction(null);
      setDetails("");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>سير عمل التقرير</span>
            <Badge className={getStatusColor(report.status)}>
              {getStatusLabel(report.status)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Progress Steps */}
          {!isCancelled && (
            <div className="flex items-center gap-1" dir="rtl">
              {STEPS.map((step, i) => {
                const done = i <= currentStep;
                const active = i === currentStep;
                return (
                  <div key={step.status} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                            : done
                            ? "bg-primary/80 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <span
                        className={`text-[10px] mt-1 ${
                          active ? "font-bold text-primary" : done ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 mx-0.5 rounded ${
                          i < currentStep ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isCancelled && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-center text-sm font-medium">
              تم إلغاء هذا التقرير
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => {
                const cfg = ACTION_CONFIG[action];
                return (
                  <Button
                    key={action}
                    variant={cfg.variant}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setConfirmAction(action)}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Audit Log */}
          {report.auditLog.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">سجل التدقيق</p>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {[...report.auditLog].reverse().map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <span className="font-medium">{entry.details}</span>
                      <span className="text-muted-foreground mr-2">
                        — {entry.performedBy} · {formatDate(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => { setConfirmAction(null); setDetails(""); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              تأكيد: {confirmAction && ACTION_CONFIG[confirmAction].label}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="ملاحظات (اختياري)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmAction(null); setDetails(""); }}>
              إلغاء
            </Button>
            <Button onClick={handleExecute}>تأكيد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
