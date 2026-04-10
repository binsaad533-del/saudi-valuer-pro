import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { changeStatusByRequestId } from "@/lib/workflow-status";
import { updateReportDraftStatus } from "@/lib/report-draft-status";
import { runReportQC, logQCResult, type ReportQCResult } from "@/lib/report-qc-engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Shield, CheckCircle, Lock, Send,
  FileText, Archive, AlertTriangle, XCircle, Lightbulb,
} from "lucide-react";

interface Props {
  request: any;
  userId: string;
  onStatusChange?: () => void;
}

/**
 * الوحدة 5: إصدار التقرير النهائي + القفل الإلكتروني + التسليم + الأرشفة
 * يظهر فقط بعد اعتماد العميل للمسودة (أو بعد الدفعة النهائية)
 */
export default function FinalIssuancePanel({ request, userId, onStatusChange }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [qcResult, setQcResult] = useState<ReportQCResult | null>(null);
  const [runningQC, setRunningQC] = useState(false);

  const status = request.status;
  // Show panel after final payment confirmed, or when already issued/archived
  const isVisible = [
    "final_payment_confirmed", "issued", "archived",
  ].includes(status);

  useEffect(() => {
    if (!isVisible) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("report_drafts" as any)
        .select("*")
        .eq("request_id", request.id)
        .in("status", ["client_approved", "issued", "archived"])
        .order("version", { ascending: false })
        .limit(1);
      if (data && data.length > 0) setDraft(data[0]);
      setLoading(false);
    };
    load();
  }, [request.id, isVisible]);

  if (!isVisible || loading) {
    if (loading && isVisible) {
      return (
        <Card><CardContent className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent></Card>
      );
    }
    return null;
  }

  const isIssued = status === "issued" || status === "archived" || draft?.status === "issued";
  const isArchived = status === "archived" || draft?.status === "archived";

  const handleRunQC = async () => {
    setRunningQC(true);
    try {
      const assignmentId = request.assignment_id || draft?.assignment_id;
      if (!assignmentId) {
        toast({ title: "خطأ", description: "لم يتم العثور على معرف المهمة", variant: "destructive" });
        return;
      }
      const result = await runReportQC(assignmentId);
      setQcResult(result);
      await logQCResult(assignmentId, result, userId);

      if (!result.passed) {
        toast({
          title: "لا يمكن إصدار التقرير لعدم اكتمال المتطلبات",
          description: `${result.failed_mandatory} متطلبات لم تتحقق`,
          variant: "destructive",
        });
      } else {
        toast({ title: "اجتاز التقرير تدقيق الجودة", description: `النتيجة: ${result.score}%` });
      }
    } catch (err: any) {
      toast({ title: "خطأ في تدقيق الجودة", description: err.message, variant: "destructive" });
    } finally {
      setRunningQC(false);
    }
  };

  const handleIssue = async () => {
    // Run QC first if not already passed
    if (!qcResult?.passed) {
      const assignmentId = request.assignment_id || draft?.assignment_id;
      if (assignmentId) {
        const result = await runReportQC(assignmentId);
        setQcResult(result);
        await logQCResult(assignmentId, result, userId);
        if (!result.passed) {
          toast({
            title: "لا يمكن إصدار التقرير لعدم اكتمال المتطلبات",
            description: result.blocked_reasons_ar.join("، "),
            variant: "destructive",
          });
          return;
        }
      }
    }

    setIssuing(true);
    try {
      const reportNumber = `RPT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0")}`;
      const verificationCode = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, "0")).join("");

      // Issue via RPC
      const statusResult = await changeStatusByRequestId(request.id, "issued", { userId, reason: "إصدار التقرير النهائي" });
      if (!statusResult.success) throw new Error(statusResult.error);

      if (draft) {
        const draftResult = await updateReportDraftStatus(draft.id, "issued", {
          issued_at: new Date().toISOString(),
          report_number: reportNumber,
          verification_code: verificationCode,
        });
        if (!draftResult.success) throw new Error(draftResult.error);
      }
      await Promise.all([
        supabase.from("request_messages" as any).insert({
          request_id: request.id,
          sender_type: "system" as any,
          content: `تم إصدار التقرير النهائي رقم ${reportNumber} — التقرير محمي ولا يمكن تعديله.`,
        }),
        supabase.from("audit_logs").insert({
          user_id: userId,
          action: "create" as any,
          table_name: "report_issuance",
          record_id: request.id,
          description: `إصدار التقرير النهائي رقم ${reportNumber}`,
          new_data: { report_number: reportNumber, verification_code: verificationCode, qc_score: qcResult?.score },
        }),
      ]);

      if (draft) setDraft({ ...draft, status: "issued", report_number: reportNumber });
      toast({ title: "تم إصدار التقرير النهائي", description: `رقم التقرير: ${reportNumber}` });
      onStatusChange?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIssuing(false);
    }
  };

  const handleDeliver = async () => {
    setDelivering(true);
    try {
      const statusResult = await changeStatusByRequestId(request.id, "archived", { userId, reason: "أرشفة وتسليم التقرير" });
      if (!statusResult.success) throw new Error(statusResult.error);

      await Promise.all([
        supabase.from("request_messages" as any).insert({
          request_id: request.id,
          sender_type: "system" as any,
          content: "📬 تم تسليم التقرير النهائي للعميل. شكراً لثقتكم.\n\n🔗 يمكنكم التحقق من صحة التقرير عبر رمز التحقق المرفق.",
        }),
        supabase.from("audit_logs").insert({
          user_id: userId,
          action: "update" as any,
          table_name: "report_delivery",
          record_id: request.id,
          description: "تسليم التقرير النهائي للعميل",
        }),
      ]);

      toast({ title: "تم التسليم للعميل 📬" });
      onStatusChange?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setDelivering(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const archiveDate = new Date();
      const retentionDate = new Date(archiveDate);
      retentionDate.setFullYear(retentionDate.getFullYear() + 10);

      if (draft) {
        const archiveResult = await updateReportDraftStatus(draft.id, "archived", {
          archived_at: new Date().toISOString(),
          retention_until: retentionDate.toISOString(),
        });
        if (!archiveResult.success) throw new Error(archiveResult.error);
      }
      await Promise.all([
        supabase.from("audit_logs").insert({
          user_id: userId,
          action: "create" as any,
          table_name: "report_archive",
          record_id: request.id,
          description: `أرشفة ملف العمل — الحفظ الإلزامي حتى ${retentionDate.toLocaleDateString("ar-SA")}`,
          new_data: {
            archive_date: archiveDate.toISOString(),
            retention_until: retentionDate.toISOString(),
            includes: ["نطاق العمل", "الفواتير", "صور الأصول", "بيانات السوق", "التقرير النهائي"],
          },
        }),
        supabase.from("request_messages" as any).insert({
          request_id: request.id,
          sender_type: "system" as any,
          content: `🗃️ تم أرشفة ملف العمل بالكامل. القفل الإلكتروني فعّال — الحفظ الإلزامي حتى ${retentionDate.toLocaleDateString("ar-SA")} (10 سنوات).`,
        }),
      ]);

      if (draft) setDraft({ ...draft, status: "archived" });
      toast({ title: "تم الأرشفة 🗃️", description: "ملف العمل محفوظ لمدة 10 سنوات" });
      onStatusChange?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Card className="shadow-card border-green-200 dark:border-green-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            إصدار وتسليم التقرير النهائي
          </span>
          {isArchived && (
            <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">مؤرشف</Badge>
          )}
          {isIssued && !isArchived && (
            <Badge className="bg-green-500/10 text-green-600 border-green-200">صادر</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* QC Section — before issuance */}
        {!isIssued && (
          <div className="space-y-2">
            {/* QC Trigger */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${qcResult?.passed ? "bg-green-100 dark:bg-green-900/30" : qcResult && !qcResult.passed ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}`}>
                {qcResult?.passed
                  ? <CheckCircle className="w-4 h-4 text-green-600" />
                  : qcResult && !qcResult.passed
                    ? <XCircle className="w-4 h-4 text-red-600" />
                    : <Shield className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">بوابة الجودة</p>
                <p className="text-[10px] text-muted-foreground">
                  {qcResult
                    ? qcResult.passed
                      ? `اجتاز — ${qcResult.score}% (${qcResult.passed_checks}/${qcResult.total_checks})`
                      : `التقرير غير مكتمل حسب معايير الجودة`
                    : "يجب تشغيل بوابة الجودة قبل الإصدار"}
                </p>
              </div>
              <Button
                size="sm"
                variant={qcResult?.passed ? "outline" : "default"}
                onClick={handleRunQC}
                disabled={runningQC}
                className="gap-1 shrink-0"
              >
                {runningQC ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                {qcResult ? "إعادة الفحص" : "فحص الجودة"}
              </Button>
            </div>

            {/* Score bar */}
            {qcResult && (
              <div className="px-3 space-y-3">
                {/* Grade + Score */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">نتيجة الجودة</span>
                    <Badge variant="outline" className={`text-[10px] ${
                      qcResult.score >= 86 ? "border-green-300 text-green-700" :
                      qcResult.score >= 76 ? "border-blue-300 text-blue-700" :
                      qcResult.score >= 66 ? "border-amber-300 text-amber-700" :
                      qcResult.score >= 51 ? "border-orange-300 text-orange-700" :
                      "border-red-300 text-red-700"
                    }`}>
                      {(qcResult as any).grade_label_ar || "—"}
                    </Badge>
                  </div>
                  <span className={`text-sm font-bold ${
                    qcResult.score >= 80 ? "text-green-600" : qcResult.score >= 50 ? "text-amber-600" : "text-red-600"
                  }`}>
                    {qcResult.score}%
                  </span>
                </div>

                {/* Score bar */}
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      qcResult.score >= 86 ? "bg-green-500" : qcResult.score >= 66 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${qcResult.score}%` }}
                  />
                </div>

                {/* IVS Standards Breakdown */}
                {(qcResult as any).standard_results && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground">تفصيل المعايير</p>
                    {((qcResult as any).standard_results as any[]).map((sr: any) => (
                      <div key={sr.code} className="flex items-center gap-2 text-[10px]">
                        <span className="w-[120px] truncate text-muted-foreground">{sr.title_ar}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              sr.score_pct >= 86 ? "bg-green-500" : sr.score_pct >= 66 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${sr.score_pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-left font-medium">{sr.score_pct}%</span>
                        <span className="text-muted-foreground">({sr.passed_items}/{sr.total_items})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Summary counters */}
                <div className="flex gap-3 text-[9px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    إلزامي: {qcResult.failed_mandatory > 0 ? `${qcResult.failed_mandatory} فشل` : "✓"}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    جودة: {(qcResult as any).failed_quality > 0 ? `${(qcResult as any).failed_quality} ملاحظة` : "✓"}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    تحسين: {(qcResult as any).failed_enhancement > 0 ? `${(qcResult as any).failed_enhancement} اقتراح` : "✓"}
                  </span>
                </div>
              </div>
            )}

            {/* TIER 1: Mandatory failures — blocks issuance */}
            {qcResult && !qcResult.passed && (
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-1.5">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  التقرير غير مكتمل حسب معايير الجودة — الإصدار محظور
                </p>
                <ul className="space-y-1 mr-5">
                  {qcResult.checks.filter(c => c.severity === "mandatory" && !c.passed).map(c => (
                    <li key={c.code} className="text-[10px] text-destructive/80 flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">●</span>
                      <span>{c.details_ar || c.label_ar}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* TIER 2: Quality warnings — allows issuance with warning */}
            {qcResult && (qcResult as any).has_warnings && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-1.5">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  ملاحظات جودة — يُسمح بالإصدار مع التنبيه
                </p>
                <ul className="space-y-1 mr-5">
                  {qcResult.checks.filter(c => c.severity === "quality" && !c.passed).map(c => (
                    <li key={c.code} className="text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">▲</span>
                      <span>{c.details_ar || c.label_ar}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* TIER 3: Enhancement suggestions */}
            {qcResult && (qcResult as any).failed_enhancement > 0 && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-1.5">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" />
                  اقتراحات تحسين
                </p>
                <ul className="space-y-1 mr-5">
                  {qcResult.checks.filter(c => c.severity === "enhancement" && !c.passed).map(c => (
                    <li key={c.code} className="text-[10px] text-blue-600 dark:text-blue-400 flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">◆</span>
                      <span>{c.details_ar || c.label_ar}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Full pass */}
            {qcResult?.passed && !(qcResult as any).has_warnings && (
              <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-[10px] text-green-700 dark:text-green-300 text-center">
                  جميع المتطلبات مستوفاة — التقرير جاهز للإصدار
                </p>
              </div>
            )}

            {/* Pass with warnings */}
            {qcResult?.passed && (qcResult as any).has_warnings && (
              <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <p className="text-[10px] text-amber-700 dark:text-amber-300 text-center">
                  يُسمح بالإصدار — مع وجود ملاحظات جودة يُنصح بمعالجتها
                </p>
              </div>
            )}

            <Separator />
          </div>
        )}

        {/* Step 1: Issue */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isIssued ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
            {isIssued ? <CheckCircle className="w-4 h-4 text-green-600" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">١. إصدار التقرير النهائي</p>
            <p className="text-[10px] text-muted-foreground">
              {isIssued ? `رقم التقرير: ${draft?.report_number || request.report_number || "—"}` : "توليد رقم رسمي + رمز تحقق + قفل"}
            </p>
          </div>
          {!isIssued && (
            <Button size="sm" onClick={handleIssue} disabled={issuing} className="gap-1 bg-green-600 hover:bg-green-700 text-white shrink-0">
              {issuing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
              إصدار
            </Button>
          )}
        </div>

        {/* Step 2: Deliver */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isArchived ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
            {isArchived ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Send className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">٢. تسليم التقرير للعميل</p>
            <p className="text-[10px] text-muted-foreground">إرسال التقرير المشفّر + خطاب إغلاق المهمة</p>
          </div>
          {isIssued && !isArchived && (
            <Button size="sm" onClick={handleDeliver} disabled={delivering} className="gap-1 shrink-0">
              {delivering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              تسليم
            </Button>
          )}
        </div>

        {/* Step 3: Archive */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isArchived ? "bg-purple-100 dark:bg-purple-900/30" : "bg-muted"}`}>
            {isArchived ? <CheckCircle className="w-4 h-4 text-purple-600" /> : <Archive className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">٣. الأرشفة الإلزامية (10 سنوات)</p>
            <p className="text-[10px] text-muted-foreground">
              {isArchived ? "ملف العمل مقفل ومحفوظ في السحابة" : "قفل إلكتروني + حفظ سحابي لجميع الوثائق"}
            </p>
          </div>
          {isIssued && !isArchived && (
            <Button size="sm" variant="outline" onClick={handleArchive} disabled={archiving} className="gap-1 shrink-0">
              {archiving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
              أرشفة
            </Button>
          )}
        </div>

        {isArchived && (
          <>
            <Separator />
            <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <Lock className="w-5 h-5 text-purple-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">ملف العمل مقفل</p>
              <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">
                لا يمكن تعديل أي مكون من مكونات هذا الملف. محفوظ امتثالاً لأنظمة الهيئة.
              </p>
            </div>
          </>
        )}

        {!isIssued && (
          <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-700 dark:text-amber-300">
              بعد الإصدار لن يمكن تعديل التقرير. تأكد من مراجعة كافة الأقسام قبل المتابعة.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
