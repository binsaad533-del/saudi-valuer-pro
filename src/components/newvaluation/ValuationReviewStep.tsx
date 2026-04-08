import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Tag } from "lucide-react";
import { formatTime } from "@/lib/utils";

interface ActivityEntry {
  step: number;
  action: string;
  timestamp: Date;
}

interface StepValidation {
  step: { id: number; label: string };
  validation: { valid: boolean; errors: string[]; warnings: string[] };
}

interface ValuationReviewStepProps {
  extracted: any;
  clientFields: Record<string, string>;
  uploadedFiles: any[];
  assetDescription: string;
  purpose: string;
  valueBasis: string;
  valuationDate: string;
  valuationMode: string;
  classifiedCount: number;
  allStepValidations: StepValidation[];
  activityLog: ActivityEntry[];
  docCategories: { value: string; label: string }[];
}

export default function ValuationReviewStep({
  extracted, clientFields, uploadedFiles, assetDescription,
  purpose, valueBasis, valuationDate, valuationMode, classifiedCount,
  allStepValidations, activityLog, docCategories,
}: ValuationReviewStepProps) {
  const reviewItems = [
    { label: "نوع التقييم (ذكاء اصطناعي)", value: extracted?.discipline_label || "-" },
    { label: "طريقة التقييم", value: valuationMode === "desktop" ? "📋 تقييم مكتبي" : "🏗️ تقييم ميداني" },
    { label: "مستوى الثقة", value: `${extracted?.confidence || 0}%` },
    { label: "طريقة التحليل", value: extracted?.analysisMethod === "content_analysis" ? "تحليل محتوى فعلي" : "تحليل أسماء الملفات" },
    { label: "العميل", value: clientFields.clientName || "-" },
    { label: "رقم الهوية", value: clientFields.idNumber || "-" },
    { label: "عدد الوثائق", value: `${uploadedFiles.length} ملف (${classifiedCount} مُصنَّف)` },
    { label: "وصف الأصل", value: assetDescription || "-" },
    { label: "غرض التقييم", value: purpose || "-" },
    { label: "أساس القيمة", value: valueBasis },
    { label: "تاريخ التقييم", value: valuationDate || "-" },
  ];

  const hasWarnings = allStepValidations.some(sv => sv.validation.warnings.length > 0);
  const hasErrors = allStepValidations.some(sv => sv.validation.errors.length > 0 && sv.step.id < 4);
  

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-foreground mb-1">المراجعة النهائية</h3>
        <p className="text-sm text-muted-foreground mb-5">راجع البيانات قبل إنشاء ملف التقييم</p>
      </div>

      <div className="space-y-3">
        {reviewItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className="text-sm font-medium text-foreground">{item.value}</span>
          </div>
        ))}
      </div>

      {uploadedFiles.some(f => f.category) && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            ملخص المستندات
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              uploadedFiles.reduce((acc, f) => {
                if (f.category) {
                  const label = f.categoryLabel || docCategories.find(c => c.value === f.category)?.label || f.category;
                  acc[label] = (acc[label] || 0) + 1;
                }
                return acc;
              }, {} as Record<string, number>)
            ).map(([label, count]) => (
              <Badge key={label} variant="secondary" className="text-xs">{label}: {count}</Badge>
            ))}
          </div>
        </div>
      )}

      {hasWarnings && (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 space-y-2">
          <div className="flex items-center gap-2 text-warning font-medium text-sm"><AlertTriangle className="w-4 h-4" /><span>تنبيهات</span></div>
          {allStepValidations.flatMap(sv => sv.validation.warnings.map((w, i) => <p key={`${sv.step.id}-${i}`} className="text-xs text-warning/80 mr-6">• {w}</p>))}
        </div>
      )}

      {hasErrors && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm"><AlertCircle className="w-4 h-4" /><span>بيانات ناقصة</span></div>
          {allStepValidations.filter(sv => sv.step.id < 4).flatMap(sv => sv.validation.errors.map((e, i) => <p key={`${sv.step.id}-${i}`} className="text-xs text-destructive/80 mr-6">• {e}</p>))}
        </div>
      )}

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
        سيتم إنشاء رقم مرجعي فريد وبدء سير العمل التلقائي.
      </div>

      {activityLog.length > 0 && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">سجل النشاط</h4>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {activityLog.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{entry.action}</span>
                <span className="text-muted-foreground/60">{formatTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
