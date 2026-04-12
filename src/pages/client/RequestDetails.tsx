import { useEffect, useState, useRef } from "react";
import { EnhancedRequestTracker } from "@/components/client/EnhancedRequestTracker";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  clientApproveAssetInventory,
  clientApproveScopeAndPay,
} from "@/lib/workflow-engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  ArrowRight, FileText, MessageSquare, Send, Loader2, Bot, User,
  Building2, CheckCircle, XCircle, Upload, Download,
  Clock, Shield, AlertCircle, ClipboardList,
} from "lucide-react";
import logo from "@/assets/logo.png";
import PaymentCheckout from "@/components/payments/PaymentCheckout";
import PaymentHistory from "@/components/payments/PaymentHistory";
import ClientReportReview from "@/components/reports/ClientReportReview";
import AssetReviewWorkspace from "@/components/client/AssetReviewWorkspace";
import { formatDate, formatNumber } from "@/lib/utils";
import { SAR, SARIcon } from "@/components/ui/saudi-riyal";

// ── 13-stage lifecycle labels ─────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  draft:                 "مسودة الطلب",
  stage_1_processing:    "تحليل المستندات",
  stage_2_client_review: "مراجعة الفهرس",
  stage_3_owner_scope:   "تحديد النطاق والسعر",
  stage_4_client_scope:  "موافقة العميل على النطاق",
  pending_payment_1:     "الدفعة الأولى 50%",
  stage_5_inspection:    "المعاينة الميدانية",
  stage_6_owner_draft:   "الحكم المهني",
  stage_7_client_draft:  "مراجعة المسودة",
  pending_payment_2:     "الدفعة النهائية 50%",
  signing:               "توقيع التقرير",
  issued:                "صادر",
  archived:              "مؤرشف",
  cancelled:             "ملغي",
};

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [request, setRequest]     = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [messages, setMessages]   = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [payments, setPayments]   = useState<any[]>([]);
  const [reports, setReports]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending]     = useState(false);
  const [user, setUser]           = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [paymentType, setPaymentType] = useState("first");
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);
  const [approvingScope, setApprovingScope] = useState(false);
  const [approvingInventory, setApprovingInventory] = useState(false);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setUser(user);

    const [reqRes, msgRes, docRes, payRes] = await Promise.all([
      supabase.from("valuation_requests" as any).select("*").eq("id", id!).single(),
      supabase.from("request_messages" as any).select("*").eq("request_id", id!).order("created_at"),
      supabase.from("request_documents" as any).select("*").eq("request_id", id!).order("created_at"),
      supabase.from("payment_receipts" as any).select("*").eq("request_id", id!).order("created_at"),
    ]);

    const reqData = reqRes.data as any;
    setRequest(reqData);
    setMessages(msgRes.data || []);
    setDocuments(docRes.data || []);
    setPayments(payRes.data || []);

    if (reqData?.assignment_id) {
      const [asgRes, repsRes] = await Promise.all([
        supabase.from("valuation_assignments").select("*").eq("id", reqData.assignment_id).single(),
        supabase.from("reports" as any).select("*").eq("assignment_id", reqData.assignment_id).order("created_at", { ascending: false }),
      ]);
      setAssignment(asgRes.data || null);
      setReports((repsRes.data as any[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel(`request-messages-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "request_messages", filter: `request_id=eq.${id}` },
        (payload) => setMessages(prev => [...prev, payload.new]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    setSending(true);
    try {
      await supabase.from("request_messages" as any).insert({
        request_id: id!, sender_id: user.id, sender_type: "client" as any, content: newMessage,
      });
      setNewMessage("");
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // ── Stage 2: Approve asset inventory ──────────────────────────────────────
  const handleApproveInventory = async () => {
    if (!assignment?.id) return;
    setApprovingInventory(true);
    try {
      const result = await clientApproveAssetInventory(assignment.id);
      if (!result.success) {
        toast({ title: "خطأ", description: result.error || "فشل اعتماد الفهرس", variant: "destructive" });
        return;
      }
      await supabase.from("request_messages" as any).insert({
        request_id: id!, sender_type: "system" as any,
        content: "✅ تم اعتماد فهرس الأصول من قبل العميل — سيتولى المالك تحديد نطاق العمل والسعر",
      });
      toast({ title: "تم اعتماد الفهرس بنجاح" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setApprovingInventory(false);
    }
  };

  // ── Stage 4: Approve scope + price ────────────────────────────────────────
  const handleApproveScope = async (approved: boolean) => {
    setApprovingScope(true);
    try {
      if (approved && assignment?.id) {
        const result = await clientApproveScopeAndPay(assignment.id);
        if (!result.success) {
          toast({ title: "خطأ", description: result.error || "فشل قبول النطاق", variant: "destructive" });
          return;
        }
        await supabase.from("request_messages" as any).insert({
          request_id: id!, sender_type: "system" as any,
          content: "✅ تم قبول نطاق العمل والسعر — يرجى الدفع لاستكمال التقييم",
        });
        toast({ title: "تم قبول العرض — انتقل للدفعة الأولى" });
      } else {
        // Rejected — notify only, no status change (owner decides next step)
        await supabase.from("request_messages" as any).insert({
          request_id: id!, sender_id: user?.id, sender_type: "client" as any,
          content: "❌ العميل لم يوافق على نطاق العمل أو السعر — يرجى المراجعة",
        });
        toast({ title: "تم إرسال ملاحظة الرفض للمالك" });
      }
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setApprovingScope(false);
    }
  };

  // ── Receipt upload (pending_payment_1 / pending_payment_2) ────────────────
  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !request) return;
    setUploading(true);
    try {
      const filePath = `receipts/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("client-uploads").upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const isFinal = request.status === "pending_payment_2";
      const amount = isFinal
        ? (assignment?.fee_amount ? assignment.fee_amount / 2 : 0)
        : (assignment?.fee_amount ? assignment.fee_amount / 2 : 0);

      await supabase.from("payment_receipts" as any).insert({
        request_id: id!,
        uploaded_by: user.id,
        file_name: file.name,
        file_path: filePath,
        amount,
        payment_type: isFinal ? "final" : "first",
        status: "pending",
      });

      // No status change — CFO reviews and confirms
      await supabase.from("request_messages" as any).insert({
        request_id: id!, sender_type: "system" as any,
        content: `📎 تم رفع إيصال الدفع (${isFinal ? "الدفعة النهائية" : "الدفعة الأولى"}) — بانتظار تأكيد المدير المالي`,
      });

      toast({ title: "تم رفع الإيصال بنجاح — بانتظار التأكيد" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getStatusLabel = (status: string) => STATUS_LABELS[status] || status;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!request) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">الطلب غير موجود</p></div>;
  }

  // ── Visibility flags (13-stage) ────────────────────────────────────────────
  const status = request.status as string;
  const showInventoryReview = status === "stage_2_client_review";
  const showScopeApproval   = status === "stage_4_client_scope" && assignment?.fee_amount;
  const needsPayment        = status === "pending_payment_1";
  const needsFinalPayment   = status === "pending_payment_2";
  const showDraftReport     = status === "stage_7_client_draft";
  const showFinalReport     = status === "issued" || status === "archived";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-8 h-8" />
            <div>
              <h2 className="text-sm font-bold text-foreground">تفاصيل الطلب</h2>
              {request.reference_number && <p className="text-xs text-muted-foreground font-mono" dir="ltr">{request.reference_number}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-primary/10 text-primary">{getStatusLabel(status)}</Badge>
            <Button variant="ghost" size="sm" onClick={() => navigate("/client")}><ArrowRight className="w-4 h-4 ml-1" />العودة</Button>
          </div>
        </div>
      </header>

      {/* Progress Tracker */}
      <div className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <EnhancedRequestTracker status={status} createdAt={request.created_at} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Chat ─────────────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <Card className="shadow-card h-[calc(100vh-260px)] flex flex-col">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />المحادثة والملاحظات
                </CardTitle>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isClient = msg.sender_type === "client";
                  const isAI = msg.sender_type === "ai";
                  const isSystem = msg.sender_type === "system";
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-xs text-muted-foreground max-w-[80%] text-center">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isClient ? "flex-row-reverse" : ""}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isAI ? "gradient-primary" : isClient ? "bg-muted" : "bg-accent"
                      }`}>
                        {isAI ? <Bot className="w-3.5 h-3.5 text-primary-foreground" /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                        isClient ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}>
                        {isAI
                          ? <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                          : <p>{msg.content}</p>
                        }
                        <p className={`text-[10px] mt-1 ${isClient ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                    placeholder="اكتب ملاحظة أو استفسار..."
                    disabled={sending}
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sending} size="icon">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* ── Sidebar ───────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Request Info */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />معلومات الطلب</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {request.property_description_ar && (
                  <div><span className="text-muted-foreground text-xs">الوصف:</span><p className="text-foreground">{request.property_description_ar}</p></div>
                )}
                {request.property_city_ar && (
                  <div className="flex justify-between"><span className="text-muted-foreground text-xs">المدينة:</span><span>{request.property_city_ar}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">تاريخ الطلب:</span><span>{formatDate(request.created_at)}</span></div>
                {assignment?.fee_amount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">الرسوم:</span>
                    <span className="font-semibold">{formatNumber(assignment.fee_amount)} <SAR /></span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Stage 2: Asset Inventory Review ───────────────────────── */}
            {showInventoryReview && (
              <Card className="shadow-card border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />مراجعة فهرس الأصول
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    استعرض الأصول التي استخرجها رقيم من مستنداتك وأكّد اكتمالها قبل الانتقال لمرحلة تحديد النطاق والسعر.
                  </p>
                  {assignment?.id ? (
                    <>
                      <AssetReviewWorkspace
                        jobId={assignment.id}
                        onSubmit={handleApproveInventory}
                        onBack={() => {}}
                      />
                      <Button
                        onClick={handleApproveInventory}
                        disabled={approvingInventory}
                        className="w-full gap-2 mt-2"
                      >
                        {approvingInventory ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        اعتماد الفهرس والمتابعة
                      </Button>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      <AlertCircle className="w-5 h-5 mx-auto mb-1 text-warning" />
                      الفهرس قيد الإعداد — يرجى الانتظار
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Stage 4: Scope + Price Approval ───────────────────────── */}
            {showScopeApproval && (
              <Card className="shadow-card border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <SARIcon className="w-4 h-4 text-primary" />نطاق العمل والسعر
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center p-3 bg-primary/5 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">الرسوم الإجمالية</p>
                    <p className="text-2xl font-bold text-primary">{formatNumber(assignment.fee_amount)} <SAR /></p>
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      <p>الدفعة الأولى (50%): {formatNumber(assignment.fee_amount / 2)} <SAR /></p>
                      <p>الدفعة النهائية (50%): {formatNumber(assignment.fee_amount / 2)} <SAR /></p>
                    </div>
                  </div>
                  {assignment.methodology && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">المنهجية:</p>
                      <p className="text-xs bg-muted/50 p-2 rounded">{assignment.methodology}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      className="flex-1" size="sm"
                      onClick={() => handleApproveScope(true)}
                      disabled={approvingScope}
                    >
                      {approvingScope ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <CheckCircle className="w-3 h-3 ml-1" />}
                      قبول والمتابعة للدفع
                    </Button>
                    <Button
                      variant="outline" className="flex-1" size="sm"
                      onClick={() => handleApproveScope(false)}
                      disabled={approvingScope}
                    >
                      <XCircle className="w-3 h-3 ml-1" />إبداء ملاحظة
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── pending_payment_1: Online Payment ──────────────────────── */}
            {needsPayment && (
              <PaymentCheckout
                request={request}
                paymentStage="first"
                onPaymentComplete={() => { setPaymentRefreshKey(k => k + 1); loadData(); }}
              />
            )}

            {/* ── pending_payment_2: Final Payment ───────────────────────── */}
            {needsFinalPayment && (
              <PaymentCheckout
                request={request}
                paymentStage="final"
                onPaymentComplete={() => { setPaymentRefreshKey(k => k + 1); loadData(); }}
              />
            )}

            {/* ── Manual Receipt Upload ─────────────────────────────────── */}
            {(needsPayment || needsFinalPayment) && (
              <Card className="shadow-card border-border">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground text-center">أو رفع إيصال تحويل بنكي يدوياً</p>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleUploadReceipt} className="hidden" />
                  <Button
                    variant="ghost" size="sm" className="w-full text-xs gap-1"
                    onClick={() => {
                      setPaymentType(needsFinalPayment ? "final" : "first");
                      fileInputRef.current?.click();
                    }}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    رفع إيصال يدوي
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── Stage 7: Draft Report Review ───────────────────────────── */}
            {showDraftReport && reports.length > 0 && (
              <ClientReportReview
                reportId={reports[0].id}
                requestId={id!}
                assignmentId={assignment?.id}
              />
            )}
            {showDraftReport && reports.length === 0 && (
              <Card className="shadow-card border-warning/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-warning" />مسودة التقرير
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-muted/30 rounded-lg border-2 border-dashed border-warning/30 text-center">
                    <Clock className="w-6 h-6 text-warning mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-muted-foreground">المسودة قيد الإعداد — ستُرسل لك فور اكتمالها</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Issued: Final Report ────────────────────────────────────── */}
            {showFinalReport && (
              <Card className="shadow-card border-success/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-success" />التقرير النهائي
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-4 bg-success/5 rounded-lg text-center">
                    <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                    <p className="font-bold text-foreground">التقرير النهائي جاهز</p>
                    <p className="text-xs text-muted-foreground">موقّع ومعتمد رسمياً</p>
                  </div>
                  <Button className="w-full" size="sm">
                    <Download className="w-4 h-4 ml-1" />تحميل التقرير النهائي
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Payment History */}
            <PaymentHistory requestId={id!} refreshKey={paymentRefreshKey} />

            {/* Documents */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />المستندات ({documents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد مستندات</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{doc.file_name}</span>
                        {doc.ai_category && (
                          <Badge variant="secondary" className="text-[10px] h-5">{doc.ai_category}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
