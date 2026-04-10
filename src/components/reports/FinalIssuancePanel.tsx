import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { changeStatusByRequestId } from "@/lib/workflow-status";
import { updateReportDraftStatus } from "@/lib/report-draft-status";
import { runReportQC, logQCResult, type ReportQCResult, QC_CATEGORY_LABELS } from "@/lib/report-qc-engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Shield, CheckCircle, Lock, Send,
  FileText, Archive, AlertTriangle, XCircle, ClipboardCheck,
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
