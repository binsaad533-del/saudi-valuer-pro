import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Paperclip, Trash2, Sparkles, FileText, X,
  BookOpen, MessageSquare, Scale, FlaskConical, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import KnowledgeBaseModule from "@/components/raqeem/KnowledgeBaseModule";
import CorrectionsModule from "@/components/raqeem/CorrectionsModule";
import RulesEngineModule from "@/components/raqeem/RulesEngineModule";
import PerformanceDashboard from "@/components/raqeem/PerformanceDashboard";
import TestHistoryModule from "@/components/raqeem/TestHistoryModule";
import RaqeemChatMessages from "@/components/raqeem/RaqeemChatMessages";

interface OrchestrationTool {
  name: string;
  args: Record<string, any>;
  status: "running" | "complete" | "error";
  result?: any;
  error?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: { name: string; type: string }[];
  orchestration?: OrchestrationTool[];
}

interface PlatformContext {
  assignment_id?: string;
  request_id?: string;
  reference_number?: string;
  current_status?: string;
  property_type?: string;
  client_name?: string;
  current_route?: string;
  user_role?: string;
  source_page?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/raqeem-chat`;

const SUGGESTED_PROMPTS = [
  "أعطني ملخص حالة المنصة اليوم",
  "ما الطلبات المتأخرة أو المعلقة؟",
  "كم إيرادات هذا الشهر؟",
  "كيف توزيع المهام على المعاينين؟",
];

const ALL_TABS = [
  { value: "chat", label: "المحادثة", icon: Sparkles },
  { value: "knowledge", label: "المعرفة", icon: BookOpen },
  { value: "corrections", label: "التصحيحات", icon: MessageSquare },
  { value: "rules", label: "القواعد", icon: Scale },
  { value: "tests", label: "الاختبارات", icon: FlaskConical },
  { value: "performance", label: "الأداء", icon: BarChart3 },
];

export default function RaqeemPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState("chat");
  const [platformContext, setPlatformContext] = useState<PlatformContext>({});
  const platformContextRef = useRef<PlatformContext>({});
  const [correctionDialog, setCorrectionDialog] = useState<{
    open: boolean; msgIndex: number; correctedAnswer: string; reason: string;
  }>({ open: false, msgIndex: -1, correctedAnswer: "", reason: "" });
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initCalledRef = useRef(false);
  const { user, role } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ── Build platform context from URL params, location state, and active data ──
  useEffect(() => {
    const ctx: PlatformContext = {
      current_route: location.pathname,
      user_role: role || "owner",
    };

    // From URL search params (e.g., /raqeem-chat?assignment_id=xxx)
    const assignmentParam = searchParams.get("assignment_id") || searchParams.get("aid");
    const requestParam = searchParams.get("request_id") || searchParams.get("rid");
    if (assignmentParam) ctx.assignment_id = assignmentParam;
    if (requestParam) ctx.request_id = requestParam;

    // From navigation state (e.g., navigate("/raqeem-chat", { state: { assignment_id } }))
    const navState = location.state as any;
    if (navState?.assignment_id && !ctx.assignment_id) ctx.assignment_id = navState.assignment_id;
    if (navState?.request_id && !ctx.request_id) ctx.request_id = navState.request_id;
    if (navState?.reference_number) ctx.reference_number = navState.reference_number;
    if (navState?.source_page) ctx.source_page = navState.source_page;

    // Set context IMMEDIATELY so it's available for early messages
    setPlatformContext({ ...ctx });
    platformContextRef.current = { ...ctx };

    // Then enrich with DB data asynchronously
    if (ctx.assignment_id) {
      supabase
        .from("valuation_assignments")
        .select("id, reference_number, status, property_type, client_id, clients(name_ar)")
        .eq("id", ctx.assignment_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            ctx.reference_number = data.reference_number || ctx.reference_number;
            ctx.current_status = data.status || undefined;
            ctx.property_type = data.property_type || undefined;
            ctx.client_name = (data.clients as any)?.name_ar || undefined;
          }
          setPlatformContext({ ...ctx });
          platformContextRef.current = { ...ctx };
        });
    }
  }, [location.pathname, location.state, searchParams, role]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // ── Proactive daily briefing — defined after streamChat (see below) ──

  const streamChat = useCallback(async (allMessages: Message[]) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        userRole: platformContextRef.current.user_role || role || "owner",
        userId: user?.id,
        platformContext: (platformContextRef.current.assignment_id || platformContextRef.current.request_id) ? platformContextRef.current : undefined,
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      if (resp.status === 429) toast.error(err?.error || "تم تجاوز الحد المسموح للطلبات");
      else if (resp.status === 402) toast.error(err?.error || "يرجى إضافة رصيد");
      else toast.error("حدث خطأ في الاتصال بالمساعد");
      return;
    }
    if (!resp.body) return;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantSoFar = "";
    let currentOrchestration: OrchestrationTool[] = [];

    const upsertOrchestration = (tools: OrchestrationTool[]) => {
      currentOrchestration = tools;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, orchestration: [...tools] } : m));
        return [...prev, { role: "assistant", content: "", orchestration: [...tools] }];
      });
    };

    /** Strip any leaked JSON fragments or metadata from streamed content */
    const sanitizeContent = (text: string): string => {
      if (!text) return "";
      let cleaned = text
        // Remove explicit JSON metadata fields
        .replace(/"success"\s*:\s*true/gi, "")
        .replace(/"success"\s*:\s*false/gi, "")
        .replace(/"result"\s*:/gi, "")
        .replace(/"_format"\s*:\s*".*?"/gi, "")
        .replace(/"error"\s*:\s*"[^"]*"/gi, "")
        // Remove JSON blocks that are clearly internal (high density of : and ")
        .replace(/\{[\s\S]*?\}/g, (m) => {
          const score = (m.match(/[:"]/g) || []).length;
          return score > 4 ? "" : m;
        })
        // Remove bad concatenation artifacts
        .replace(/\}\s*\{/g, " ")
        // Clean up multiple newlines
        .replace(/\n{3,}/g, "\n\n");
      return cleaned.trim();
    };

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      const cleanContent = sanitizeContent(assistantSoFar);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanContent } : m));
        return [...prev, { role: "assistant", content: cleanContent, orchestration: currentOrchestration.length > 0 ? [...currentOrchestration] : undefined }];
      });
    };

    const processLine = (line: string) => {
      if (line.startsWith(":") || line.trim() === "") return false;
      if (!line.startsWith("data: ")) return false;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") return true;
      try {
        const parsed = JSON.parse(jsonStr);
        const orch = parsed.choices?.[0]?.orchestration || parsed.choices?.[0]?.delta?.orchestration;
        if (orch) {
          if (orch.type === "orchestration_status") upsertOrchestration(orch.tools.map((t: any) => ({ ...t, status: "running" as const })));
          else if (orch.type === "tool_complete") {
            const updated = currentOrchestration.map((t) =>
              t.name === orch.tool ? { ...t, status: (orch.success ? "complete" : "error") as "complete" | "error", result: orch.result, error: orch.error } : t
            );
            upsertOrchestration(updated);
          }
        }
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) upsert(content);
      } catch { return false; }
      return false;
    };

    let streamDone = false;
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (processLine(line)) { streamDone = true; break; }
      }
    }
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        processLine(raw);
      }
    }
  }, [user, role]);

  // ── Proactive daily briefing on first load (owner only) ──
  useEffect(() => {
    if (initCalledRef.current) return;
    if (!user) return;
    const effectiveRole = role || "owner";
    if (!["owner", "admin_coordinator", "valuation_manager", "valuer"].includes(effectiveRole)) return;
    if (platformContextRef.current.assignment_id) return;
    
    initCalledRef.current = true;
    
    const briefingMsg: Message = { role: "user", content: "الإحاطة اليومية: أعطني ملخص تنفيذي للمنصة مع التنبيهات والقرارات المطلوبة" };
    setMessages([briefingMsg]);
    setIsLoading(true);
    
    (async () => {
      try {
        await streamChat([briefingMsg]);
      } catch (e) {
        console.error("Auto-briefing failed:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user, role, streamChat]);

  const send = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText && attachedFiles.length === 0) return;
    // Prevent duplicate messages
    const last = messages[messages.length - 1];
    if (last?.role === "user" && last?.content === messageText) return;
    setActiveTab("chat");
    let fullContent = messageText;
    if (attachedFiles.length > 0) fullContent += `\n\n[مرفقات: ${attachedFiles.map((f) => f.name).join("، ")}]`;
    const userMsg: Message = { role: "user", content: fullContent, attachments: attachedFiles.map((f) => ({ name: f.name, type: f.type })) };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);
    try { await streamChat(newMessages); } catch (e) { console.error(e); toast.error("حدث خطأ غير متوقع"); } finally { setIsLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + attachedFiles.length > 5) { toast.error("الحد الأقصى 5 ملفات"); return; }
    setAttachedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeFile = (idx: number) => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  const clearChat = () => { setMessages([]); setAttachedFiles([]); };

  const submitCorrection = async () => {
    const { msgIndex, correctedAnswer, reason } = correctionDialog;
    let question = "";
    for (let i = msgIndex - 1; i >= 0; i--) { if (messages[i].role === "user") { question = messages[i].content; break; } }
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: [], correction: { original_question: question, original_answer: messages[msgIndex].content, corrected_answer: correctedAnswer, reason } }),
      });
      if (resp.ok) { toast.success("تم حفظ التصحيح — سيُطبّق في المحادثات القادمة"); setCorrectionDialog({ open: false, msgIndex: -1, correctedAnswer: "", reason: "" }); }
      else toast.error("فشل حفظ التصحيح");
    } catch { toast.error("حدث خطأ"); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center"><Sparkles className="w-5 h-5 text-primary-foreground" /></div>
          <div>
            <h1 className="text-base font-bold text-foreground">ChatGPT — مركز التنفيذ الذكي</h1>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              {platformContext.reference_number
                ? `🔗 مرتبط بالطلب ${platformContext.reference_number} — ${platformContext.current_status || ""}`
                : "وحدة التنفيذ الذكية — مرتبطة بسياق المنصة تلقائياً"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {platformContext.reference_number && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              {platformContext.reference_number}
            </Badge>
          )}
          {activeTab === "chat" && messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground text-xs"><Trash2 className="w-3.5 h-3.5 ml-1" /> محادثة جديدة</Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden" dir="rtl">
        <div className="border-b border-border bg-card/50 shrink-0 px-4 sm:px-6">
          <TabsList className="h-auto bg-transparent p-0 gap-0 w-full justify-start">
            {ALL_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value}
                  className="text-xs gap-1.5 px-3 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary text-muted-foreground hover:text-foreground transition-colors">
                  <Icon className="w-3.5 h-3.5" />{tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea className="flex-1 px-4 py-6" ref={scrollRef as any}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg"><Sparkles className="w-8 h-8 text-primary-foreground" /></div>
                <div className="text-center space-y-1.5">
                  <h2 className="text-xl font-bold text-foreground">مرحباً، أنا ChatGPT</h2>
                  <p className="text-sm text-muted-foreground max-w-md">مساعدك الذكي في التقييم — أتعلم فقط مما تزوّدني به. استخدم التبويبات أعلاه لإدارة المعرفة والقواعد والتصحيحات.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full">
                  {platformContext.assignment_id ? (
                    <>
                      <button onClick={() => send("ما حالة هذا الطلب الآن؟")} className="p-3 rounded-xl border border-border bg-card hover:bg-accent/50 text-sm text-right text-foreground transition-colors">ما حالة هذا الطلب الآن؟</button>
                      <button onClick={() => send("ما الخطوة التالية المطلوبة؟")} className="p-3 rounded-xl border border-border bg-card hover:bg-accent/50 text-sm text-right text-foreground transition-colors">ما الخطوة التالية المطلوبة؟</button>
                      <button onClick={() => send("أعطني ملخص كامل لهذا الطلب")} className="p-3 rounded-xl border border-border bg-card hover:bg-accent/50 text-sm text-right text-foreground transition-colors">أعطني ملخص كامل لهذا الطلب</button>
                      <button onClick={() => send("هل هناك بيانات ناقصة أو مشاكل؟")} className="p-3 rounded-xl border border-border bg-card hover:bg-accent/50 text-sm text-right text-foreground transition-colors">هل هناك بيانات ناقصة أو مشاكل؟</button>
                    </>
                  ) : (
                    SUGGESTED_PROMPTS.map((prompt, i) => (
                      <button key={i} onClick={() => send(prompt)} className="p-3 rounded-xl border border-border bg-card hover:bg-accent/50 text-sm text-right text-foreground transition-colors">{prompt}</button>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {platformContext.assignment_id ? (
                    <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary">🔗 سياق الطلب محمّل تلقائياً</Badge>
                  ) : (
                    <>
                      <Badge variant="outline" className="text-xs gap-1"><FileText className="w-3 h-3" /> تنفيذ ذكي</Badge>
                      <Badge variant="outline" className="text-xs gap-1">سياق المنصة</Badge>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <RaqeemChatMessages messages={messages} isLoading={isLoading} onCorrect={(i) => setCorrectionDialog({ open: true, msgIndex: i, correctedAnswer: messages[i]?.content || "", reason: "" })} onSendMessage={(msg) => send(msg)} />
            )}
          </ScrollArea>

          {attachedFiles.length > 0 && (
            <div className="px-4 sm:px-6 pt-2 flex gap-2 flex-wrap shrink-0">
              {attachedFiles.map((file, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5 py-1 px-2.5">
                  <FileText className="w-3 h-3" /><span className="text-xs max-w-[120px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(i)}><X className="w-3 h-3 hover:text-destructive" /></button>
                </Badge>
              ))}
            </div>
          )}

          <div className="px-4 sm:px-6 py-3 border-t border-border bg-card shrink-0">
            <div className="max-w-3xl mx-auto flex items-end gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv" />
              <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="shrink-0 text-muted-foreground hover:text-primary" disabled={isLoading}><Paperclip className="w-5 h-5" /></Button>
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="اكتب سؤالك هنا..." className="resize-none min-h-[44px] max-h-[120px] text-sm" rows={1} disabled={isLoading} />
              <Button onClick={() => send()} size="icon" disabled={isLoading || (!input.trim() && attachedFiles.length === 0)} className="shrink-0"><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex"><ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4"><KnowledgeBaseModule /></ScrollArea></TabsContent>
        <TabsContent value="corrections" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex"><ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4"><CorrectionsModule /></ScrollArea></TabsContent>
        <TabsContent value="rules" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex"><ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4"><RulesEngineModule /></ScrollArea></TabsContent>
        <TabsContent value="tests" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex"><ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4"><TestHistoryModule /></ScrollArea></TabsContent>
        <TabsContent value="performance" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex"><ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4"><PerformanceDashboard /></ScrollArea></TabsContent>
      </Tabs>

      {/* Correction Dialog */}
      <Dialog open={correctionDialog.open} onOpenChange={(open) => setCorrectionDialog((p) => ({ ...p, open }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>تصحيح إجابة ChatGPT</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">الإجابة المصحّحة</label>
              <Textarea value={correctionDialog.correctedAnswer} onChange={(e) => setCorrectionDialog((p) => ({ ...p, correctedAnswer: e.target.value }))} rows={6} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">سبب التصحيح (اختياري)</label>
              <Textarea value={correctionDialog.reason} onChange={(e) => setCorrectionDialog((p) => ({ ...p, reason: e.target.value }))} rows={2} className="mt-1" placeholder="مثال: حسب معيار IVS 104 الفقرة 30..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionDialog((p) => ({ ...p, open: false }))}>إلغاء</Button>
            <Button onClick={submitCorrection}>حفظ التصحيح</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
