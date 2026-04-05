import { useState } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, AlertTriangle,
  CheckCircle2, XCircle, Loader2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  runComplianceCheck,
  type ComplianceReport,
  type ComplianceStage,
  STAGE_LABELS,
} from "@/lib/compliance-engine";
import { toast } from "sonner";

interface Props {
  assignmentId: string;
  stage: ComplianceStage;
  onResult?: (report: ComplianceReport) => void;
  compact?: boolean;
}

export default function ComplianceStatusPanel({
  assignmentId,
  stage,
  onResult,
  compact = false,
}: Props) {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    try {
      const result = await runComplianceCheck(assignmentId, stage);
      setReport(result);
      onResult?.(result);

      if (result.can_proceed) {
        toast.success("اجتاز فحص الامتثال بنجاح");
      } else {
        toast.error(`${result.blockers} انتهاك حرج يمنع المتابعة`);
      }
    } catch (err: any) {
      toast.error(err.message || "خطأ في فحص الامتثال");
    } finally {
      setLoading(false);
    }
  };

  if (compact && !report) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={runCheck}
        disabled={loading}
        className="gap-1.5 text-xs"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Shield className="w-3.5 h-3.5" />
        )}
        فحص الامتثال
      </Button>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {report ? (
            report.can_proceed ? (
              <ShieldCheck className="w-4 h-4 text-success" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-destructive" />
            )
          ) : (
            <Shield className="w-4 h-4 text-muted-foreground" />
          )}
          <h3 className="text-sm font-semibold text-foreground">
            فحص الامتثال — {STAGE_LABELS[stage].ar}
          </h3>
        </div>
        <Button
          variant={report ? "outline" : "default"}
          size="sm"
          onClick={runCheck}
          disabled={loading}
          className="gap-1.5 text-xs h-8"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Shield className="w-3.5 h-3.5" />
          )}
          {report ? "إعادة الفحص" : "بدء الفحص"}
        </Button>
      </div>

      {/* Results Summary */}
      {report && (
        <>
          <div className="px-4 py-3 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              <span className="text-muted-foreground">نجح:</span>
              <span className="font-semibold text-foreground">{report.passed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              <span className="text-muted-foreground">تحذير:</span>
              <span className="font-semibold text-foreground">
                {report.failed - report.blockers}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-muted-foreground">حرج:</span>
              <span className="font-semibold text-foreground">{report.blockers}</span>
            </div>

            <div className="flex-1" />

            <Badge
              variant={report.can_proceed ? "default" : "destructive"}
              className="text-[10px]"
            >
              {report.can_proceed ? "يمكن المتابعة" : "محظور"}
            </Badge>

            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {/* Detailed Results */}
          {expanded && (
            <div className="border-t border-border max-h-60 overflow-y-auto">
              {report.results
                .sort((a, b) => {
                  if (a.passed === b.passed) return 0;
                  return a.passed ? 1 : -1;
                })
                .map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-4 py-2 text-xs border-b border-border/50 last:border-0
                      ${!r.passed && r.severity === "blocking" ? "bg-destructive/5" : ""}
                      ${!r.passed && r.severity === "warning" ? "bg-warning/5" : ""}`}
                  >
                    {r.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                    ) : r.severity === "blocking" ? (
                      <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{r.rule_title_ar}</p>
                      {r.violation_message && !r.passed && (
                        <p className="text-muted-foreground mt-0.5">{r.violation_message}</p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 ${
                        r.severity === "blocking"
                          ? "border-destructive text-destructive"
                          : "border-warning text-warning"
                      }`}
                    >
                      {r.severity === "blocking" ? "حرج" : "تحذير"}
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
