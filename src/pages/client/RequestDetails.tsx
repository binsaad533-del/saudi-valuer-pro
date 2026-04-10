import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Loader2, Upload, Download, CheckCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { EnhancedRequestTracker } from "@/components/client/EnhancedRequestTracker";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import PaymentCheckout from "@/components/payments/PaymentCheckout";
import DraftReportReview from "@/components/client/DraftReportReview";
import { changeStatusByRequestId } from "@/lib/workflow-status";
import { STATUS_LABELS as WF_STATUS_LABELS } from "@/lib/workflow-engine";
import { useRealtimeAssignment } from "@/hooks/useRealtimeAssignment";
import { formatDate, formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";
import { getValuationModeLabel } from "@/lib/valuation-mode";
import BidiText from "@/components/ui/bidi-text";

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  const [request, setRequest] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [_paymentRefreshKey, setPaymentRefreshKey] = useState(0);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setUser(user);
    const [reqRes, docRes] = await Promise.all([
      supabase.from("valuation_requests" as any).select("*").eq("id", id!).single(),
      supabase.from("request_documents" as any).select("*").eq("request_id", id!).order("created_at"),
    ]);
    setRequest(reqRes.data);
    setDocuments(docRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id, navigate]);

  useRealtimeAssignment(request?.assignment_id, async (newStatus, _oldStatus) => {
    toast({ title: "تحديث حالة الطلب", description: `تم تغيير الحالة إلى: ${getStatusLabel(newStatus)}` });
    loadData();
  });

  const getStatusLabel = (status: string) => {
    const wf = WF_STATUS_LABELS[status];
    if (wf) return wf.client_ar || wf.ar;
    return status;
  };

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !request) return;
    setUploading(true);
    try {
      const filePath = `receipts/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("client-uploads").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const needsFinal = request.status === "draft_approved";
      const amount = parseFloat(String(needsFinal ? (request.total_fees - (request.amount_paid || 0)) : request.first_payment_amount));
      await supabase.from("payment_receipts" as any).insert({ request_id: id!, uploaded_by: user.id, file_name: file.name, file_path: filePath, amount, payment_type: needsFinal ? "final" : "first", status: "pending" });
      await supabase.from("valuation_requests" as any).update({ payment_status: "payment_uploaded" } as any).eq("id", id!);
      toast({ title: "تم رفع الإيصال بنجاح" });
      loadData();
    } catch (err: any) { toast({ title: "خطأ", description: err.message, variant: "destructive" }); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\p{L}\p{N}._()-]+/gu, "-");
      const filePath = `${user.id}/docs/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("client-uploads").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      await supabase.from("request_documents" as any).insert({ request_id: id!, uploaded_by: user.id, file_name: file.name, file_path: filePath, file_size: file.size, mime_type: file.type });
      toast({ title: "تم رفع المستند" });
      loadData();
    } catch (err: any) { toast({ title: "خطأ", description: err.message, variant: "destructive" }); }
    finally { setUploading(false); if (docFileRef.current) docFileRef.current.value = ""; }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!request) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">الطلب غير موجود</p></div>;

  const valuationMode = request.ai_intake_summary?.valuation_mode || request.inspection_type || "field";
  const hasPhotos = documents.some(d => d.mime_type?.startsWith("image/"));
  const needsPayment = request.status === "scope_approved";
  const needsFinalPayment = request.status === "draft_approved" && request.payment_structure === "partial";
  const showDraft = ["draft_report_ready", "client_review"].includes(request.status);
  const showFinal = ["issued", "archived"].includes(request.status);
  const showSOW = request.status === "scope_generated" && request.scope_of_work_ar;

  // Dynamic primary CTA
  const getPrimaryCTA = () => {
    if (showSOW) return { label: "مراجعة والموافقة على النطاق", action: "sow" };
    if (needsPayment || needsFinalPayment) return { label: "ادفع الآن", action: "pay" };
    if (showDraft) return { label: "راجع المسودة", action: "draft" };
    if (showFinal) return { label: "تحميل التقرير", action: "final" };
    if (["data_collection_open"].includes(request.status)) return { label: "ارفع المستندات", action: "upload" };
    return null;
  };
  const primaryCTA = getPrimaryCTA();

  return (
    <div className="bg-background min-h-screen" dir="rtl">
      {/* Status Bar */}
      <div className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-sm font-bold text-foreground">تفاصيل الطلب</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {request.reference_number && <span className="text-[10px] font-mono text-muted-foreground" dir="ltr">{request.reference_number}</span>}
                <Badge variant="outline" className="text-[10px]">{getStatusLabel(request.status)}</Badge>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {getValuationModeLabel(valuationMode, hasPhotos)}
            </Badge>
          </div>
          <EnhancedRequestTracker status={request.status} createdAt={request.created_at} valuationMode={valuationMode} />
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Primary CTA — "المطلوب الآن" */}
        {primaryCTA && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-bold text-foreground">المطلوب الآن</p>

              {/* SOW Approval */}
              {primaryCTA.action === "sow" && (
                <div className="space-y-3">
                  <div className="p-3 bg-card rounded-lg border text-xs max-h-40 overflow-y-auto">
                    <BidiText preserveNewlines>{request.scope_of_work_ar}</BidiText>
                  </div>
                  {request.quotation_amount && (
                    <div className="flex items-center justify-between text-sm px-1">
                      <span className="text-muted-foreground">الإجمالي شامل الضريبة</span>
                      <span className="font-bold text-primary" dir="ltr">{formatNumber(Math.round(Number(request.quotation_amount) * 1.15))} <SAR /></span>
                    </div>
                  )}
                  <Button className="w-full" onClick={async () => {
                    setSending(true);
                    try {
                      const result = await changeStatusByRequestId(id!, "scope_approved", { reason: "اعتماد نطاق العمل من العميل" });
                      if (!result.success) throw new Error(result.error);
                      await supabase.from("valuation_requests" as any).update({ sow_signed_at: new Date().toISOString(), quotation_response_at: new Date().toISOString(), quotation_approved_at: new Date().toISOString() } as any).eq("id", id!);
                      toast({ title: "تم اعتماد نطاق العمل" });
                      loadData();
                    } catch (err: any) { toast({ title: "خطأ", description: err.message, variant: "destructive" }); }
                    finally { setSending(false); }
                  }} disabled={sending}>
                    <CheckCircle className="w-4 h-4 ml-1" /> موافقة واعتماد
                  </Button>
                </div>
              )}

              {/* Payment */}
              {primaryCTA.action === "pay" && (
                <div className="space-y-3">
                  <PaymentCheckout
                    request={request}
                    paymentStage={needsFinalPayment ? "final" : request.payment_structure === "partial" ? "first" : "full"}
                    onPaymentComplete={() => { setPaymentRefreshKey(k => k + 1); loadData(); }}
                  />
                  <div className="text-center">
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleUploadReceipt} className="hidden" />
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Upload className="w-3 h-3 ml-1" />}
                      رفع إيصال يدوي
                    </Button>
                  </div>
                </div>
              )}

              {/* Draft Report */}
              {primaryCTA.action === "draft" && (
                <DraftReportReview requestId={id!} userId={user?.id || ""} paymentStructure={request.payment_structure} onStatusChange={loadData} />
              )}

              {/* Final Report */}
              {primaryCTA.action === "final" && (
                <div className="text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold">التقرير النهائي جاهز</p>
                  <Button className="w-full"><Download className="w-4 h-4 ml-1" /> تحميل التقرير</Button>
                </div>
              )}

              {/* Upload docs */}
              {primaryCTA.action === "upload" && (
                <div className="space-y-2">
                  <input ref={docFileRef} type="file" className="hidden" accept="image/*,.pdf,.xlsx,.xls" onChange={handleDocUpload} />
                  <Button className="w-full" onClick={() => docFileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Upload className="w-4 h-4 ml-1" />}
                    ارفع المستندات
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* No action needed — show raqeem CTA */}
        {!primaryCTA && (
          <Card>
            <CardContent className="p-5 text-center space-y-3">
              <p className="text-sm text-muted-foreground">طلبك قيد المعالجة — لا يوجد إجراء مطلوب منك الآن</p>
              <Button variant="outline" className="gap-2" onClick={() => navigate("/client/chat")}>
                <RaqeemAnimatedLogo size={18} />
                الذهاب إلى رقيم
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Raqeem navigation — always visible */}
        {primaryCTA && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs gap-1.5 text-primary"
            onClick={() => navigate("/client/chat")}
          >
            <RaqeemAnimatedLogo size={16} />
            الذهاب إلى رقيم
          </Button>
        )}

        {/* Collapsible Details + Documents */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          تفاصيل إضافية ({documents.length} مستند)
        </button>

        {showDetails && (
          <Card>
            <CardContent className="p-4 space-y-3 text-xs">
              {request.property_description_ar && (
                <div><span className="text-muted-foreground">الوصف: </span><span>{request.property_description_ar}</span></div>
              )}
              {request.property_city_ar && (
                <div><span className="text-muted-foreground">المدينة: </span><span>{request.property_city_ar}</span></div>
              )}
              <div><span className="text-muted-foreground">تاريخ الطلب: </span><span>{formatDate(request.created_at)}</span></div>

              {documents.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-muted-foreground font-medium">المستندات</p>
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-2 bg-muted/30 rounded p-2">
                      <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{doc.file_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
