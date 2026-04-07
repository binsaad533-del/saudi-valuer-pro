import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Hand, Loader2 } from "lucide-react";
import { AI_STEPS_WITH_FALLBACK, executeAiStepWithFallback, STATUS_LABELS, normalizeStatus } from "@/lib/workflow-engine";
import { toast } from "sonner";

interface AiFallbackButtonsProps {
  assignmentId: string;
  currentStatus: string;
  onTransition?: () => void;
}

export function AiFallbackButtons({ assignmentId, currentStatus, onTransition }: AiFallbackButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const normalized = normalizeStatus(currentStatus);

  // Find applicable AI steps for current status
  const applicableSteps = Object.entries(AI_STEPS_WITH_FALLBACK).filter(
    ([, step]) => step.from_status === normalized
  );

  if (applicableSteps.length === 0) return null;

  const handleExecute = async (stepKey: string, mode: "ai" | "manual") => {
    setLoading(`${stepKey}-${mode}`);
    const result = await executeAiStepWithFallback(
      assignmentId,
      stepKey as keyof typeof AI_STEPS_WITH_FALLBACK,
      mode
    );
    if (result.success) {
      toast.success(mode === "ai" ? "تم التنفيذ الآلي بنجاح" : "تم التنفيذ اليدوي بنجاح");
      onTransition?.();
    } else {
      toast.error(result.error || "حدث خطأ");
    }
    setLoading(null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="w-4 h-4" />
          خطوات الذكاء الاصطناعي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {applicableSteps.map(([key, step]) => (
          <div key={key} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
            <div className="flex-1">
              <p className="text-xs font-medium">{step.fallback_label_ar}</p>
              <p className="text-[10px] text-muted-foreground">
                {STATUS_LABELS[step.from_status]?.ar} → {STATUS_LABELS[step.to_status]?.ar}
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="default"
                className="text-xs gap-1 h-7"
                disabled={loading !== null}
                onClick={() => handleExecute(key, "ai")}
              >
                {loading === `${key}-ai` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                تلقائي
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1 h-7"
                disabled={loading !== null}
                onClick={() => handleExecute(key, "manual")}
              >
                {loading === `${key}-manual` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Hand className="w-3 h-3" />}
                يدوي
              </Button>
            </div>
          </div>
        ))}
        <Badge variant="outline" className="text-[10px]">
          إذا فشل الوضع التلقائي، استخدم الوضع اليدوي للمتابعة
        </Badge>
      </CardContent>
    </Card>
  );
}
