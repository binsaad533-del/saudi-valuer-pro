import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Upload,
  FileText,
  Image,
  File,
  X,
  Loader2,
  Bot,
  User,
  CheckCircle,
  ArrowRight,
  Building2,
} from "lucide-react";
import logo from "@/assets/logo.png";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  aiCategory?: string;
  aiRelevant?: boolean;
}

const VALUATION_TYPES = [
  { value: "real_estate", label: "تقييم عقاري", icon: "🏠" },
  { value: "machinery", label: "تقييم آلات ومعدات", icon: "⚙️" },
  { value: "mixed", label: "تقييم مختلط (عقار + معدات)", icon: "🏗️" },
];

const PROPERTY_TYPES = [
  { value: "residential", label: "سكني" },
  { value: "commercial", label: "تجاري" },
  { value: "land", label: "أرض" },
  { value: "industrial", label: "صناعي" },
  { value: "mixed_use", label: "متعدد الاستخدام" },
  { value: "agricultural", label: "زراعي" },
  { value: "hospitality", label: "فندقي / ضيافة" },
];

const PURPOSES = [
  { value: "sale_purchase", label: "بيع / شراء" },
  { value: "mortgage", label: "رهن عقاري" },
  { value: "financial_reporting", label: "تقارير مالية" },
  { value: "insurance", label: "تأمين" },
  { value: "taxation", label: "ضريبي" },
  { value: "litigation", label: "قضائي" },
  { value: "investment", label: "استثمار" },
  { value: "other", label: "أخرى" },
];

export default function NewRequest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [step, setStep] = useState<"intake" | "review" | "submitted">("intake");
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Form data collected via AI
  const [valuationType, setValuationType] = useState<string>("real_estate");
  const [formData, setFormData] = useState({
    propertyType: "",
    purpose: "",
    propertyDescription: "",
    propertyAddress: "",
    propertyCity: "",
    propertyDistrict: "",
    landArea: "",
    buildingArea: "",
    intendedUse: "",
    intendedUsers: "",
    additionalNotes: "",
  });

  // Files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/client/login");
        return;
      }
      setUser(user);

      // Start AI conversation
      setMessages([{
        role: "assistant",
        content: `أهلاً بك في نظام طلبات التقييم لجساس للتقييم.

أنا مساعد التقييم الذكي، وسأساعدك في إعداد طلب التقييم بشكل منظم ومكتمل.

**يرجى اختيار نوع التقييم من القائمة الجانبية أولاً:**
- 🏠 تقييم عقاري
- ⚙️ تقييم آلات ومعدات
- 🏗️ تقييم مختلط (عقار + معدات)

ثم أخبرني بالتفاصيل وسأقوم بتنظيم المعلومات تلقائياً.`
      }]);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const streamAIResponse = useCallback(async (allMessages: ChatMessage[]) => {
    setIsStreaming(true);
    let assistantContent = "";

    try {
      const systemPrompt = `أنت مساعد تقييم عقاري احترافي لشركة جساس للتقييم في السعودية.
دورك: جمع معلومات طلب التقييم من العميل بشكل منظم.

القواعد:
- تحدث باللغة العربية بأسلوب مهني محترف
- اسأل أسئلة متابعة منظمة
- اكتشف المعلومات الناقصة
- نظّم الإجابات الفوضوية
- لا تتصرف كبوت محادثة عادي
- ركّز على: نوع العقار، الغرض، الموقع، المساحة، الاستخدام المقصود

المعلومات المطلوبة:
1. نوع العقار (سكني/تجاري/أرض/صناعي/مختلط/زراعي/فندقي)
2. الغرض من التقييم
3. وصف العقار
4. الموقع (المدينة، الحي، العنوان)
5. المساحة (أرض / مبنى)
6. الاستخدام المقصود للتقييم
7. المستخدمون المقصودون
8. أي وثائق متوفرة

عندما تجمع معلومات كافية، اطلب من العميل مراجعة الملخص وتأكيده.

الملفات المرفوعة حالياً: ${uploadedFiles.map(f => f.name).join(", ") || "لا توجد"}
نوع التقييم: ${valuationType === "real_estate" ? "عقاري" : valuationType === "machinery" ? "آلات ومعدات" : "مختلط"}
البيانات المجمعة حتى الآن: ${JSON.stringify(formData)}`;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-intake`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: allMessages,
            systemPrompt,
            valuationType,
            formData,
            files: uploadedFiles.map(f => ({ name: f.name, type: f.type, category: f.aiCategory })),
          }),
        }
      );

      if (!resp.ok || !resp.body) {
        throw new Error("فشل الاتصال بالمساعد الذكي");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ") || line.trim() === "") continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length === allMessages.length + 1) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Try to extract structured data from AI response
      if (assistantContent) {
        tryExtractFormData(assistantContent);
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  }, [formData, uploadedFiles, toast]);

  const tryExtractFormData = (content: string) => {
    // Simple extraction from AI responses
    const updates: Partial<typeof formData> = {};
    
    if (content.includes("سكني")) updates.propertyType = updates.propertyType || "residential";
    if (content.includes("تجاري")) updates.propertyType = updates.propertyType || "commercial";
    if (content.includes("أرض")) updates.propertyType = updates.propertyType || "land";
    
    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: inputMessage };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage("");

    await streamAIResponse(newMessages);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;

      const { error } = await supabase.storage
        .from("client-uploads")
        .upload(filePath, file);

      if (error) {
        toast({ title: `خطأ في رفع ${file.name}`, description: error.message, variant: "destructive" });
        continue;
      }

      newFiles.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        path: filePath,
      });
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    setUploading(false);

    // Notify AI about uploads
    if (newFiles.length > 0) {
      const uploadMsg: ChatMessage = {
        role: "user",
        content: `تم رفع ${newFiles.length} ملف: ${newFiles.map(f => f.name).join(", ")}`,
      };
      const allMsgs = [...messages, uploadMsg];
      setMessages(allMsgs);
      await streamAIResponse(allMsgs);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmitRequest = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("valuation_requests" as any)
        .insert({
          client_user_id: user.id,
          valuation_type: valuationType as any,
          property_type: (formData.propertyType || null) as any,
          property_description_ar: formData.propertyDescription || null,
          property_address_ar: formData.propertyAddress || null,
          property_city_ar: formData.propertyCity || null,
          property_district_ar: formData.propertyDistrict || null,
          land_area: formData.landArea ? parseFloat(formData.landArea) : null,
          building_area: formData.buildingArea ? parseFloat(formData.buildingArea) : null,
          purpose: (formData.purpose || null) as any,
          intended_use_ar: formData.intendedUse || null,
          intended_users_ar: formData.intendedUsers || null,
          status: "submitted" as any,
          submitted_at: new Date().toISOString(),
          ai_intake_summary: {
            messages: messages,
            files: uploadedFiles,
            formData: formData,
            valuationType,
          },
        })
        .select()
        .single();

      if (error) throw error;

      // Save documents
      if (uploadedFiles.length > 0 && data) {
        const reqData = data as any;
        const docs = uploadedFiles.map(f => ({
          request_id: reqData.id,
          uploaded_by: user.id,
          file_name: f.name,
          file_path: f.path,
          file_size: f.size,
          mime_type: f.type,
          ai_category: f.aiCategory || null,
        }));
        await supabase.from("request_documents" as any).insert(docs);
      }

      // Save chat messages
      if (data) {
        const reqData = data as any;
        const chatMsgs = messages.map(m => ({
          request_id: reqData.id,
          sender_id: m.role === "user" ? user.id : null,
          sender_type: (m.role === "user" ? "client" : "ai") as any,
          content: m.content,
        }));
        await supabase.from("request_messages" as any).insert(chatMsgs);
      }

      setRequestId((data as any)?.id || null);
      setStep("submitted");
      toast({ title: "تم إرسال طلب التقييم بنجاح" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="w-4 h-4 text-info" />;
    if (type.includes("pdf")) return <FileText className="w-4 h-4 text-destructive" />;
    return <File className="w-4 h-4 text-muted-foreground" />;
  };

  if (step === "submitted") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-card">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">تم إرسال طلبك بنجاح</h2>
            <p className="text-sm text-muted-foreground mb-6">
              سيقوم فريقنا بمراجعة طلبك وإرسال عرض السعر ونطاق العمل في أقرب وقت.
            </p>
            <div className="space-y-2">
              <Button onClick={() => navigate("/client")} className="w-full">
                العودة للوحة التحكم
              </Button>
              {requestId && (
                <Button onClick={() => navigate(`/client/request/${requestId}`)} variant="outline" className="w-full">
                  عرض تفاصيل الطلب
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-8 h-8" />
            <h2 className="text-sm font-bold text-foreground">طلب تقييم جديد</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/client")}>
            <ArrowRight className="w-4 h-4 ml-1" />
            العودة
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Chat */}
          <div className="lg:col-span-2">
            <Card className="shadow-card h-[calc(100vh-160px)] flex flex-col">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">مساعد التقييم الذكي</CardTitle>
                    <p className="text-xs text-muted-foreground">يساعدك في إعداد طلب تقييم مكتمل</p>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === "assistant" ? "gradient-primary" : "bg-muted"
                    }`}>
                      {msg.role === "assistant" ? (
                        <Bot className="w-3.5 h-3.5 text-primary-foreground" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                      msg.role === "assistant"
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-xl px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="shrink-0"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    placeholder="اكتب رسالتك..."
                    disabled={isStreaming}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isStreaming}
                    size="icon"
                    className="shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar: Form + Files */}
          <div className="space-y-4">
            {/* Quick Form */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  بيانات الطلب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Valuation Type Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">نوع التقييم</Label>
                  <div className="space-y-1.5">
                    {VALUATION_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setValuationType(t.value)}
                        className={`w-full text-right px-3 py-2 rounded-lg border text-xs transition-all ${
                          valuationType === t.value
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-background text-foreground hover:border-primary/30"
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(valuationType === "real_estate" || valuationType === "mixed") && (
                <>
                <div className="space-y-1.5">
                  <Label className="text-xs">نوع العقار</Label>
                  <Select value={formData.propertyType} onValueChange={(v) => setFormData(p => ({ ...p, propertyType: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">الغرض من التقييم</Label>
                  <Select value={formData.purpose} onValueChange={(v) => setFormData(p => ({ ...p, purpose: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="اختر الغرض" />
                    </SelectTrigger>
                    <SelectContent>
                      {PURPOSES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">المدينة</Label>
                  <Input
                    value={formData.propertyCity}
                    onChange={(e) => setFormData(p => ({ ...p, propertyCity: e.target.value }))}
                    placeholder="الرياض"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">الحي</Label>
                  <Input
                    value={formData.propertyDistrict}
                    onChange={(e) => setFormData(p => ({ ...p, propertyDistrict: e.target.value }))}
                    placeholder="حي النرجس"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">مساحة الأرض (م²)</Label>
                    <Input
                      value={formData.landArea}
                      onChange={(e) => setFormData(p => ({ ...p, landArea: e.target.value }))}
                      placeholder="500"
                      className="h-9 text-sm"
                      type="number"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">مساحة البناء (م²)</Label>
                    <Input
                      value={formData.buildingArea}
                      onChange={(e) => setFormData(p => ({ ...p, buildingArea: e.target.value }))}
                      placeholder="350"
                      className="h-9 text-sm"
                      type="number"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">وصف العقار</Label>
                  <Textarea
                    value={formData.propertyDescription}
                    onChange={(e) => setFormData(p => ({ ...p, propertyDescription: e.target.value }))}
                    placeholder="فيلا سكنية مكونة من طابقين..."
                    className="text-sm min-h-[60px]"
                    rows={2}
                  />
                </div>
                </>
                )}
              </CardContent>

            {/* Files */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    المستندات ({uploadedFiles.length})
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-xs h-7"
                  >
                    <Upload className="w-3 h-3 ml-1" />
                    رفع
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {uploadedFiles.length === 0 ? (
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">اضغط لرفع المستندات</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      PDF, صور, Word, Excel
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {uploadedFiles.map(file => (
                      <div key={file.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                        {getFileIcon(file.type)}
                        <span className="flex-1 truncate text-foreground">{file.name}</span>
                        {file.aiCategory && (
                          <Badge variant="secondary" className="text-[10px] h-5">{file.aiCategory}</Badge>
                        )}
                        <button onClick={() => removeFile(file.id)} className="text-muted-foreground hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              onClick={handleSubmitRequest}
              className="w-full gap-2"
              disabled={loading}
              size="lg"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              إرسال طلب التقييم
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
