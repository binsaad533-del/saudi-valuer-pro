import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  runFullValidation,
  type ValidationResult,
  type ValidationStatus,
  type FlagSeverity,
} from "@/lib/validation-engine";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Lock,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ValidationPanelProps {
  assignmentId: string;
}

const STATUS_CONFIG: Record<ValidationStatus, { icon: React.ElementType; label_ar: string; color: string; bg: string }> = {
  APPROVED: { icon: ShieldCheck, label_ar: "معتمد — جاهز للإصدار", color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" },
  NEEDS_REVIEW: { icon: ShieldAlert, label_ar: "يحتاج مراجعة", color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" },
  REJECTED: { icon: ShieldX, label_ar: "مرفوض — لا يمكن الإصدار", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" },
};

const SEVERITY_ICON: Record<FlagSeverity, React.ElementType> = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const PART_LABELS: Record<string, string> = {
  input: "التحقق من المدخلات",
  comparables: "التحقق من المقارنات",
  adjustments: "التحقق من التعديلات",
  results: "التحقق من النتائج",
  methods: "التحقق من المنهجية",
  compliance: "الامتثال (IVS + تقييم)",
  inspection: "المعاينة الميدانية",
};

export default function ValidationPanel({ assignmentId }: ValidationPanelProps) {
  const { toast } = useToast();
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);
  const [expandedParts, setExpandedParts] = useState<Record<string, boolean>>({});

  const runValidation = async () => {
    setLoading(true);
    try {
      // Fetch all required data
      const [aRes, compRes, adjRes, methRes, reconRes, repRes, insRes, subRes, insPhotosRes, insCheckRes, insAnalysisRes] = await Promise.all([
        supabase.from("valuation_assignments").select("*").eq("id", assignmentId).single(),
        supabase.from("comparables").select("*").limit(20),
        supabase.from("comparable_adjustments").select("*").limit(100),
        supabase.from("valuation_methods" as any).select("*").eq("assignment_id", assignmentId),
        supabase.from("reconciliation_results").select("*").eq("assignment_id", assignmentId).maybeSingle(),
        supabase.from("reports").select("*").eq("assignment_id", assignmentId).order("version", { ascending: false }).limit(1),
        supabase.from("inspections").select("*").eq("assignment_id", assignmentId).order("created_at", { ascending: false }).limit(1),
        supabase.from("subjects" as any).select("*").eq("assignment_id", assignmentId).limit(1),
        supabase.from("inspection_photos").select("*").eq("inspection_id", assignmentId).limit(50),
        supabase.from("inspection_checklist_items").select("*").limit(50),
        supabase.from("inspection_analysis").select("*").eq("assignment_id", assignmentId).maybeSingle(),
      ]);

      // Get inspection photos by inspection ID if we have an inspection
      const inspectionRecord = (insRes.data as any)?.[0] || null;
      let inspectionPhotos: any[] = [];
      let inspectionChecklist: any[] = [];
      if (inspectionRecord?.id) {
        const [photosRes, checklistRes] = await Promise.all([
          supabase.from("inspection_photos").select("*").eq("inspection_id", inspectionRecord.id),
          supabase.from("inspection_checklist_items").select("*").eq("inspection_id", inspectionRecord.id),
        ]);
        inspectionPhotos = (photosRes.data as any[]) || [];
        inspectionChecklist = (checklistRes.data as any[]) || [];
      }

      const validationResult = runFullValidation({
        assignment: aRes.data,
        subject: (subRes.data as any)?.[0] || null,
        comparables: (compRes.data as any[]) || [],
        adjustments: (adjRes.data as any[]) || [],
        methods: (methRes.data as any[]) || [],
        reconciliation: reconRes.data,
        report: (repRes.data as any)?.[0] || null,
        inspection: inspectionRecord,
        inspectionAnalysis: insAnalysisRes.data || null,
        inspectionPhotos,
        inspectionChecklist,
      });

      setResult(validationResult);

      // Log validation
      await supabase.from("audit_logs").insert({
        table_name: "valuation_assignments",
        action: "update" as any,
        record_id: assignmentId,
        assignment_id: assignmentId,
        description: `Validation engine: ${validationResult.status} (${validationResult.summary.errors} errors, ${validationResult.summary.warnings} warnings)`,
        new_data: { validation_status: validationResult.status, errors: validationResult.summary.errors, warnings: validationResult.summary.warnings },
      });

      toast({
        title: validationResult.status === "APPROVED" ? "✅ اجتاز التحقق" : validationResult.status === "NEEDS_REVIEW" ? "⚠️ يحتاج مراجعة" : "❌ لم يجتز التحقق",
        description: `${validationResult.summary.errors} أخطاء، ${validationResult.summary.warnings} تحذيرات`,
        variant: validationResult.status === "REJECTED" ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({ title: "خطأ في التحقق", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideReason.trim() || !result) return;
    setOverriding(true);
    try {
      await supabase.from("audit_logs").insert({
        table_name: "valuation_assignments",
        action: "update" as any,
        record_id: assignmentId,
        assignment_id: assignmentId,
        description: `Admin override: validation NEEDS_REVIEW → APPROVED. Reason: ${overrideReason}`,
        new_data: { override_reason: overrideReason, original_status: result.status },
      });

      setResult({ ...result, status: "APPROVED", can_issue: true, override_allowed: false });
      toast({ title: "✅ تم التجاوز الإداري", description: "يمكن الآن إصدار التقرير" });
      setOverrideReason("");
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setOverriding(false);
    }
  };

  const togglePart = (part: string) => {
    setExpandedParts(prev => ({ ...prev, [part]: !prev[part] }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          محرك التحقق من التقييم
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Run button */}
        <Button onClick={runValidation} disabled={loading} className="w-full gap-2">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> جاري التحقق...</>
          ) : (
            <><ShieldCheck className="w-4 h-4" /> تشغيل محرك التحقق</>
          )}
        </Button>

        {result && (
          <>
            {/* Status banner */}
            {(() => {
              const config = STATUS_CONFIG[result.status];
              const StatusIcon = config.icon;
              return (
                <div className={`rounded-lg border p-4 flex items-center gap-3 ${config.bg}`}>
                  <StatusIcon className={`w-8 h-8 ${config.color}`} />
                  <div>
                    <p className={`font-bold text-lg ${config.color}`}>{config.label_ar}</p>
                    <p className="text-sm text-muted-foreground">
                      {result.summary.errors} أخطاء · {result.summary.warnings} تحذيرات · {result.summary.passed} معلومات
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <p className="text-2xl font-bold text-red-600">{result.summary.errors}</p>
                <p className="text-xs text-muted-foreground">أخطاء</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                <p className="text-2xl font-bold text-yellow-600">{result.summary.warnings}</p>
                <p className="text-xs text-muted-foreground">تحذيرات</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <p className="text-2xl font-bold text-blue-600">{result.summary.passed}</p>
                <p className="text-xs text-muted-foreground">معلومات</p>
              </div>
            </div>

            <Separator />

            {/* Part-by-part results */}
            <div className="space-y-2">
              {Object.entries(result.parts).map(([partKey, partResult]) => {
                const isOpen = expandedParts[partKey];
                const hasErrors = partResult.flags.some(f => f.severity === "error");
                const hasWarnings = partResult.flags.some(f => f.severity === "warning");

                return (
                  <Collapsible key={partKey} open={isOpen} onOpenChange={() => togglePart(partKey)}>
                    <CollapsibleTrigger asChild>
                      <button className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-muted/30 ${hasErrors ? "border-red-200 dark:border-red-800" : hasWarnings ? "border-yellow-200 dark:border-yellow-800" : "border-green-200 dark:border-green-800"}`}>
                        {partResult.passed ? (
                          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                        ) : hasErrors ? (
                          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                        )}
                        <span className="flex-1 text-sm font-medium text-right">{PART_LABELS[partKey] || partKey}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {partResult.flags.length} فحص
                        </Badge>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mr-8 mt-1 space-y-1 pb-2">
                        {partResult.flags.length === 0 ? (
                          <p className="text-xs text-green-600 pr-3">✓ اجتاز جميع الفحوصات</p>
                        ) : (
                          partResult.flags.map((flag, i) => {
                            const SevIcon = SEVERITY_ICON[flag.severity];
                            return (
                              <div key={i} className="flex items-start gap-2 pr-3 py-1.5 rounded text-sm">
                                <SevIcon className={`w-4 h-4 shrink-0 mt-0.5 ${flag.severity === "error" ? "text-red-500" : flag.severity === "warning" ? "text-yellow-500" : "text-blue-500"}`} />
                                <div>
                                  <p className="text-sm">{flag.message_ar}</p>
                                  <p className="text-[11px] text-muted-foreground" dir="ltr">{flag.code}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>

            {/* Admin Override */}
            {result.override_allowed && result.status === "NEEDS_REVIEW" && (
              <>
                <Separator />
                <div className="space-y-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-yellow-600" />
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">تجاوز إداري</p>
                  </div>
                  <p className="text-xs text-muted-foreground">يمكن للمسؤول تجاوز التحذيرات مع تقديم مبرر مكتوب. سيتم تسجيل ذلك في سجل التدقيق.</p>
                  <Textarea
                    placeholder="اكتب مبرر التجاوز الإداري..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="text-sm"
                    rows={3}
                  />
                  <Button
                    onClick={handleOverride}
                    disabled={!overrideReason.trim() || overriding}
                    variant="outline"
                    className="w-full gap-2 border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:text-yellow-300 dark:hover:bg-yellow-950"
                  >
                    {overriding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                    تأكيد التجاوز الإداري
                  </Button>
                </div>
              </>
            )}

            {/* Issuance block */}
            {result.status === "REJECTED" && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                <Lock className="w-6 h-6 text-red-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-red-800 dark:text-red-300">لا يمكن إصدار التقرير</p>
                <p className="text-xs text-muted-foreground mt-1">يجب معالجة جميع الأخطاء أولاً</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
