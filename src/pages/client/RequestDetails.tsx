import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  ArrowRight,
  FileText,
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  CreditCard,
  Building2,
} from "lucide-react";
import logo from "@/assets/logo.png";

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [request, setRequest] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/client/login"); return; }
      setUser(user);

      const [reqRes, msgRes, docRes, payRes] = await Promise.all([
        supabase.from("valuation_requests").select("*").eq("id", id!).single(),
        supabase.from("request_messages").select("*").eq("request_id", id!).order("created_at"),
        supabase.from("request_documents").select("*").eq("request_id", id!).order("created_at"),
        supabase.from("payment_receipts").select("*").eq("request_id", id!).order("created_at"),
      ]);

      setRequest(reqRes.data);
      setMessages(msgRes.data || []);
      setDocuments(docRes.data || []);
      setPayments(payRes.data || []);
      setLoading(false);
    };
    load();

    // Realtime messages
    const channel = supabase
      .channel(`request-messages-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "request_messages", filter: `request_id=eq.${id}` },
        (payload) => setMessages(prev => [...prev, payload.new]))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, navigate]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("request_messages").insert({
        request_id: id!,
        sender_id: user.id,
        sender_type: "client" as any,
        content: newMessage,
      });
      if (error) throw error;
      setNewMessage("");
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getStatusInfo = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      draft: { label: "مسودة", color: "bg-muted text-muted-foreground" },
      submitted: { label: "تم الإرسال", color: "bg-primary/10 text-primary" },
      needs_clarification: { label: "يحتاج توضيح", color: "bg-warning/10 text-warning" },
      under_pricing: { label: "قيد التسعير", color: "bg-accent text-accent-foreground" },
      quotation_sent: { label: "عرض سعر مرسل", color: "bg-info/10 text-info" },
      quotation_approved: { label: "عرض معتمد", color: "bg-success/10 text-success" },
      awaiting_payment: { label: "بانتظار الدفع", color: "bg-warning/10 text-warning" },
      fully_paid: { label: "مدفوع", color: "bg-success/10 text-success" },
      in_production: { label: "قيد التنفيذ", color: "bg-primary/10 text-primary" },
      draft_report_sent: { label: "مسودة التقرير", color: "bg-info/10 text-info" },
      final_report_ready: { label: "التقرير جاهز", color: "bg-success/10 text-success" },
      completed: { label: "مكتمل", color: "bg-success/10 text-success" },
    };
    return map[status] || { label: status, color: "bg-muted text-muted-foreground" };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">الطلب غير موجود</p>
      </div>
    );
  }

  const statusInfo = getStatusInfo(request.status);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-8 h-8" />
            <div>
              <h2 className="text-sm font-bold text-foreground">تفاصيل الطلب</h2>
              {request.reference_number && (
                <p className="text-xs text-muted-foreground font-mono" dir="ltr">{request.reference_number}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            <Button variant="ghost" size="sm" onClick={() => navigate("/client")}>
              <ArrowRight className="w-4 h-4 ml-1" />
              العودة
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat */}
          <div className="lg:col-span-2">
            <Card className="shadow-card h-[calc(100vh-160px)] flex flex-col">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  المحادثة والملاحظات
                </CardTitle>
              </CardHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isClient = msg.sender_type === "client";
                  const isAI = msg.sender_type === "ai";
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isClient ? "flex-row-reverse" : ""}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isAI ? "gradient-primary" : isClient ? "bg-muted" : "bg-accent"
                      }`}>
                        {isAI ? <Bot className="w-3.5 h-3.5 text-primary-foreground" /> :
                         isClient ? <User className="w-3.5 h-3.5 text-muted-foreground" /> :
                         <User className="w-3.5 h-3.5 text-accent-foreground" />}
                      </div>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                        isClient ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}>
                        {isAI ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p>{msg.content}</p>
                        )}
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
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
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

          {/* Sidebar Info */}
          <div className="space-y-4">
            {/* Request Info */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  معلومات الطلب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {request.property_description_ar && (
                  <div>
                    <span className="text-muted-foreground text-xs">الوصف:</span>
                    <p className="text-foreground">{request.property_description_ar}</p>
                  </div>
                )}
                {request.property_city_ar && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">المدينة:</span>
                    <span className="text-foreground">{request.property_city_ar}</span>
                  </div>
                )}
                {request.land_area && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">مساحة الأرض:</span>
                    <span className="text-foreground" dir="ltr">{request.land_area} م²</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">تاريخ الطلب:</span>
                  <span className="text-foreground">{new Date(request.created_at).toLocaleDateString("ar-SA")}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quotation (if exists) */}
            {request.quotation_amount && (
              <Card className="shadow-card border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    عرض السعر
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground" dir="ltr">
                      {Number(request.quotation_amount).toLocaleString()} {request.quotation_currency}
                    </p>
                  </div>
                  {request.status === "quotation_sent" && (
                    <div className="flex gap-2">
                      <Button className="flex-1" size="sm">قبول</Button>
                      <Button variant="outline" className="flex-1" size="sm">رفض</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Documents */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  المستندات ({documents.length})
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
                        {doc.ai_category && (
                          <Badge variant="secondary" className="text-[10px] h-5">{doc.ai_category}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payments */}
            {payments.length > 0 && (
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    الدفعات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {payments.map(pay => (
                      <div key={pay.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-xs">
                        <span>{Number(pay.amount).toLocaleString()} {pay.currency}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {pay.status === "approved" ? "معتمد" : pay.status === "pending" ? "قيد المراجعة" : pay.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
