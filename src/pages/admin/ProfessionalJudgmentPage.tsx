import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ownerApproveDraft } from "@/lib/workflow-engine";
import { logAudit } from "@/lib/audit-logger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";
import {
  ArrowRight, Loader2, Brain, Scale, CheckCircle2, AlertTriangle,
  FileText, BarChart3, Edit3, MessageSquare, Crown,
} from "lucide-react";

interface AssignmentData {
  id: string;
  status: string;
  final_value: number | null;
  methodology: string | null;
  professional_judgment_notes: string | null;
  valuation_mode: string | null;
  fee_amount: number | null;
}

interface RequestData {
  id: string;
  reference_number: string | null;
  property_description_ar: string | null;
  purpose: string | null;
  status: string;
  asset_data: any;
  ai_intake_summary: any;
  assignment_id: string | null;
}

interface ValuationMethod {
  id: string;
  method_name: string;
  method_name_ar: string | null;
  result_value: number | null;
  weight: number | null;
  is_primary: boolean | null;
}

interface Reconciliation {
  final_value: number | null;
  reconciliation_notes: string | null;
  confidence_score: number | null;
}

export default function ProfessionalJudgmentPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState<RequestData | null>(null);
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [methods, setMethods] = useState<ValuationMethod[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);

  // Form state
  const [finalValue, setFinalValue] = useState("");
  const [judgmentNotes, setJudgmentNotes] = useState("");

  useEffect(() => {
    if (requestId) loadData();
  }, [requestId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load request
      const { data: req } = await supabase
        .from("valuation_requests" as any)
        .select("*")
        .eq("id", requestId!)
        .single();

      if (!req) { toast.error("لم يُعثر على الطلب"); navigate(-1); return; }
      setRequest(req as RequestData);

      const assignmentId = (req as any).assignment_id;
      if (!assignmentId) { setLoading(false); return; }

      // Load assignment + methods + reconciliation in parallel
      const [aRes, mRes, recRes] = await Promise.all([
        supabase.from("valuation_assignments").select("*").eq("id", assignmentId).single(),
        supabase.from("valuation_methods").select("*").eq("assignment_id", assignmentId),
        supabase.from("reconciliation_results").select("*").eq("assignment_id", assignmentId).maybeSingle(),
      ]);

      if (aRes.data) {
        setAssignment(aRes.data as any);
        const existingValue = (aRes.data as any).final_value;
        setFinalValue(existingValue ? String(existingValue) : "");
        const existingNotes = (aRes.data as any).professional_judgment_notes;
        if (existingNotes) setJudgmentNotes(existingNotes);
      }
      setMethods((mRes.data || []) as ValuationMethod[]);
      setReconciliation(recRes.data as any || null);
    } catch (e) {
      toast.error("خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!assignment) {
      toast.error("لا يوجد ملف تقييم مرتبط بهذا الطلب");
      return;
    }
    if (!judgmentNotes.trim()) {
      toast.error("يرجى كتابة مبرر الحكم المهني");
      return;
    }

    const parsedValue = parseFloat(finalValue.replace(/,/g, ""));
    if (!parsedValue || parsedValue <= 0) {
      toast.error("يرجى إدخال القيمة النهائية");
      return;
    }

    setSaving(true);
    try {
      // Save final_value + professional_judgment_notes on assignment
      await supabase
        .from("valuation_assignments")
        .update({
          final_value: parsedValue,
          professional_judgment_notes: judgmentNotes,
        } as any)
        .eq("id", assignment.id);

      // Transition status via workflow engine
      const result = await ownerApproveDraft(assignment.id, judgmentNotes);
      if (!result.success) {
        toast.error(result.error || "فشل اعتماد الحكم المهني");
        return;
      }

      // Audit
      await logAudit({
        action: "approve",
        tableName: "valuation_assignments",
        entityType: "request",
        recordId: assignment.id,
        assignmentId: assignment.id,
        description: `حكم مهني معتمد — القيمة النهائية: ${formatNumber(parsedValue)} ر.س`,
        newData: { final_value: parsedValue, professional_judgment_notes: judgmentNotes },
      });

      toast.success("تم اعتماد الحكم المهني — المسودة أُرسلت للعميل للمراجعة");
      navigate("/client-requests");
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) return null;

  const aiValue = reconciliation?.final_value || methods.find(m => m.is_primary)?.result_value || null;
  const assetInventory = request.asset_data?.inventory || [];

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Crown className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">الحكم المهني للمالك</h1>
          <p className="text-sm text-muted-foreground">
            {request.reference_number && <span className="font-mono ml-2">{request.reference_number}</span>}
            {request.property_description_ar || "طلب تقييم"}
          </p>
        </div>
        <Badge className="bg-amber-500/10 text-amber-600 border-0 shrink-0">مرحلة الحكم المهني</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: AI results */}
        <div className="lg:col-span-2 space-y-4">

          {/* AI-suggested value */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="w-4 h-4 text-primary" />
                القيمة المقترحة من رقيم
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiValue ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">{formatNumber(aiValue)}</span>
                  <SAR className="text-lg text-muted-foreground" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لم يُحسب بعد — يمكن إدخال القيمة يدوياً</p>
              )}
              {reconciliation?.confidence_score && (
                <p className="text-xs text-muted-foreground mt-1">
                  درجة الثقة: {reconciliation.confidence_score}%
                </p>
              )}
              {reconciliation?.reconciliation_notes && (
                <p className="text-xs text-muted-foreground mt-2 p-2 rounded-lg bg-muted/50">
                  {reconciliation.reconciliation_notes}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Valuation methods */}
          {methods.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Scale className="w-4 h-4 text-primary" />
                  المناهج والنتائج
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {methods.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-2">
                        {m.is_primary && <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-0">رئيسي</Badge>}
                        <span className="text-sm font-medium">{m.method_name_ar || m.method_name}</span>
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        {m.result_value ? <>{formatNumber(m.result_value)} <SAR /></> : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Asset inventory summary */}
          {assetInventory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  الأصول المعتمدة ({assetInventory.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {assetInventory.slice(0, 10).map((asset: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-1 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground w-5 shrink-0">{i + 1}</span>
                      <span className="flex-1 truncate">{asset.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 shrink-0">{asset.type}</Badge>
                    </div>
                  ))}
                  {assetInventory.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{assetInventory.length - 10} أصول أخرى
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: judgment form */}
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Edit3 className="w-4 h-4 text-primary" />
                الحكم المهني
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  القيمة النهائية المعتمدة <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={finalValue}
                    onChange={(e) => setFinalValue(e.target.value)}
                    placeholder="0"
                    className="text-lg font-semibold pl-16"
                    dir="ltr"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">ر.س</span>
                </div>
                {aiValue && parseFloat(finalValue) && Math.abs(parseFloat(finalValue) - aiValue) / aiValue > 0.1 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>القيمة تختلف عن اقتراح رقيم بأكثر من 10% — يُنصح بتوثيق المبرر بشكل مفصّل</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  مبرر الحكم المهني <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={judgmentNotes}
                  onChange={(e) => setJudgmentNotes(e.target.value)}
                  placeholder="وصف دقيق لمبرر القيمة المعتمدة، العوامل المؤثرة، أي تحفظات مهنية، وظروف السوق ذات الصلة..."
                  rows={7}
                  className="resize-none text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  يُحفظ هذا المبرر في سجل التدقيق ويظهر في التقرير النهائي
                </p>
              </div>

              <Separator />

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span>بعد الاعتماد تُرسل المسودة للعميل للمراجعة (stage_7)</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>يحق للعميل طلب التعديل قبل الانتقال لمرحلة الدفع النهائي</span>
                </div>
              </div>

              <Button
                onClick={handleApprove}
                disabled={saving || !judgmentNotes.trim() || !finalValue}
                className="w-full gap-2"
                size="lg"
              >
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle2 className="w-4 h-4" />
                }
                اعتماد الحكم المهني
              </Button>
            </CardContent>
          </Card>

          {/* Request info card */}
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الغرض</span>
                <span className="font-medium">{request.purpose || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">وضع التقييم</span>
                <span className="font-medium">
                  {assignment?.valuation_mode === "desktop" ? "مكتبي" : "ميداني"}
                </span>
              </div>
              {assignment?.fee_amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الرسوم المعتمدة</span>
                  <span className="font-medium">{formatNumber(assignment.fee_amount)} <SAR /></span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
