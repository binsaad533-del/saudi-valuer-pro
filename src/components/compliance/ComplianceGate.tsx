/**
 * ComplianceGate — بوابة الامتثال المهني
 * 
 * Two modes:
 * - Warning rules: show alerts only, don't block
 * - Critical (blocking) rules: prevent action with clear message
 * 
 * Usage:
 *   <ComplianceGate stage="report_issuance" context={{ purpose: "", assumptions: [] }}>
 *     <Button onClick={issueReport}>إصدار التقرير</Button>
 *   </ComplianceGate>
 */
import { useState, useEffect, ReactNode } from "react";
import { AlertTriangle, ShieldAlert, ShieldCheck, Info, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type GateStage =
  | "asset_extraction"
  | "asset_review"
  | "valuation_calculation"
  | "report_generation"
  | "report_issuance";

interface GateAlert {
  id: string;
  message: string;
  severity: "warning" | "blocking" | "info";
}

interface Props {
  stage: GateStage;
  context?: Record<string, unknown>;
  children?: ReactNode;
  className?: string;
  /** If true, only show alerts without wrapping children */
  alertsOnly?: boolean;
}

/* ── Built-in critical checks (always enforced) ── */
const CRITICAL_CHECKS: Record<string, { field: string; message: string }[]> = {
  valuation_calculation: [
    { field: "purpose", message: "لا يمكن بدء التقييم بدون تحديد غرض التقييم" },
    { field: "basis_of_value", message: "أساس القيمة مطلوب قبل بدء التقييم" },
    { field: "valuation_date", message: "تاريخ التقييم مطلوب" },
  ],
  report_generation: [
    { field: "purpose", message: "غرض التقييم مطلوب في التقرير" },
    { field: "basis_of_value", message: "أساس القيمة مطلوب في التقرير" },
    { field: "asset_identification", message: "تحديد الأصل غير واضح" },
    { field: "assumptions", message: "الافتراضات والمحددات مطلوبة" },
  ],
  report_issuance: [
    { field: "final_value", message: "لا يمكن إصدار التقرير بدون اعتماد القيمة النهائية" },
    { field: "purpose", message: "لا يمكن إصدار التقرير بدون تحديد غرض التقييم" },
    { field: "basis_of_value", message: "لا يمكن إصدار التقرير قبل تحديد أساس القيمة" },
    { field: "assumptions", message: "لا يمكن إصدار التقرير بدون توثيق الافتراضات" },
    { field: "owner_approved", message: "يجب اعتماد القيمة النهائية من المالك قبل الإصدار" },
    { field: "compliance_passed", message: "يجب اجتياز فحص الامتثال قبل إصدار التقرير" },
  ],
};

/* ── Warning-only checks (all stages) ── */
const WARNING_CHECKS: Record<string, { field: string; message: string }[]> = {
  asset_extraction: [
    { field: "assets", message: "لم يتم استخراج أي أصول بعد" },
  ],
  asset_review: [
    { field: "reviewed", message: "بعض الأصول لم تتم مراجعتها بعد" },
  ],
  valuation_calculation: [
    { field: "methodology", message: "لم يتم تحديد منهجية التقييم" },
    { field: "scope", message: "نطاق العمل غير محدد" },
  ],
  report_generation: [
    { field: "scope", message: "نطاق العمل غير محدد — يُنصح بإضافته" },
  ],
  report_issuance: [],
};

function isEmpty(value: unknown): boolean {
  if (!value) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (value === "") return true;
  if (value === false) return true;
  return false;
}

export default function ComplianceGate({ stage, context, children, className, alertsOnly }: Props) {
  const [alerts, setAlerts] = useState<GateAlert[]>([]);
  const [dbRuleCount, setDbRuleCount] = useState(0);

  const hasBlockers = alerts.some((a) => a.severity === "blocking");

  useEffect(() => {
    const evaluate = async () => {
      const newAlerts: GateAlert[] = [];

      // 1. Critical checks — block if missing
      const criticals = CRITICAL_CHECKS[stage] || [];
      for (const check of criticals) {
        if (isEmpty(context?.[check.field])) {
          newAlerts.push({ id: `c-${check.field}`, message: check.message, severity: "blocking" });
        }
      }

      // 2. Warning checks — alert only
      const warnings = WARNING_CHECKS[stage] || [];
      for (const check of warnings) {
        if (isEmpty(context?.[check.field])) {
          newAlerts.push({ id: `w-${check.field}`, message: check.message, severity: "warning" });
        }
      }

      // 3. Check DB rules count for this stage
      const { count } = await supabase
        .from("raqeem_rules")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .contains("enforcement_stage", [stage]);

      setDbRuleCount(count || 0);

      // 4. If DB has blocking rules and no context provided, add generic info
      if ((count || 0) > 0 && newAlerts.length === 0) {
        newAlerts.push({
          id: "rules-ok",
          message: `${count} قاعدة مهنية فعّالة — الذكاء الاصطناعي يراقب الامتثال تلقائياً`,
          severity: "info",
        });
      }

      setAlerts(newAlerts);
    };

    evaluate();
  }, [stage, context]);

  if (alerts.length === 0 && !children) return null;

  return (
    <div className={className || ""}>
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs
                ${alert.severity === "blocking"
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : alert.severity === "warning"
                    ? "bg-warning/10 text-warning border border-warning/20"
                    : "bg-primary/5 text-muted-foreground border border-primary/10"}`}
            >
              {alert.severity === "blocking" ? (
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              ) : alert.severity === "warning" ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              )}
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Children — disabled if blockers exist */}
      {!alertsOnly && children && (
        <div className={hasBlockers ? "opacity-50 pointer-events-none" : ""}>
          {children}
        </div>
      )}

      {/* Blocker summary */}
      {hasBlockers && !alertsOnly && (
        <p className="text-[10px] text-destructive mt-1.5 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" />
          يجب استيفاء المتطلبات الحرجة أعلاه للمتابعة
        </p>
      )}
    </div>
  );
}
