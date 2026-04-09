import { useEffect, useState, useRef } from "react";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import { EnhancedRequestTracker } from "@/components/client/EnhancedRequestTracker";
import QuickActionButtons from "@/components/client/chat/QuickActionButtons";
import ChatProgressBar from "@/components/client/chat/ChatProgressBar";
import MessageRating from "@/components/client/chat/MessageRating";
import RaqeemTypingIndicator from "@/components/client/chat/RaqeemTypingIndicator";
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
  Clock, Shield, AlertCircle, Paperclip, Image as ImageIcon,
  Package, Trash2, Edit, Info,
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
import { STATUS_LABELS as WF_STATUS_LABELS } from "@/lib/workflow-engine";
import { useRealtimeAssignment } from "@/hooks/useRealtimeAssignment";
import StatusGuidanceCard from "@/components/client/StatusGuidanceCard";
import { getTurnaroundDays, getValuationModeLabel, isDesktopValuationMode } from "@/lib/valuation-mode";

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
  const chatFileRef = useRef<HTMLInputElement>(null);

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
  const [aiTyping, setAiTyping] = useState(false);
  const [aiSuggestedActions, setAiSuggestedActions] = useState<{ label: string; message: string }[]>([]);
  const [docReadiness, setDocReadiness] = useState<{ percent: number; missing: string[]; total: number } | null>(null);
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
        (payload) => {
          const newMsg = payload.new as any;
          setMessages(prev => {
            // Deduplicate: skip if we already have this DB id OR same content from local-ai optimistic insert
            const dominated = prev.some(m =>
              m.id === newMsg.id ||
              (m.id?.startsWith("local-ai-") && m.sender_type === newMsg.sender_type && m.content === newMsg.content)
            );
            if (dominated) {
              // Replace the local-ai placeholder with the real DB record
              return prev.map(m =>
                m.id?.startsWith("local-ai-") && m.sender_type === newMsg.sender_type && m.content === newMsg.content
                  ? newMsg
                  : m
              );
            }
            return [...prev, newMsg];
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, navigate]);

  // Real-time assignment status updates — inject system message + send email
  const NOTIFIABLE_STATUSES = ["scope_generated", "first_payment_confirmed", "data_collection_open", "inspection_pending", "draft_report_ready", "issued"];
  useRealtimeAssignment(request?.assignment_id, async (newStatus, oldStatus) => {
    const newLabel = getStatusLabel(newStatus);
    const oldLabel = getStatusLabel(oldStatus);
    toast({ title: "تحديث حالة الطلب", description: `تم تغيير الحالة إلى: ${newLabel}` });
    // Inject a visible system notification into the chat
    if (id) {
      await supabase.from("request_messages" as any).insert({
        request_id: id, sender_type: "system" as any,
        content: `🔄 تم تحديث حالة الطلب: **${oldLabel}** ← **${newLabel}**`,
      });
    }
    // Send email notification for key status changes
    if (NOTIFIABLE_STATUSES.includes(newStatus) && user?.email) {
      supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "status-update",
          recipientEmail: user.email,
          idempotencyKey: `status-${id}-${newStatus}`,
          templateData: {
            clientName: request?.client_name_ar || request?.ai_intake_summary?.client_name,
            requestNumber: request?.reference_number,
            newStatus,
            portalUrl: `${window.location.origin}/client/request/${id}`,
          },
        },
      }).catch(e => console.error("Email notification error:", e));
    }
    loadData();
  });

  useEffect(() => {
    const el = chatEndRef.current;
    if (el) {
      const container = el.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages]);

  const buildRequestContext = () => {
    if (!request) return {};
    const valuationMode = request.ai_intake_summary?.valuation_mode || request.inspection_type || "field";
    const inv = request.asset_data?.inventory as any[] | undefined;
    const assetCount = inv?.length || 0;
    const assetSummary = inv ? (() => {
      const counts: Record<string, number> = {};
      for (const a of inv) counts[a.type] = (counts[a.type] || 0) + 1;
      return Object.entries(counts).map(([t, c]) => `${t}: ${c}`).join("، ");
    })() : "";
    const imgDocs = documents.filter(d => d.mime_type?.startsWith("image/"));
    return {
      assignment_id: request.assignment_id,
      client_user_id: request.client_user_id || user?.id,
      organization_id: request.organization_id,
      reference_number: request.reference_number,
      status: request.status,
      status_label: getStatusLabel(request.status),
      client_name: request.client_name_ar || request.ai_intake_summary?.client_name,
      property_type: request.property_type_ar || request.ai_intake_summary?.property_type,
      property_city: request.property_city_ar,
      property_description: request.property_description_ar,
      valuation_mode: valuationMode,
      total_fees: request.total_fees,
      amount_paid: request.amount_paid,
      payment_status: request.payment_status,
      asset_count: assetCount,
      asset_summary: assetSummary,
      documents_count: documents.length,
      has_photos: imgDocs.length > 0,
      created_at: request.created_at,
    };
  };

  const callRaqeemAI = async (clientMessage: string) => {
    setAiTyping(true);
    try {
      const conversationHistory = messages.slice(-16).map(m => ({
        content: m.content,
        sender_type: m.sender_type,
      }));
      const { data: functionData, error } = await supabase.functions.invoke("raqeem-client-chat", {
        body: {
          message: clientMessage,
          request_id: id,
          conversationHistory,
          requestContext: buildRequestContext(),
        },
      });

      if (error) {
        console.error("Raqeem AI error:", error);
        toast({ title: "تعذر الرد حالياً", description: "حدث خلل أثناء التواصل مع رقيم.", variant: "destructive" });
        return;
      }

      const reply = functionData?.reply?.trim();
      if (!reply) {
        console.warn("Raqeem returned empty reply", functionData);
        return;
      }

      // Update suggested actions from AI
      if (functionData?.suggestedActions && Array.isArray(functionData.suggestedActions)) {
        setAiSuggestedActions(functionData.suggestedActions);
      }
      // Update document readiness
      if (functionData?.documentReadiness) {
        setDocReadiness(functionData.documentReadiness);
      }

      // Handle cancellation executed by Raqeem
      if (functionData?.cancelExecuted) {
        toast({ title: "تم إلغاء الطلب بنجاح" });
        setTimeout(() => window.location.reload(), 2000);
      }

      setMessages(prev => {
        const alreadyExists = prev.some(m => m.sender_type === "ai" && m.content === reply);
        if (alreadyExists) return prev;
        return [
          ...prev,
          {
            id: `local-ai-${Date.now()}`,
            sender_type: "ai",
            content: reply,
            created_at: new Date().toISOString(),
          },
        ];
      });
    } catch (e) {
      console.error("Raqeem AI call error:", e);
      toast({ title: "تعذر الرد حالياً", description: "حدث خلل أثناء تشغيل رقيم.", variant: "destructive" });
    } finally {
      setAiTyping(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    const msgText = newMessage.trim();
    setSending(true);
    try {
      await supabase.from("request_messages" as any).insert({
        request_id: id!, sender_id: user.id, sender_type: "client" as any, content: msgText,
      });
      setNewMessage("");
      // Call Raqeem AI in the background — response saved via edge function
      callRaqeemAI(msgText);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sanitizeStorageFileName = (originalName: string) => {
    const normalized = originalName
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .trim();

    const lastDotIndex = normalized.lastIndexOf(".");
    const hasExtension = lastDotIndex > 0;
    const rawBaseName = hasExtension ? normalized.slice(0, lastDotIndex) : normalized;
    const rawExtension = hasExtension ? normalized.slice(lastDotIndex + 1) : "";

    const baseName = rawBaseName
      .replace(/[\\/]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}._()-]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^[-._]+|[-._]+$/g, "") || "file";

    const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]+/g, "");

    return extension ? `${baseName}.${extension}` : baseName;
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const safeFileName = sanitizeStorageFileName(file.name);
      const filePath = `${user.id}/chat/${Date.now()}_${safeFileName}`;
      const { error: uploadErr } = await supabase.storage.from("client-uploads").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      // Save as document
      await supabase.from("request_documents" as any).insert({
        request_id: id!, uploaded_by: user.id, file_name: file.name, file_path: filePath, file_size: file.size, mime_type: file.type,
      });
      // Send message with attachment info
      const icon = file.type.startsWith("image/") ? "🖼️" : file.type.includes("pdf") ? "📄" : "📎";
      await supabase.from("request_messages" as any).insert({
        request_id: id!, sender_id: user.id, sender_type: "client" as any,
        content: `${icon} مرفق: ${file.name}`,
        metadata: { type: "attachment", file_path: filePath, file_name: file.name, mime_type: file.type },
      });
      toast({ title: "تم رفع المرفق بنجاح" });
      loadData();
      // Notify Raqeem about the attachment
      callRaqeemAI(`تم رفع ملف جديد: ${file.name} (${file.type})`);
    } catch (err: any) {
      toast({ title: "خطأ في رفع الملف", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (chatFileRef.current) chatFileRef.current.value = "";
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

  // ── Export chat as text file ──
  const handleExportChat = () => {
    const welcomeMsg = getRaqeemWelcome(request.status, request);
    const lines = [`=== سجل محادثة رقيم ===`, `الرقم المرجعي: ${request.reference_number || "—"}`, `التاريخ: ${new Date().toLocaleDateString("ar-SA")}`, `الحالة: ${getStatusLabel(request.status)}`, `${"=".repeat(40)}`, "", `رقيم: ${welcomeMsg}`, ""];
    for (const msg of messages) {
      const time = new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
      const sender = msg.sender_type === "client" ? "العميل" : msg.sender_type === "ai" ? "رقيم" : "النظام";
      lines.push(`[${time}] ${sender}: ${msg.content}`, "");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `محادثة-رقيم-${request.reference_number || id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم تصدير المحادثة بنجاح" });
  };

  // ── Raqeem proactive welcome message based on status ──
  const getRaqeemWelcome = (status: string, req: any): string => {
    const clientName = req?.client_name_ar || req?.ai_intake_summary?.client_name || "";
    const greeting = clientName ? `أهلاً ${clientName}` : "أهلاً بك";
    const refNum = req?.reference_number || "";
    const valuationMode = req?.ai_intake_summary?.valuation_mode || req?.inspection_type || "field";
    const isDesktop = isDesktopValuationMode(valuationMode);

    const statusMessages: Record<string, string> = {
      submitted: `${greeting} 👋\n\nأنا **رقيم – مساعدك الذكي** لمتابعة طلب التقييم${refNum ? ` رقم **${refNum}**` : ""}.\n\nطلبك قيد المراجعة الآن، وسأُبلغك فور جاهزية نطاق العمل وعرض السعر.${isDesktop ? "\n\nهذا الطلب مكتبي ولن يتضمن معاينة ميدانية." : ""}\n\nيمكنك سؤالي عن أي شيء أو إرفاق مستندات إضافية.`,
      under_pricing: `${greeting}\n\nطلبك بانتظار **إعداد عرض السعر** من فريق التسعير. سأُبلغك فور جاهزيته.\n\nإذا كان لديك أي استفسار، أنا هنا.`,
      scope_generated: `${greeting}\n\nتم إعداد **نطاق العمل وعرض السعر**.\n\nيرجى مراجعة التفاصيل في اللوحة الجانبية والموافقة عليها للمتابعة.`,
      scope_approved: `${greeting}\n\nتم اعتماد نطاق العمل ✅\n\nالخطوة التالية: **سداد الدفعة الأولى** لبدء التنفيذ${isDesktop ? " المكتبي" : ""}.`,
      first_payment_confirmed: `${greeting}\n\nتم تأكيد الدفعة ✅ بدأنا العمل على طلبك.${isDesktop ? "\n\nسيجري التقييم كمراجعة مكتبية دون معاينة ميدانية." : ""}\n\nسأتابع التطورات وأُبلغك بكل جديد.`,
      data_collection_open: `${greeting}\n\nنحتاج **بيانات ومستندات إضافية** لإتمام التقييم.\n\nيرجى رفع المطلوب من بوابة البيانات أو مباشرة هنا في المحادثة.`,
      inspection_pending: isDesktop
        ? `${greeting}\n\nطلبك **مكتبي** ولا يتطلب معاينة ميدانية.\n\nنعمل الآن على التحقق من الملف والانتقال للتحليل مباشرة.`
        : `${greeting}\n\nتم جدولة **المعاينة الميدانية** وسيتم التنسيق معك قريباً.`,
      inspection_completed: isDesktop
        ? `${greeting}\n\nالطلب في **مرحلة التحليل المكتبي** الآن، ولا توجد أي معاينة مطلوبة منك.\n\nجارٍ إعداد التقييم.`
        : `${greeting}\n\nتمت المعاينة ✅ جارٍ التحليل وإعداد التقييم.`,
      draft_report_ready: `${greeting}\n\n**مسودة التقرير** جاهزة لمراجعتك 📋\n\nراجع الأقسام وأرسل أي ملاحظات هنا.`,
      client_review: `${greeting}\n\nالمسودة بانتظار مراجعتك.\n\nأرسل ملاحظاتك هنا وسأنقلها للمقيم المعتمد.`,
      draft_approved: `${greeting}\n\nتم اعتماد المسودة ✅\n\nلإصدار التقرير النهائي، يرجى **سداد الدفعة النهائية**.`,
      issued: `${greeting}\n\n**التقرير النهائي** جاهز 🎉 يمكنك تحميله من الأعلى.\n\nإذا احتجت أي شيء مستقبلاً، أنا هنا.`,
    };

    return statusMessages[status] || `${greeting} 👋\n\nأنا **رقيم – مساعدك الذكي** لمتابعة طلب التقييم.\n\nيمكنك سؤالي عن أي شيء يخص طلبك وسأجيبك فوراً.`;
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

  const requestValuationMode = request.ai_intake_summary?.valuation_mode || request.inspection_type || "field";
  const hasUploadedPhotos = documents.some((doc) => doc.mime_type?.startsWith("image/"))
    || request.ai_intake_summary?.files?.some((file: any) => file?.type?.startsWith?.("image/"));

  // Visibility flags aligned with 19-status workflow
  const needsPayment = ["scope_approved"].includes(request.status);
  const needsFinalPayment = ["draft_approved"].includes(request.status) && request.payment_structure === "partial";
  const showQuotation = request.quotation_amount && ["scope_generated"].includes(request.status);
  const showDraftReport = ["draft_report_ready", "client_review"].includes(request.status);
  const showFinalReport = ["issued", "archived"].includes(request.status);
  const showSOW = request.status === "scope_generated" && request.scope_of_work_ar;

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
                  {getValuationModeLabel(requestValuationMode, hasUploadedPhotos)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Progress Timeline ── */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <EnhancedRequestTracker status={request.status} createdAt={request.created_at} valuationMode={requestValuationMode} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 lg:min-h-[calc(100vh-220px)]">

        {/* ── Status Guidance ── */}
        <StatusGuidanceCard status={request.status} valuationMode={requestValuationMode} />

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:min-h-[calc(100vh-260px)] lg:items-stretch">
          {/* ── Chat (2 cols) ── */}
          <div className="lg:col-span-2 lg:h-full">
            <Card className="shadow-sm flex min-h-[600px] flex-col lg:h-full lg:min-h-[calc(100vh-260px)]">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <RaqeemAnimatedLogo size={24} />
                    <span>رقيم – مساعدك الذكي</span>
                  </CardTitle>
                  {docReadiness && (
                    <div className="flex items-center gap-2 text-xs" dir="rtl">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${docReadiness.percent >= 100 ? "bg-green-500" : docReadiness.percent >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${docReadiness.percent}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground">جاهزية الملف {docReadiness.percent}%</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Progress Bar */}
                <div className="px-2 pb-2">
                  <ChatProgressBar status={request.status} />
                </div>

                {/* Raqeem Welcome — always first */}
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                    <RaqeemAnimatedLogo size={32} />
                  </div>
                  <div className="max-w-[85%] rounded-xl px-4 py-3 text-sm bg-card border border-primary/20 text-foreground shadow-sm">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-bold text-primary">رقيم – مساعدك الذكي</span>
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert" dir="rtl" style={{ textAlign: 'right' }}>
                      <ReactMarkdown>{getRaqeemWelcome(request.status, request)}</ReactMarkdown>
                    </div>
                  </div>
                </div>



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
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isClient ? "bg-muted" : ""}`}>
                        {isAI ? <RaqeemAnimatedLogo size={28} /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${isClient ? "bg-primary text-primary-foreground" : isAI ? "bg-card border border-primary/20 text-foreground" : "bg-muted text-foreground"}`}>
                        {isAI && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-bold text-primary">رقيم – مساعدك الذكي</span>
                          </div>
                        )}
                        {isAI ? <div className="prose prose-sm max-w-none dark:prose-invert" dir="rtl"><ReactMarkdown>{msg.content}</ReactMarkdown></div> : <p>{msg.content}</p>}
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-[10px] ${isClient ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {isAI && <MessageRating messageId={msg.id} requestId={id!} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Typing indicator */}
                {aiTyping && <RaqeemTypingIndicator />}
                {/* AI Suggested Actions */}
                {!aiTyping && aiSuggestedActions.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-2">
                    {aiSuggestedActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={async () => {
                          if (!user || sending || aiTyping) return;
                          setAiSuggestedActions([]);
                          setSending(true);
                          try {
                            await supabase.from("request_messages" as any).insert({
                              request_id: id!, sender_id: user.id, sender_type: "client" as any, content: action.message,
                            });
                            callRaqeemAI(action.message);
                          } finally {
                            setSending(false);
                          }
                        }}
                        disabled={sending || aiTyping}
                        className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              {/* Persistent Quick Actions */}
              <div className="px-4 py-2 border-t border-border/50">
                <QuickActionButtons
                  status={request.status}
                  valuationMode={requestValuationMode}
                  onAction={async (msg) => {
                    if (!user) return;
                    // Handle special export action
                    if (msg === "__export_chat__") {
                      handleExportChat();
                      return;
                    }
                    setSending(true);
                    try {
                      await supabase.from("request_messages" as any).insert({
                        request_id: id!, sender_id: user.id, sender_type: "client" as any, content: msg,
                      });
                      callRaqeemAI(msg);
                    } finally {
                      setSending(false);
                    }
                  }}
                  disabled={sending || aiTyping}
                />
              </div>
              <div className="p-4 border-t border-border bg-card/50">
                <div className="flex gap-2">
                  <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendMessage()} placeholder="اسأل رقيم أو اكتب ملاحظة..." disabled={sending || uploading} dir="rtl" className="flex-1" />
                  <input ref={chatFileRef} type="file" className="hidden" accept="image/*,.pdf,.xlsx,.xls,.doc,.docx" onChange={handleChatFileUpload} />
                  <Button variant="outline" size="icon" onClick={() => chatFileRef.current?.click()} disabled={uploading} title="إرفاق ملف">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sending} size="icon">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1"><RaqeemAnimatedLogo size={14} /> رقيم – مساعدك الذكي — حاضر للإجابة على استفساراتك فوراً</p>
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
                  <span className="text-xs">{(() => { const d = new Date(request.created_at); d.setDate(d.getDate() + getTurnaroundDays(requestValuationMode)); return formatDate(d.toISOString()); })()}</span>
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
            {["submitted", "scope_generated"].includes(request.status) && (
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
                requestValuationMode,
                hasUploadedPhotos || undefined
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
                  {request.status === "scope_generated" && (
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" size="sm" onClick={() => handleQuotationResponse(true)} disabled={sending}><CheckCircle className="w-3 h-3 ml-1" />قبول العرض واعتماد النطاق</Button>
                      <Button variant="outline" className="flex-1" size="sm" onClick={() => handleQuotationResponse(false)} disabled={sending}><XCircle className="w-3 h-3 ml-1" />رفض</Button>
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
