import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ownerSignReport } from "@/lib/workflow-engine";
import { logAudit } from "@/lib/audit-logger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SignatureUpload from "@/components/reports/SignatureUpload";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";
import {
  ArrowRight, Loader2, CheckCircle2, XCircle, PenLine,
  FileText, User, Building2, DollarSign, AlertTriangle, Shield,
} from "lucide-react";

interface RequestData {
  id: string;
  reference_number: string | null;
  property_description_ar: string | null;
  purpose: string | null;
  status: string;
  assignment_id: string | null;
}

interface AssignmentData {
  id: string;
  status: string;
  final_value: number | null;
  professional_judgment_notes: string | null;
  is_locked: boolean | null;
}

interface ClientData {
  id: string;
  name_ar: string | null;
}

interface ChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  blocking: boolean;
}

export default function SigningPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [request, setRequest] = useState<RequestData | null>(null);
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [payment2Received, setPayment2Received] = useState(false);

  useEffect(() => {
    if (requestId) loadData();
  }, [requestId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: req } = await supabase
        .from("valuation_requests" as any)
        .select("*")
        .eq("id", requestId!)
        .single();

      if (!req) { toast.error("لم يُعثر على الطلب"); navigate(-1); return; }
      setRequest(req as RequestData);

      const assignmentId = (req as any).assignment_id;

      if (assignmentId) {
        // Load assignment + payment receipts
        const [aRes, payRes, clientRes] = await Promise.all([
          supabase.from("valuation_assignments").select("*").eq("id", assignmentId).single(),
          supabase
            .from("payment_receipts" as any)
            .select("id, status, payment_type")
            .eq("assignment_id", assignmentId)
            .eq("status", "approved"),
          (req as any).client_id
            ? supabase.from("clients").select("id, name_ar").eq("id", (req as any).client_id).single()
            : { data: null },
        ]);

        const asgn = aRes.data as AssignmentData | null;
        setAssignment(asgn);

        const approvedPayments = (payRes.data || []) as any[];
        const hasFinalPayment = approvedPayments.some(
          (p: any) => p.payment_type === "final" || p.payment_type === "second"
        );
        setPayment2Received(hasFinalPayment);

        if (clientRes.data) setClient(clientRes.data as ClientData);

        // Build checklist
        const hasJudgment = !!(asgn?.professional_judgment_notes && asgn.final_value);
        const clientApprovedDraft =
          asgn?.status === "signing" ||
          asgn?.status === "pending_payment_2" ||
          (req as any).status === "signing";

        setChecklist([
          {
            key: "judgment",
            label: "الحكم المهني مكتمل والقيمة النهائية محددة",
            passed: hasJudgment,
            blocking: true,
          },
          {
            key: "client_draft",
            label: "المسودة معتمدة من العميل",
            passed: clientApprovedDraft,
            blocking: true,
          },
          {
            key: "payment2",
            label: "الدفعة الثانية (50%) مستلمة ومعتمدة",
            passed: hasFinalPayment || asgn?.status === "signing",
            blocking: true,
          },
        ]);
      } else {
        // No assignment yet — build minimal checklist
        setChecklist([
          {
            key: "judgment",
            label: "الحكم المهني مكتمل والقيمة النهائية محددة",
            passed: false,
            blocking: true,
          },
          { key: "client_draft", label: "المسودة معتمدة من العميل", passed: false, blocking: true },
          { key: "payment2", label: "الدفعة الثانية (50%) مستلمة ومعتمدة", passed: false, blocking: true },
        ]);
      }
    } catch (e) {
      toast.error("خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const blockingFailed = checklist.filter((c) => c.blocking && !c.passed);
  const canSign = blockingFailed.length === 0 && !!signatureUrl && !!assignment;

  const handleSign = async () => {
    if (!assignment) { toast.error("لا يوجد ملف تقييم مرتبط"); return; }
    if (!signatureUrl) { toast.error("يرجى رفع صورة التوقيع أولاً"); return; }
    if (blockingFailed.length > 0) {
      toast.error(`لا يمكن الإصدار: ${blockingFailed.map((c) => c.label).join("، ")}`);
      return;
    }

    setSigning(true);
    try {
      // Persist signature URL on assignment
      await supabase
        .from("valuation_assignments")
        .update({ signature_url: signatureUrl } as any)
        .eq("id", assignment.id);

      const result = await ownerSignReport(assignment.id);
      if (!result.success) {
        toast.error(result.error || "فشل إصدار التقرير");
        return;
      }

      await logAudit({
        action: "sign",
        tableName: "valuation_assignments",
        entityType: "report",
        recordId: assignment.id,
        assignmentId: assignment.id,
        description: `تم التوقيع الإلكتروني وإصدار التقرير — ${request?.reference_number || requestId}`,
      });

      toast.success("تم التوقيع وإصدار التقرير النهائي بنجاح");
      navigate("/client-requests");
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setSigning(false);
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

  return (
    <div className="space-y-6 pb-10 max-w-3xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
          <PenLine className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">التوقيع الإلكتروني وإصدار التقرير</h1>
          <p className="text-sm text-muted-foreground">
            {request.reference_number && <span className="font-mono ml-2">{request.reference_number}</span>}
            {request.property_description_ar || "طلب تقييم"}
          </p>
        </div>
        <Badge className="bg-emerald-500/10 text-emerald-600 border-0 shrink-0">مرحلة التوقيع</Badge>
      </div>

      {/* Report preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-primary" />
            ملخص التقرير
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">الأصل</p>
                <p className="font-medium">{request.property_description_ar || "—"}</p>
              </div>
            </div>
            {client && (
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">العميل</p>
                  <p className="font-medium">{client.name_ar || "—"}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">القيمة النهائية</p>
                <p className="font-bold text-primary text-base">
                  {assignment?.final_value
                    ? <>{formatNumber(assignment.final_value)} <SAR /></>
                    : "لم تُحدد"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">الغرض</p>
                <p className="font-medium">{request.purpose || "—"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-primary" />
            قائمة التحقق قبل الإصدار
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklist.map((item) => (
            <div
              key={item.key}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                item.passed
                  ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                  : item.blocking
                  ? "bg-destructive/5 border-destructive/30"
                  : "bg-muted/40 border-border"
              }`}
            >
              {item.passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
              )}
              <span className={`text-sm ${item.passed ? "text-foreground" : "text-muted-foreground"}`}>
                {item.label}
              </span>
              {!item.passed && item.blocking && (
                <Badge className="mr-auto text-[9px] px-1.5 bg-destructive/10 text-destructive border-0 shrink-0">
                  مطلوب
                </Badge>
              )}
            </div>
          ))}

          {blockingFailed.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>يجب اكتمال جميع بنود قائمة التحقق قبل إصدار التقرير</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signature upload */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <PenLine className="w-4 h-4 text-primary" />
          التوقيع الإلكتروني
        </h3>
        <SignatureUpload
          currentUrl={signatureUrl}
          onSignatureChange={setSignatureUrl}
          disabled={signing}
        />
      </div>

      {/* Issue button */}
      <Button
        onClick={handleSign}
        disabled={signing || !canSign}
        size="lg"
        className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {signing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <PenLine className="w-4 h-4" />
        )}
        توقيع وإصدار التقرير النهائي
      </Button>

      {!canSign && !signing && (
        <p className="text-xs text-center text-muted-foreground">
          {!signatureUrl
            ? "يرجى رفع صورة التوقيع للمتابعة"
            : blockingFailed.length > 0
            ? `${blockingFailed.length} بند(ود) في قائمة التحقق غير مكتملة`
            : !assignment
            ? "لا يوجد ملف تقييم مرتبط بهذا الطلب"
            : ""}
        </p>
      )}
    </div>
  );
}
