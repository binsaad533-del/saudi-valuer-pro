/**
 * لوحة الحكم المهني — Professional Judgment Panel
 * واجهة المقيّم المعتمد لمراجعة مخرجات الذكاء الاصطناعي وتطبيق الحكم المهني
 * وفق معيار IVS 105 (حظر الصندوق الأسود)
 */
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Gavel, AlertTriangle, CheckCircle2, ShieldAlert, Brain,
  Loader2, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Info, Scale,
} from "lucide-react";
import type { InspectionType } from "@/lib/sow-engine";

interface ProfessionalJudgmentPanelProps {
  request: any;
  userId: string;
  onStatusChange?: () => void;
}

interface AdjustmentEntry {
  id: string;
  label: string;
  aiSuggested: number;
  appraiserValue: number;
  justification: string;
  isRiskPremium?: boolean;
}

/** Risk premium suggestions based on inspection type */
const RISK_SUGGESTIONS: Record<InspectionType, { riskPremium: number; depreciationAdj: number; note: string }> = {
  field: {
    riskPremium: 0,
    depreciationAdj: 0,
    note: "معاينة ميدانية — لا حاجة لعلاوة مخاطر إضافية",
  },
  desktop_with_photos: {
    riskPremium: 3,
    depreciationAdj: 5,
    note: "تقييم مكتبي بصور — يُقترح علاوة مخاطر 3% وزيادة إهلاك 5% لتعويض غياب الفحص المباشر",
  },
  desktop_without_photos: {
    riskPremium: 7,
    depreciationAdj: 10,
    note: "تقييم مكتبي بدون صور — يُقترح علاوة مخاطر 7% وزيادة إهلاك 10% لتعويض غياب أي فحص بصري",
  },
};

const DEFAULT_ADJUSTMENTS: AdjustmentEntry[] = [
  { id: "location", label: "تعديل الموقع", aiSuggested: 0, appraiserValue: 0, justification: "" },
  { id: "condition", label: "تعديل الحالة المادية", aiSuggested: 0, appraiserValue: 0, justification: "" },
  { id: "area", label: "تعديل المساحة", aiSuggested: 0, appraiserValue: 0, justification: "" },
  { id: "age", label: "تعديل العمر الزمني", aiSuggested: 0, appraiserValue: 0, justification: "" },
  { id: "market", label: "تعديل ظروف السوق", aiSuggested: 0, appraiserValue: 0, justification: "" },
];

function deriveInspectionType(request: any): InspectionType {
  const it = request.inspection_type;
  if (it === "desktop_with_photos" || it === "desktop_without_photos" || it === "field") return it;
  const mode = request.valuation_mode || request.ai_intake_summary?.valuation_mode;
  if (mode === "desktop") return "desktop_without_photos";
  return "field";
}

export default function ProfessionalJudgmentPanel({ request, userId, onStatusChange }: ProfessionalJudgmentPanelProps) {
  const inspType = deriveInspectionType(request);
  const riskSuggestion = RISK_SUGGESTIONS[inspType];

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adjustments, setAdjustments] = useState<AdjustmentEntry[]>(() => {
    const base = [...DEFAULT_ADJUSTMENTS];
    if (inspType !== "field") {
      base.push({
        id: "risk_premium",
        label: "علاوة المخاطر (Risk Premium)",
        aiSuggested: riskSuggestion.riskPremium,
        appraiserValue: riskSuggestion.riskPremium,
        justification: "",
        isRiskPremium: true,
      });
      base.push({
        id: "depreciation_adj",
        label: "تعديل الإهلاك الإضافي",
        aiSuggested: riskSuggestion.depreciationAdj,
        appraiserValue: riskSuggestion.depreciationAdj,
        justification: "",
      });
    }
    return base;
  });
  const [overallJustification, setOverallJustification] = useState("");
  const [methodologyNote, setMethodologyNote] = useState("");

  const hasModifications = useMemo(() => {
    return adjustments.some(a => a.appraiserValue !== a.aiSuggested) || overallJustification.trim() !== "";
  }, [adjustments, overallJustification]);

  // Only show for requests in appropriate statuses
  const showPanel = ["in_production", "fully_paid", "partially_paid", "valuation_in_progress", "inspection_submitted"].includes(request.status);
  if (!showPanel) return null;

  const updateAdjustment = (id: string, field: keyof AdjustmentEntry, value: any) => {
    setAdjustments(prev =>
      prev.map(a => a.id === id ? { ...a, [field]: value } : a)
    );
  };




  const saveJudgment = async () => {
    if (!overallJustification.trim()) {
      toast.error("يجب كتابة المبرر المهني العام قبل الحفظ");
      return;
    }

    setSaving(true);
    try {
      // Save professional judgment data to the request
      await supabase.from("valuation_requests" as any).update({
        professional_judgment: {
          adjustments: adjustments.map(a => ({
            id: a.id,
            label: a.label,
            ai_suggested: a.aiSuggested,
            appraiser_value: a.appraiserValue,
            justification: a.justification,
            is_risk_premium: a.isRiskPremium || false,
          })),
          overall_justification: overallJustification,
          methodology_note: methodologyNote,
          inspection_type: inspType,
          risk_premium_applied: riskSuggestion.riskPremium,
          appraiser_id: userId,
          judgment_date: new Date().toISOString(),
        },
        status: "draft_report_ready" as any,
      } as any).eq("id", request.id);

      // Log system message
      await supabase.from("request_messages" as any).insert({
        request_id: request.id,
        sender_type: "system" as any,
        content: `⚖️ تم تطبيق الحكم المهني من قبل المقيّم المعتمد — ${adjustments.filter(a => a.appraiserValue !== a.aiSuggested).length} تعديل على مؤشرات الذكاء الاصطناعي`,
      });

      toast.success("تم حفظ الحكم المهني وتحويل الطلب لمرحلة إعداد المسودة");
      onStatusChange?.();
    } catch (err: any) {
      toast.error("خطأ: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-card border-primary/20">
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full"
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Gavel className="w-4 h-4 text-primary" />
            الحكم المهني (IVS 105)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {inspType === "field" ? "ميداني" : inspType === "desktop_with_photos" ? "مكتبي + صور" : "مكتبي فقط"}
            </Badge>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-2">
          {/* IVS 105 Notice */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-start gap-2">
              <Scale className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-foreground">معيار IVS 105 — النماذج الآلية</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-4">
                  يمنع المعيار إصدار تقييم نهائي من الذكاء الاصطناعي دون تدخل بشري.
                  راجع مؤشرات النظام وطبّق حكمك المهني على كل تسوية.
                </p>
              </div>
            </div>
          </div>

          {/* Risk Premium Alert for Desktop */}
          {inspType !== "field" && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-400">اقتراح علاوة مخاطر</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-4 mt-0.5">
                    {riskSuggestion.note}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Adjustments Table */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-foreground">التسويات والتعديلات</p>
            <div className="space-y-2">
              {adjustments.map(adj => (
                <div key={adj.id} className={`p-3 rounded-lg border ${adj.isRiskPremium ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10" : "border-border bg-card"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground">{adj.label}</span>
                    <div className="flex items-center gap-2">
                      {adj.appraiserValue !== adj.aiSuggested && (
                        <Badge variant="secondary" className="text-[9px] gap-0.5">
                          {adj.appraiserValue > adj.aiSuggested ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                          معدّل
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">اقتراح الذكاء الاصطناعي</label>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Brain className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-mono text-muted-foreground">{adj.aiSuggested}%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">قرار المقيّم</label>
                      <Input
                        type="number"
                        value={adj.appraiserValue}
                        onChange={e => updateAdjustment(adj.id, "appraiserValue", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs mt-0.5"
                        step="0.5"
                      />
                    </div>
                  </div>
                  {adj.appraiserValue !== adj.aiSuggested && (
                    <Textarea
                      value={adj.justification}
                      onChange={e => updateAdjustment(adj.id, "justification", e.target.value)}
                      placeholder="سبب التعديل (إلزامي عند الاختلاف)..."
                      className="text-xs min-h-[48px] resize-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Methodology Note */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">ملاحظات المنهجية</label>
            <Textarea
              value={methodologyNote}
              onChange={e => setMethodologyNote(e.target.value)}
              placeholder="ملاحظات حول المنهجية المستخدمة (اختياري)..."
              className="text-xs min-h-[48px] resize-none"
            />
          </div>

          {/* Overall Justification */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              المبرر المهني العام <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={overallJustification}
              onChange={e => setOverallJustification(e.target.value)}
              placeholder="اكتب مبررك المهني الشامل لقراراتك وتعديلاتك على مؤشرات الذكاء الاصطناعي..."
              className="text-xs min-h-[72px] resize-none"
            />
          </div>

          {/* Summary */}
          {hasModifications && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-bold text-primary">ملخص التعديلات</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {adjustments.filter(a => a.appraiserValue !== a.aiSuggested).length} تعديل على مؤشرات AI
                {inspType !== "field" && ` • علاوة مخاطر ${adjustments.find(a => a.id === "risk_premium")?.appraiserValue || 0}%`}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1 text-xs h-9"
              onClick={saveJudgment}
              disabled={saving || !overallJustification.trim()}
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />جاري الحفظ...</>
              ) : (
                <><Gavel className="w-3.5 h-3.5 ml-1" />اعتماد الحكم المهني</>
              )}
            </Button>
          </div>

          {/* Missing justification warning */}
          {adjustments.some(a => a.appraiserValue !== a.aiSuggested && !a.justification.trim()) && (
            <div className="flex items-center gap-2 text-[10px] text-amber-600">
              <AlertTriangle className="w-3 h-3" />
              <span>بعض التعديلات تفتقر لمبرر — يُنصح بتوضيح سبب كل تعديل</span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
