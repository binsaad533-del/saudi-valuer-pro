import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  ArrowRight, FileText, MessageSquare, Send, Loader2, Bot, User,
  CreditCard, Building2, CheckCircle, XCircle, Upload, Download,
  Clock, DollarSign, Shield, AlertCircle,
} from "lucide-react";
import logo from "@/assets/logo.png";
import PaymentCheckout from "@/components/payments/PaymentCheckout";
import PaymentHistory from "@/components/payments/PaymentHistory";

const STATUS_TIMELINE = [
  { key: "submitted", label: "تم الإرسال" },
  { key: "under_pricing", label: "قيد التسعير" },
  { key: "quotation_sent", label: "عرض السعر" },
  { key: "awaiting_payment", label: "الدفع" },
  { key: "in_production", label: "التنفيذ" },
  { key: "draft_report_sent", label: "المسودة" },
  { key: "final_report_ready", label: "التقرير النهائي" },
  { key: "completed", label: "مكتمل" },
];

const STATUS_ORDER = [
  "draft", "ai_review", "submitted", "needs_clarification", "under_pricing",
  "quotation_sent", "quotation_approved", "quotation_rejected",
  "awaiting_payment", "payment_uploaded", "payment_under_review",
  "partially_paid", "fully_paid", "in_production", "draft_report_sent",
  "client_comments", "final_payment_pending", "final_payment_uploaded",
  "final_payment_approved", "final_report_ready", "completed",
];

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [request, setRequest] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState("first");
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/client/login"); return; }
    setUser(user);

    const [reqRes, msgRes, docRes, payRes] = await Promise.all([
      supabase.from("valuation_requests" as any).select("*").eq("id", id!).single(),
      supabase.from("request_messages" as any).select("*").eq("request_id", id!).order("created_at"),
      supabase.from("request_documents" as any).select("*").eq("request_id", id!).order("created_at"),
      supabase.from("payment_receipts" as any).select("*").eq("request_id", id!).order("created_at"),
    ]);

    setRequest(reqRes.data);
    setMessages(msgRes.data || []);
    setDocuments(docRes.data || []);
    setPayments(payRes.data || []);
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
  }, [id, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleQuotationResponse = async (approved: boolean) => {
    setSending(true);
    try {
      const newStatus = approved ? "awaiting_payment" : "quotation_rejected";
      await supabase.from("valuation_requests" as any).update({
        status: newStatus as any,
        quotation_response_at: new Date().toISOString(),
        ...(approved ? { quotation_approved_at: new Date().toISOString() } : {}),
      } as any).eq("id", id!);

      await supabase.from("request_messages" as any).insert({
        request_id: id!, sender_type: "system" as any,
        content: approved ? "✅ تم قبول عرض السعر من قبل العميل" : "❌ تم رفض عرض السعر من قبل العميل",
      });

      toast({ title: approved ? "تم قبول العرض" : "تم رفض العرض" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !request) return;
    setUploading(true);
    try {
      const filePath = `receipts/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("client-uploads").upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const amount = paymentAmount ? parseFloat(paymentAmount) : (
        paymentType === "first" ? request.first_payment_amount : (request.total_fees - (request.amount_paid || 0))
      );

      await supabase.from("payment_receipts" as any).insert({
        request_id: id!, uploaded_by: user.id, file_name: file.name,
        file_path: filePath, amount, payment_type: paymentType, status: "pending",
      });

      const isFirst = paymentType === "first";
      await supabase.from("valuation_requests" as any).update({
        status: (isFirst ? "payment_uploaded" : "final_payment_uploaded") as any,
        payment_status: "payment_uploaded",
      } as any).eq("id", id!);

      await supabase.from("request_messages" as any).insert({
        request_id: id!, sender_type: "system" as any,
        content: `📎 تم رفع إيصال دفع بمبلغ ${amount.toLocaleString()} ر.س - ${isFirst ? "الدفعة الأولى" : "الدفعة النهائية"}`,
      });

      toast({ title: "تم رفع الإيصال بنجاح" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: "مسودة", submitted: "تم الإرسال", needs_clarification: "يحتاج توضيح",
      under_pricing: "قيد التسعير", quotation_sent: "عرض سعر مرسل",
      quotation_approved: "عرض معتمد", quotation_rejected: "عرض مرفوض",
      awaiting_payment: "بانتظار الدفع", payment_uploaded: "إيصال مرفوع",
      partially_paid: "مدفوع جزئياً", fully_paid: "مدفوع بالكامل",
      in_production: "قيد التنفيذ", draft_report_sent: "مسودة التقرير",
      client_comments: "ملاحظات", final_payment_pending: "بانتظار الدفعة النهائية",
      final_report_ready: "التقرير جاهز", completed: "مكتمل",
    };
    return map[status] || status;
  };

  const currentStepIndex = STATUS_ORDER.indexOf(request?.status || "draft");

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!request) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">الطلب غير موجود</p></div>;
  }

  const needsPayment = ["awaiting_payment", "quotation_approved"].includes(request.status);
  const needsFinalPayment = ["final_payment_pending", "draft_report_sent"].includes(request.status) && request.payment_structure === "partial";
  const showQuotation = request.quotation_amount && ["quotation_sent", "quotation_approved", "quotation_rejected", "awaiting_payment"].includes(request.status);
  const showDraftReport = ["draft_report_sent", "client_comments", "final_payment_pending"].includes(request.status);
  const showFinalReport = ["final_report_ready", "completed"].includes(request.status);

  return (
    <div className="min-h-screen bg-background">
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
            <Badge className="bg-primary/10 text-primary">{getStatusLabel(request.status)}</Badge>
            <Button variant="ghost" size="sm" onClick={() => navigate("/client")}><ArrowRight className="w-4 h-4 ml-1" />العودة</Button>
          </div>
        </div>
      </header>

      {/* Progress Timeline */}
      <div className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between overflow-x-auto gap-1">
            {STATUS_TIMELINE.map((step, i) => {
              const stepIndex = STATUS_ORDER.indexOf(step.key);
              const isActive = currentStepIndex >= stepIndex;
              const isCurrent = request.status === step.key || (i > 0 && STATUS_ORDER.indexOf(STATUS_TIMELINE[i-1].key) < currentStepIndex && stepIndex >= currentStepIndex);
              return (
                <div key={step.key} className="flex items-center gap-1 min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {isActive ? "✓" : i + 1}
                  </div>
                  <span className={`text-[10px] whitespace-nowrap ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}>{step.label}</span>
                  {i < STATUS_TIMELINE.length - 1 && <div className={`h-px w-4 shrink-0 ${isActive ? "bg-primary" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat */}
          <div className="lg:col-span-2">
            <Card className="shadow-card h-[calc(100vh-240px)] flex flex-col">
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
                        {isAI ? <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{msg.content}</ReactMarkdown></div> : <p>{msg.content}</p>}
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
                  <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendMessage()} placeholder="اكتب ملاحظة أو استفسار..." disabled={sending} />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sending} size="icon">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Request Info */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />معلومات الطلب</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {request.property_description_ar && <div><span className="text-muted-foreground text-xs">الوصف:</span><p className="text-foreground">{request.property_description_ar}</p></div>}
                {request.property_city_ar && <div className="flex justify-between"><span className="text-muted-foreground text-xs">المدينة:</span><span>{request.property_city_ar}</span></div>}
                {request.land_area && <div className="flex justify-between"><span className="text-muted-foreground text-xs">مساحة الأرض:</span><span dir="ltr">{request.land_area} م²</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">تاريخ الطلب:</span><span>{new Date(request.created_at).toLocaleDateString("ar-SA")}</span></div>
              </CardContent>
            </Card>

            {/* Quotation Card */}
            {showQuotation && (
              <Card className="shadow-card border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" />عرض السعر</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center p-3 bg-primary/5 rounded-lg">
                    <p className="text-2xl font-bold text-primary" dir="ltr">{Number(request.quotation_amount).toLocaleString()} ر.س</p>
                    {request.payment_structure === "partial" && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        <p>الدفعة الأولى: {Number(request.first_payment_amount).toLocaleString()} ر.س</p>
                        <p>الدفعة النهائية: {(request.total_fees - request.first_payment_amount).toLocaleString()} ر.س</p>
                      </div>
                    )}
                  </div>
                  {request.ai_suggested_turnaround && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /><span>المدة: {request.ai_suggested_turnaround}</span>
                    </div>
                  )}
                  {request.scope_of_work_ar && (
                    <div><p className="text-xs text-muted-foreground mb-1">نطاق العمل:</p><p className="text-xs bg-muted/50 p-2 rounded">{request.scope_of_work_ar}</p></div>
                  )}
                  {request.terms_ar && (
                    <div><p className="text-xs text-muted-foreground mb-1">الشروط:</p><p className="text-xs bg-muted/50 p-2 rounded">{request.terms_ar}</p></div>
                  )}
                  {request.status === "quotation_sent" && (
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" size="sm" onClick={() => handleQuotationResponse(true)} disabled={sending}>
                        <CheckCircle className="w-3 h-3 ml-1" />قبول العرض
                      </Button>
                      <Button variant="outline" className="flex-1" size="sm" onClick={() => handleQuotationResponse(false)} disabled={sending}>
                        <XCircle className="w-3 h-3 ml-1" />رفض
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Online Payment */}
            {(needsPayment || needsFinalPayment) && (
              <PaymentCheckout
                request={request}
                paymentStage={needsFinalPayment ? "final" : request.payment_structure === "partial" ? "first" : "full"}
                onPaymentComplete={() => { setPaymentRefreshKey(k => k + 1); loadData(); }}
              />
            )}

            {/* Manual Receipt Upload (backup) */}
            {(needsPayment || needsFinalPayment) && (
              <Card className="shadow-card border-border">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground text-center">أو رفع إيصال يدوياً (حالات استثنائية)</p>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleUploadReceipt} className="hidden" />
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => {
                    setPaymentType(needsFinalPayment ? "final" : "first");
                    fileInputRef.current?.click();
                  }} disabled={uploading}>
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Upload className="w-3 h-3 ml-1" />}
                    رفع إيصال يدوي
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Draft Report */}
            {showDraftReport && (
              <Card className="shadow-card border-info/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-info" />مسودة التقرير
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-4 bg-muted/30 rounded-lg border-2 border-dashed border-warning/30 text-center">
                    <div className="text-warning font-bold text-lg mb-1 opacity-40">DRAFT / مسودة</div>
                    <p className="text-xs text-muted-foreground">هذه مسودة للمراجعة - ليست التقرير النهائي</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertCircle className="w-3 h-3" />
                    <span>يمكنك إضافة ملاحظاتك عبر المحادثة</span>
                  </div>
                  {request.draft_report_url && (
                    <Button variant="outline" className="w-full" size="sm">
                      <Download className="w-3 h-3 ml-1" />تحميل المسودة
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Final Report */}
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

            {/* Online Payments History */}
            <PaymentHistory requestId={id!} refreshKey={paymentRefreshKey} />

            {/* Documents */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />المستندات ({documents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد مستندات</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{doc.file_name}</span>
                        {doc.ai_category && <Badge variant="secondary" className="text-[10px] h-5">{doc.ai_category}</Badge>}
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
