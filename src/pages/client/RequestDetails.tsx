import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  FileText, Loader2, Send, Upload, Download, CheckCircle, User,
  CreditCard, Eye, ChevronDown, ChevronUp,
} from "lucide-react";
import { EnhancedRequestTracker } from "@/components/client/EnhancedRequestTracker";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import RaqeemTypingIndicator from "@/components/client/chat/RaqeemTypingIndicator";
import QuickActionButtons from "@/components/client/chat/QuickActionButtons";
import MessageRating from "@/components/client/chat/MessageRating";
import PaymentCheckout from "@/components/payments/PaymentCheckout";
import DraftReportReview from "@/components/client/DraftReportReview";
import { changeStatusByRequestId } from "@/lib/workflow-status";
import { STATUS_LABELS as WF_STATUS_LABELS } from "@/lib/workflow-engine";
import { useRealtimeAssignment } from "@/hooks/useRealtimeAssignment";
import { formatDate, formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";
import { getValuationModeLabel, isDesktopValuationMode, getTurnaroundDays } from "@/lib/valuation-mode";
import BidiText from "@/components/ui/bidi-text";

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [request, setRequest] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setUser(user);
    const [reqRes, msgRes, docRes] = await Promise.all([
      supabase.from("valuation_requests" as any).select("*").eq("id", id!).single(),
      supabase.from("request_messages" as any).select("*").eq("request_id", id!).order("created_at"),
      supabase.from("request_documents" as any).select("*").eq("request_id", id!).order("created_at"),
    ]);
    setRequest(reqRes.data);
    setMessages(msgRes.data || []);
    setDocuments(docRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel(`request-messages-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "request_messages", filter: `request_id=eq.${id}` },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages(prev => {
            const dominated = prev.some(m => m.id === newMsg.id || (m.id?.startsWith("local-ai-") && m.sender_type === newMsg.sender_type && m.content === newMsg.content));
            if (dominated) return prev.map(m => m.id?.startsWith("local-ai-") && m.sender_type === newMsg.sender_type && m.content === newMsg.content ? newMsg : m);
            return [...prev, newMsg];
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, navigate]);

  useRealtimeAssignment(request?.assignment_id, async (newStatus, oldStatus) => {
    toast({ title: "تحديث حالة الطلب", description: `تم تغيير الحالة إلى: ${getStatusLabel(newStatus)}` });
    loadData();
  });

  useEffect(() => {
    chatEndRef.current?.parentElement && (chatEndRef.current.parentElement.scrollTop = chatEndRef.current.parentElement.scrollHeight);
  }, [messages]);

  const getStatusLabel = (status: string) => {
    const wf = WF_STATUS_LABELS[status];
    if (wf) return wf.client_ar || wf.ar;
    return status;
  };

  const callRaqeemAI = async (clientMessage: string) => {
    setAiTyping(true);
    try {
      const conversationHistory = messages.slice(-16).map(m => ({ content: m.content, sender_type: m.sender_type }));
      const valuationMode = request?.ai_intake_summary?.valuation_mode || request?.inspection_type || "field";
      const { data: functionData, error } = await supabase.functions.invoke("raqeem-client-chat", {
        body: {
          message: clientMessage, request_id: id, conversationHistory,
          requestContext: {
            assignment_id: request?.assignment_id, reference_number: request?.reference_number,
            status: request?.status, status_label: getStatusLabel(request?.status),
            valuation_mode: valuationMode, total_fees: request?.total_fees,
          },
        },
      });
      if (error) { toast({ title: "تعذر الرد حالياً", variant: "destructive" }); return; }
      const reply = functionData?.reply?.trim();
      if (!reply) return;
      setMessages(prev => {
        if (prev.some(m => m.sender_type === "ai" && m.content === reply)) return prev;
        return [...prev, { id: `local-ai-${Date.now()}`, sender_type: "ai", content: reply, created_at: new Date().toISOString() }];
      });
    } catch { toast({ title: "تعذر الرد حالياً", variant: "destructive" }); }
    finally { setAiTyping(false); }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    const msgText = newMessage.trim();
    setSending(true);
    try {
      await supabase.from("request_messages" as any).insert({ request_id: id!, sender_id: user.id, sender_type: "client" as any, content: msgText });
      setNewMessage("");
      callRaqeemAI(msgText);
    } finally { setSending(false); }
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\p{L}\p{N}._()-]+/gu, "-");
      const filePath = `${user.id}/chat/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("client-uploads").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      await supabase.from("request_documents" as any).insert({ request_id: id!, uploaded_by: user.id, file_name: file.name, file_path: filePath, file_size: file.size, mime_type: file.type });
      const icon = file.type.startsWith("image/") ? "🖼️" : "📎";
      await supabase.from("request_messages" as any).insert({ request_id: id!, sender_id: user.id, sender_type: "client" as any, content: `${icon} مرفق: ${file.name}` });
      toast({ title: "تم رفع المرفق" });
      loadData();
      callRaqeemAI(`تم رفع ملف جديد: ${file.name}`);
    } catch (err: any) { toast({ title: "خطأ", description: err.message, variant: "destructive" }); }
    finally { setUploading(false); if (chatFileRef.current) chatFileRef.current.value = ""; }
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
        {/* Primary CTA */}
        {primaryCTA && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-bold text-foreground">المطلوب الآن</p>

              {/* SOW Approval inline */}
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

              {/* Draft */}
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
                  <input ref={chatFileRef} type="file" className="hidden" accept="image/*,.pdf,.xlsx,.xls" onChange={handleChatFileUpload} />
                  <Button className="w-full" onClick={() => chatFileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Upload className="w-4 h-4 ml-1" />}
                    ارفع المستندات
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Collapsible Details */}
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

              {/* Documents */}
              {documents.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-muted-foreground font-medium">المستندات</p>
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 bg-muted/30 rounded p-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{doc.file_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Chat with Raqeem */}
        <Card className="min-h-[400px] flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <RaqeemAnimatedLogo size={20} />
            <span className="text-xs font-bold text-foreground">رقيم — مساعدك الذكي</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
            {messages.map((msg) => {
              const isClient = msg.sender_type === "client";
              const isAI = msg.sender_type === "ai";
              const isSystem = msg.sender_type === "system";
              if (isSystem) return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-[10px] text-muted-foreground text-center">{msg.content}</div>
                </div>
              );
              return (
                <div key={msg.id} className={`flex gap-2 ${isClient ? "flex-row-reverse" : ""}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isClient ? "bg-muted" : ""}`}>
                    {isAI ? <RaqeemAnimatedLogo size={24} /> : <User className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${isClient ? "bg-primary text-primary-foreground" : "bg-card border text-foreground"}`}>
                    {isAI ? <div className="prose prose-sm max-w-none dark:prose-invert" dir="rtl"><ReactMarkdown>{msg.content}</ReactMarkdown></div> : <p>{msg.content}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[10px] ${isClient ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isAI && <MessageRating messageId={msg.id} requestId={id!} />}
                    </div>
                  </div>
                </div>
              );
            })}
            {aiTyping && <RaqeemTypingIndicator />}
            <div ref={chatEndRef} />
          </div>

          <div className="px-4 py-2 border-t border-border/50">
            <QuickActionButtons
              status={request.status}
              valuationMode={valuationMode}
              onAction={async (msg) => {
                if (!user) return;
                setSending(true);
                try {
                  await supabase.from("request_messages" as any).insert({ request_id: id!, sender_id: user.id, sender_type: "client" as any, content: msg });
                  callRaqeemAI(msg);
                } finally { setSending(false); }
              }}
              disabled={sending || aiTyping}
            />
          </div>

          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendMessage()} placeholder="اسأل رقيم..." disabled={sending || uploading} className="flex-1 text-sm" />
              <input ref={chatFileRef} type="file" className="hidden" accept="image/*,.pdf,.xlsx,.xls" onChange={handleChatFileUpload} />
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => chatFileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </Button>
              <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sending} size="icon" className="h-9 w-9">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
