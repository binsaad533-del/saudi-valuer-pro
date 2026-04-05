import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Eye,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import {
  generateFullReport,
  downloadBlob,
  type FullReportData,
} from "@/services/fullReportGenerator";
import { calculateConfidence } from "@/lib/confidence-scoring";
import { detectRisks, type RiskContext } from "@/lib/risk-detection";
import { evaluateDecision } from "@/lib/decision-engine";

interface Props {
  reportData: FullReportData;
  riskContext: RiskContext;
  compliancePassed: boolean;
}

const REQUIRED_CHECKS = [
  { key: "purpose", label: "الغرض من التقييم", check: (d: FullReportData) => !!d.valuation.purpose },
  { key: "basis", label: "أساس القيمة", check: (d: FullReportData) => !!d.valuation.basisOfValue },
  { key: "date", label: "تاريخ التقييم", check: (d: FullReportData) => !!d.valuationDate },
  { key: "asset", label: "بيانات الأصل", check: (d: FullReportData) => !!d.property.type && !!d.property.city },
  { key: "value", label: "القيمة النهائية", check: (d: FullReportData) => d.valuation.estimatedValue > 0 },
  { key: "method", label: "المنهجية", check: (d: FullReportData) => !!d.valuation.approach },
] as const;

export default function ReportGeneratorPanel({
  reportData,
  riskContext,
  compliancePassed,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const checks = useMemo(
    () => REQUIRED_CHECKS.map((c) => ({ ...c, passed: c.check(reportData) })),
    [reportData]
  );

  const allPassed = checks.every((c) => c.passed);
  const canGenerate = allPassed && compliancePassed;

  // Enrich report data with live confidence/risk/decision
  const enrichedData = useMemo(() => {
    const confidence = calculateConfidence(riskContext);
    const risks = detectRisks(riskContext);
    const decision = evaluateDecision(compliancePassed, confidence, risks);
    return { ...reportData, confidence, risks, decision };
  }, [reportData, riskContext, compliancePassed]);

  const handleGenerate = useCallback(
    async (download: boolean) => {
      if (!canGenerate) {
        toast.error("لا يمكن إنشاء التقرير — تحقق من المتطلبات");
        return;
      }
      setGenerating(true);
      try {
        const blob = await generateFullReport(enrichedData);

        if (download) {
          downloadBlob(blob, `${reportData.reportNumber}.pdf`);
          toast.success("تم تحميل التقرير بنجاح");
        } else {
          // Preview
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          window.open(url, "_blank");
          toast.success("تم إنشاء المعاينة");
        }
      } catch (e) {
        console.error(e);
        toast.error("فشل في إنشاء التقرير");
      } finally {
        setGenerating(false);
      }
    },
    [canGenerate, enrichedData, reportData.reportNumber, previewUrl]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            إنشاء التقرير النهائي
          </span>
          <Badge
            variant="outline"
            className={
              reportData.isDraft
                ? "bg-amber-500/10 text-amber-600 border-amber-200"
                : "bg-green-500/10 text-green-600 border-green-200"
            }
          >
            {reportData.isDraft ? "مسودة" : "نهائي"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Readiness checklist */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            متطلبات الإنشاء:
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {checks.map((c) => (
              <div
                key={c.key}
                className="flex items-center gap-1.5 text-xs"
              >
                {c.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
                )}
                <span
                  className={
                    c.passed ? "text-foreground" : "text-red-600 font-medium"
                  }
                >
                  {c.label}
                </span>
              </div>
            ))}
          </div>

          {/* Compliance status */}
          <div className="flex items-center gap-1.5 text-xs mt-1">
            {compliancePassed ? (
              <ShieldCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
            )}
            <span
              className={
                compliancePassed
                  ? "text-foreground"
                  : "text-red-600 font-medium"
              }
            >
              فحص الامتثال
            </span>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={!canGenerate || generating}
            onClick={() => handleGenerate(false)}
          >
            {generating ? (
              <Loader2 className="w-4 h-4 ml-1 animate-spin" />
            ) : (
              <Eye className="w-4 h-4 ml-1" />
            )}
            معاينة
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canGenerate || generating}
            onClick={() => handleGenerate(true)}
          >
            <Download className="w-4 h-4 ml-1" />
            تحميل PDF
          </Button>
        </div>

        {!canGenerate && (
          <p className="text-xs text-red-600">
            لا يمكن إنشاء التقرير قبل استيفاء جميع المتطلبات
          </p>
        )}
      </CardContent>
    </Card>
  );
}
