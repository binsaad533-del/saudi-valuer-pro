import { useEffect, useState, useRef } from "react";
import { EnhancedRequestTracker } from "@/components/client/EnhancedRequestTracker";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  Clock, Shield, AlertCircle,
  Package, Trash2, Edit,
} from "lucide-react";
import PaymentCheckout from "@/components/payments/PaymentCheckout";
import PaymentHistory from "@/components/payments/PaymentHistory";
import DraftReportReview from "@/components/client/DraftReportReview";
import DataPortalUploader from "@/components/client/DataPortalUploader";
import { deriveInspectionType } from "@/lib/sow-engine";
import { formatDate, formatNumber } from "@/lib/utils";
import BidiText from "@/components/ui/bidi-text";
import { SAR, SARIcon } from "@/components/ui/saudi-riyal";
import { changeStatusByRequestId } from "@/lib/workflow-status";
import { useRealtimeAssignment } from "@/hooks/useRealtimeAssignment";

// Aligned with the 19-status workflow engine
const STATUS_ORDER = [
  "draft", "submitted", "scope_generated", "scope_approved",
  "first_payment_confirmed", "data_collection_open", "data_collection_complete",
  "inspection_pending", "inspection_completed", "data_validated",
  "analysis_complete", "professional_review", "draft_report_ready",
  "client_review", "draft_approved", "final_payment_confirmed",
  "issued", "archived", "cancelled",
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
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [paymentType, setPaymentType] = useState("first");
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);

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
    setRequest(reqRes.data);
    setMessages(msgRes.data || []);
    setDocuments(docRes.data || []);
    setPayments(payRes.data || []);
    const reqData = reqRes.data as any;
    if (reqData?.assignment_id) {
      const { data: reps } = await supabase.from("reports" as any).select("*").eq("assignment_id", reqData.assignment_id).order("created_at", { ascending: false });
      setReports((reps as any[]) || []);
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
  }, [id, navigate]);

  // Real-time assignment status updates
  useRealtimeAssignment(request?.assignment_id, (newStatus, oldStatus) => {
    toast({ title: "تحديث حالة الطلب", description: `تم تغيير الحالة من ${oldStatus} إلى ${newStatus}` });
    loadData();
  });

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
      if (approved) {
        // Use RPC to transition: scope_generated → scope_approved
        const result = await changeStatusByRequestId(id!, "scope_approved", {
          reason: "العميل وافق على عرض السعر ونطاق العمل",
        });
        if (!result.success) throw new Error(result.error);
        await supabase.from("valuation_requests" as any).update({
          quotation_response_at: new Date().toISOString(),
          quotation_approved_at: new Date().toISOString(),
        } as any).eq("id", id!);
      } else {
        // Rejection — use RPC to cancel
        const result = await changeStatusByRequestId(id!, "cancelled", {
          reason: "العميل رفض عرض السعر",
        });
        if (!result.success) throw new Error(result.error);
        await supabase.from("valuation_requests" as any).update({
          quotation_response_at: new Date().toISOString(),
        } as any).eq("id", id!);
      }
      await supabase.from("request_messages" as any).insert({
        request_id: id!, sender_type: "system" as any,
        content: approved ? "✅ تم قبول عرض السعر واعتماد نطاق العمل من قبل العميل" : "❌ تم رفض عرض السعر من قبل العميل",
      });
      toast({ title: approved ? "تم قبول العرض واعتماد النطاق" : "تم رفض العرض" });
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
      const amount = parseFloat(String(paymentType === "first" ? request.first_payment_amount : (request.total_fees - (request.amount_paid || 0))));
      await supabase.from("payment_receipts" as any).insert({
        request_id: id!, uploaded_by: user.id, file_name: file.name,
        file_path: filePath, amount, payment_type: paymentType, status: "pending",
      });
      const isFirst = paymentType === "first";
      // Update payment_status only (status transition handled by payment processing)
      await supabase.from("valuation_requests" as any).update({
        payment_status: "payment_uploaded",
      } as any).eq("id", id!);
      await supabase.from("request_messages" as any).insert({
        request_id: id!, sender_type: "system" as any,
        content: `📎 تم رفع إيصال دفع بمبلغ ${formatNumber(amount)} ر.س - ${isFirst ? "الدفعة الأولى" : "الدفعة النهائية"}`,
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
    // Use workflow engine labels (19-status)
    const wfLabel = WF_STATUS_LABELS[status];
    if (wfLabel) return wfLabel.client_ar || wfLabel.ar;
    // Fallback for any legacy statuses
    const fallback: Record<string, string> = {
      sow_generated: "نطاق العمل جاهز", sow_sent: "نطاق العمل مُرسل",
      quotation_sent: "عرض سعر مرسل", awaiting_payment: "بانتظار الدفع",
      in_production: "قيد التنفيذ", completed: "مكتمل",
    };
    return fallback[status] || status;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!request) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">الطلب غير موجود</p></div>;
  }

  const needsPayment = ["awaiting_payment", "quotation_approved", "sow_approved"].includes(request.status);
  const needsFinalPayment = ["final_payment_pending"].includes(request.status) && request.payment_structure === "partial";
  const showQuotation = request.quotation_amount && ["quotation_sent", "quotation_approved", "quotation_rejected", "awaiting_payment"].includes(request.status);
  const showDraftReport = ["draft_report_sent", "draft_report_ready", "client_comments", "final_payment_pending"].includes(request.status);
  const showFinalReport = ["final_report_ready", "report_issued", "completed"].includes(request.status);
  const showSOW = request.status === "sow_sent";

  return (
    <div className="bg-background min-h-screen" dir="rtl">
      {/* ── Top Header ── */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">تفاصيل الطلب</h1>
                <div className="flex items-center gap-3 mt-0.5">
                  {request.reference_number && (
                    <span className="text-xs text-muted-foreground font-mono" dir="ltr">{request.reference_number}</span>
                  )}
                  {request.property_city_ar && (
                    <span className="text-xs text-muted-foreground">• {request.property_city_ar}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1">
                {getStatusLabel(request.status)}
              </Badge>
              {request.ai_intake_summary?.valuation_mode && (
                <Badge variant="outline" className="text-xs">
                  {request.ai_intake_summary.valuation_mode === "desktop" ? "تقييم مكتبي" : "تقييم ميداني"}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Progress Timeline ── */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <EnhancedRequestTracker status={request.status} createdAt={request.created_at} valuationMode={request.ai_intake_summary?.valuation_mode || "field"} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Draft Report — Full-width professional workspace ── */}
        {showDraftReport && (
          <DraftReportReview
            requestId={id!}
            userId={user.id}
            paymentStructure={request.payment_structure}
            onStatusChange={loadData}
          />
        )}

        {/* ── Final Report — Full-width ── */}
        {showFinalReport && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">التقرير النهائي</h2>
                <p className="text-xs text-muted-foreground">موقّع ومعتمد رسمياً</p>
              </div>
            </div>
            <div className="p-5 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl text-center border border-emerald-100 dark:border-emerald-900/30">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-foreground text-sm">التقرير النهائي جاهز للتحميل</p>
              {request.report_number && (
                <p className="text-xs font-mono text-primary mt-2" dir="ltr">رقم التقرير: {request.report_number}</p>
              )}
            </div>
            {request.verification_code && (
              <div className="p-3 bg-muted/30 rounded-lg text-center">
                <p className="text-[10px] text-muted-foreground mb-1">رمز التحقق</p>
                <p className="text-xs font-mono text-foreground select-all" dir="ltr">{request.verification_code}</p>
                <a href={`/verify/${request.verification_code}`} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline mt-1 inline-block">
                  التحقق من صحة التقرير ←
                </a>
              </div>
            )}
            <Button className="w-full" size="lg"><Download className="w-4 h-4 ml-2" />تحميل التقرير النهائي</Button>
          </div>
        )}

        {/* ── Main 3-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Chat (2 cols) ── */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm h-[calc(100vh-300px)] flex flex-col">
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
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isAI ? "gradient-primary" : isClient ? "bg-muted" : "bg-accent"}`}>
                        {isAI ? <Bot className="w-3.5 h-3.5 text-primary-foreground" /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${isClient ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        {isAI ? <div className="prose prose-sm max-w-none dark:prose-invert" dir="rtl"><ReactMarkdown>{msg.content}</ReactMarkdown></div> : <p>{msg.content}</p>}
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
                  <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendMessage()} placeholder="اكتب ملاحظة أو استفسار..." disabled={sending} dir="rtl" />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sending} size="icon">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">
            {/* Request Info */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 flex-row-reverse justify-end">
                  <span>معلومات الطلب</span>
                  <Building2 className="w-4 h-4 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                {request.property_description_ar && (
                  <div>
                    <span className="text-muted-foreground text-xs">الوصف:</span>
                    <BidiText className="text-foreground text-xs mt-0.5">{request.property_description_ar}</BidiText>
                  </div>
                )}
                {request.property_city_ar && (
                  <div className="flex justify-between"><span className="text-muted-foreground text-xs">المدينة:</span><span className="text-xs">{request.property_city_ar}</span></div>
                )}
                {request.land_area && (
                  <div className="flex justify-between"><span className="text-muted-foreground text-xs">مساحة الأرض:</span><span dir="ltr" className="text-xs">{request.land_area} م²</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">تاريخ الطلب:</span><span className="text-xs">{formatDate(request.created_at)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">التسليم المتوقع:</span>
                  <span className="text-xs">{(() => { const d = new Date(request.created_at); d.setDate(d.getDate() + (request.ai_intake_summary?.valuation_mode === "desktop" ? 5 : 10)); return formatDate(d.toISOString()); })()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Asset Summary */}
            {request.asset_data?.inventory && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 flex-row-reverse justify-end">
                    <span>ملخص الأصول</span>
                    <Package className="w-4 h-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(() => {
                    const TYPE_INFO: Record<string, { label: string; desc: string }> = {
                      real_estate: { label: "عقارات", desc: "أراضي، مباني، فلل، شقق" },
                      machinery_equipment: { label: "آلات ومعدات", desc: "معدات تشغيلية وصناعية" },
                      furniture_fixtures: { label: "أثاث ومفروشات", desc: "أثاث مكتبي وتجهيزات" },
                      vehicles: { label: "مركبات", desc: "مركبات كأصل ثابت" },
                      technology_equipment: { label: "أجهزة تقنية", desc: "حاسبات وسيرفرات" },
                      medical_equipment: { label: "أجهزة طبية", desc: "معدات طبية ومختبرات" },
                      leasehold_improvements: { label: "تحسينات مستأجرة", desc: "تشطيبات وديكورات" },
                      right_of_use: { label: "مصالح مستأجرة", desc: "حقوق منفعة عقارية" },
                    };
                    const NON_PERMITTED = ["intangible_assets", "financial_instruments", "biological_assets", "inventory_stock"];
                    const inventory = request.asset_data.inventory as any[];
                    const counts: Record<string, number> = {};
                    for (const a of inventory) {
                      if (NON_PERMITTED.includes(a.type)) continue;
                      counts[a.type] = (counts[a.type] || 0) + 1;
                    }
                    const total = Object.values(counts).reduce((s: number, c: number) => s + c, 0);
                    return (
                      <>
                        <div className="flex justify-between items-center text-xs border-b border-border pb-2 mb-1">
                          <span className="text-foreground font-bold">إجمالي الأصول</span>
                          <Badge className="text-[11px]">{total}</Badge>
                        </div>
                        {Object.entries(counts).map(([type, count]) => {
                          const info = TYPE_INFO[type];
                          return (
                            <div key={type} className="flex justify-between items-start text-xs gap-2">
                              <div className="min-w-0">
                                <span className="font-medium text-foreground">{info?.label || type}</span>
                                {info?.desc && <p className="text-[10px] text-muted-foreground truncate">{info.desc}</p>}
                              </div>
                              <Badge variant="secondary" className="text-[10px] shrink-0">{count}</Badge>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Client Actions */}
            {["submitted", "under_pricing", "needs_clarification", "quotation_sent"].includes(request.status) && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 flex-row-reverse justify-end">
                    <span>إجراءات</span>
                    <AlertCircle className="w-4 h-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2" onClick={() => navigate(`/client/new-request?edit=${id}`)}>
                    <Edit className="w-3.5 h-3.5" />تعديل الطلب
                  </Button>
                  <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/5" onClick={async () => {
                    if (!confirm("هل أنت متأكد من إلغاء الطلب؟")) return;
                    setSending(true);
                    try {
                      const result = await changeStatusByRequestId(id!, "cancelled", { reason: "إلغاء من العميل" });
                      if (!result.success) throw new Error(result.error);
                      await supabase.from("request_messages" as any).insert({ request_id: id!, sender_type: "system" as any, content: "❌ تم إلغاء الطلب من قبل العميل" });
                      toast({ title: "تم إلغاء الطلب" });
                      navigate("/client");
                    } catch (err: any) {
                      toast({ title: "خطأ", description: err.message, variant: "destructive" });
                    } finally { setSending(false); }
                  }}>
                    <Trash2 className="w-3.5 h-3.5" />إلغاء الطلب
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* SOW Approval */}
            {showSOW && (
              <Card className="shadow-sm border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 flex-row-reverse justify-end">
                    <span>نطاق العمل</span>
                    <FileText className="w-4 h-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-primary/5 rounded-lg space-y-3 max-h-64 overflow-y-auto">
                    <BidiText className="text-xs text-foreground" preserveNewlines>{request.scope_of_work_ar}</BidiText>
                  </div>
                  {request.sow_special_assumptions_ar && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">الافتراضات الخاصة:</p>
                      <BidiText className="text-xs text-amber-700 dark:text-amber-300" preserveNewlines>{request.sow_special_assumptions_ar}</BidiText>
                    </div>
                  )}
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">بالموافقة على نطاق العمل، أقر بأنني اطلعت على الافتراضات والمحددات وأوافق عليها.</p>
                    <Button className="w-full" size="sm" onClick={async () => {
                      setSending(true);
                      try {
                        const result = await changeStatusByRequestId(id!, "scope_approved", { reason: "اعتماد نطاق العمل من العميل" });
                        if (!result.success) throw new Error(result.error);
                        await supabase.from("valuation_requests" as any).update({ sow_signed_at: new Date().toISOString() } as any).eq("id", id!);
                        await supabase.from("request_messages" as any).insert({ request_id: id!, sender_type: "system" as any, content: "✅ تم اعتماد نطاق العمل والتوقيع الإلكتروني من قبل العميل" });
                        toast({ title: "تم اعتماد نطاق العمل بنجاح" });
                        loadData();
                      } catch (err: any) {
                        toast({ title: "خطأ", description: err.message, variant: "destructive" });
                      } finally { setSending(false); }
                    }} disabled={sending}>
                      <CheckCircle className="w-3 h-3 ml-1" />موافقة وتوقيع إلكتروني
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Data Portal */}
            <DataPortalUploader
              requestId={id!}
              inspectionType={deriveInspectionType(
                request.inspection_type || request.ai_intake_summary?.valuation_mode || "field",
                (request.inspection_type === "desktop_with_photos") || undefined
              )}
              status={request.status}
              onUploadComplete={loadData}
            />

            {/* Quotation */}
            {showQuotation && (
              <Card className="shadow-sm border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 flex-row-reverse justify-end">
                    <span>عرض السعر</span>
                    <SARIcon className="w-4 h-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-primary/5 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">المبلغ قبل الضريبة</span>
                      <span className="font-medium" dir="ltr">{formatNumber(Number(request.quotation_amount))} <SAR /></span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">ضريبة القيمة المضافة (15%)</span>
                      <span className="font-medium" dir="ltr">{formatNumber(Math.round(Number(request.quotation_amount) * 0.15))} <SAR /></span>
                    </div>
                    <div className="border-t border-border pt-2 flex items-center justify-between">
                      <span className="font-semibold text-sm">الإجمالي شامل الضريبة</span>
                      <span className="text-lg font-bold text-primary" dir="ltr">{formatNumber(Math.round(Number(request.quotation_amount) * 1.15))} <SAR /></span>
                    </div>
                    {request.payment_structure === "partial" && (
                      <div className="mt-1 text-xs text-muted-foreground space-y-1 border-t border-border pt-2">
                        <p>الدفعة الأولى: {formatNumber(Number(request.first_payment_amount))} <SAR /></p>
                        <p>الدفعة النهائية: {formatNumber(request.total_fees - request.first_payment_amount)} <SAR /></p>
                      </div>
                    )}
                  </div>
                  {request.ai_suggested_turnaround && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="w-3 h-3" /><span>المدة: {request.ai_suggested_turnaround}</span></div>
                  )}
                  {request.scope_of_work_ar && (
                    <div><p className="text-xs text-muted-foreground mb-1">نطاق العمل:</p><BidiText className="text-xs bg-muted/50 p-2 rounded">{request.scope_of_work_ar}</BidiText></div>
                  )}
                  {request.terms_ar && (
                    <div><p className="text-xs text-muted-foreground mb-1">الشروط:</p><p className="text-xs bg-muted/50 p-2 rounded">{request.terms_ar}</p></div>
                  )}
                  {request.status === "quotation_sent" && (
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" size="sm" onClick={() => handleQuotationResponse(true)} disabled={sending}><CheckCircle className="w-3 h-3 ml-1" />قبول العرض</Button>
                      <Button variant="outline" className="flex-1" size="sm" onClick={() => handleQuotationResponse(false)} disabled={sending}><XCircle className="w-3 h-3 ml-1" />رفض</Button>
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

            {/* Manual Receipt Upload */}
            {(needsPayment || needsFinalPayment) && (
              <Card className="shadow-sm border-border">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground text-center">أو رفع إيصال يدوياً (حالات استثنائية)</p>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleUploadReceipt} className="hidden" />
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setPaymentType(needsFinalPayment ? "final" : "first"); fileInputRef.current?.click(); }} disabled={uploading}>
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Upload className="w-3 h-3 ml-1" />}رفع إيصال يدوي
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Online Payments History */}
            <PaymentHistory requestId={id!} refreshKey={paymentRefreshKey} />

            {/* Documents */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 flex-row-reverse justify-end">
                  <span>المستندات ({documents.length})</span>
                  <FileText className="w-4 h-4 text-primary" />
                </CardTitle>
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
