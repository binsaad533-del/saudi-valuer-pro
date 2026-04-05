/**
 * LightValidationAlerts — تنبيهات خفيفة بناءً على المعرفة المهنية
 * Shows simple non-blocking warnings based on knowledge base rules.
 * Embed in any workflow stage for contextual guidance.
 */
import { useState, useEffect } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Alert {
  id: string;
  message: string;
  severity: "warning" | "info";
}

interface Props {
  /** Current workflow stage */
  stage: "asset_extraction" | "asset_review" | "valuation_calculation" | "report_generation" | "report_issuance";
  /** Context data to check against (e.g. { purpose: "", assumptions: [] }) */
  context?: Record<string, unknown>;
  className?: string;
}

/** Simple field-presence checks per stage */
const STAGE_CHECKS: Record<string, { field: string; message: string }[]> = {
  asset_extraction: [
    { field: "assets", message: "لم يتم استخراج أي أصول بعد" },
  ],
  asset_review: [
    { field: "reviewed", message: "بعض الأصول لم تتم مراجعتها بعد" },
  ],
  valuation_calculation: [
    { field: "purpose", message: "غرض التقييم غير محدد — مطلوب حسب المعايير المهنية" },
    { field: "assumptions", message: "لم يتم توثيق الافتراضات والمحددات" },
    { field: "methodology", message: "لم يتم تحديد منهجية التقييم" },
  ],
  report_generation: [
    { field: "purpose", message: "غرض التقييم مفقود في التقرير" },
    { field: "scope", message: "نطاق العمل غير محدد" },
    { field: "assumptions", message: "الافتراضات غير مكتملة" },
  ],
  report_issuance: [
    { field: "final_value", message: "القيمة النهائية غير معتمدة" },
    { field: "compliance_passed", message: "لم يتم إجراء فحص الامتثال" },
  ],
};

export default function LightValidationAlerts({ stage, context, className }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [ruleCount, setRuleCount] = useState(0);

  useEffect(() => {
    const generateAlerts = async () => {
      const newAlerts: Alert[] = [];

      // 1. Check basic field presence from context
      const checks = STAGE_CHECKS[stage] || [];
      for (const check of checks) {
        const value = context?.[check.field];
        const isEmpty = !value || (Array.isArray(value) && value.length === 0) || value === "";
        if (isEmpty) {
          newAlerts.push({
            id: check.field,
            message: check.message,
            severity: "warning",
          });
        }
      }

      // 2. Check how many active rules exist for this stage
      const { count } = await supabase
        .from("raqeem_rules")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .contains("enforcement_stage", [stage]);

      setRuleCount(count || 0);

      // 3. If rules exist, add an info message
      if ((count || 0) > 0 && newAlerts.length === 0) {
        newAlerts.push({
          id: "rules-active",
          message: `${count} قاعدة مهنية فعّالة لهذه المرحلة — الذكاء الاصطناعي يتبعها تلقائياً`,
          severity: "info",
        });
      }

      setAlerts(newAlerts);
    };

    generateAlerts();
  }, [stage, context]);

  if (alerts.length === 0) return null;

  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs
            ${alert.severity === "warning"
              ? "bg-warning/10 text-warning border border-warning/20"
              : "bg-primary/5 text-muted-foreground border border-primary/10"}`}
        >
          {alert.severity === "warning" ? (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          )}
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  );
}
