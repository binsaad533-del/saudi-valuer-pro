import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Bot, User, Paperclip, Trash2, Sparkles, FileText, X, Edit3,
  BookOpen, MessageSquare, Scale, FlaskConical, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import KnowledgeBaseModule from "@/components/raqeem/KnowledgeBaseModule";
import CorrectionsModule from "@/components/raqeem/CorrectionsModule";
import RulesEngineModule from "@/components/raqeem/RulesEngineModule";
import PerformanceDashboard from "@/components/raqeem/PerformanceDashboard";
import TestHistoryModule from "@/components/raqeem/TestHistoryModule";

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: { name: string; type: string }[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/raqeem-chat`;

const SUGGESTED_PROMPTS = [
  "ما هي منهجيات التقييم العقاري المعتمدة؟",
  "اشرح لي أسلوب المقارنة بالمبيعات",
  "ما هي متطلبات تقرير التقييم حسب تقييم؟",
  "كيف أحسب معدل الرسملة للعقارات الاستثمارية؟",
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
  const [correctionDialog, setCorrectionDialog] = useState<{
    open: boolean;
    msgIndex: number;
    correctedAnswer: string;
    reason: string;
  }>({ open: false, msgIndex: -1, correctedAnswer: "", reason: "" });
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = useCallback(
    async (allMessages: Message[]) => {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
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

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
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
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) upsert(c);
          } catch { /* ignore */ }
        }
      }
    },
    []
  );

  const send = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText && attachedFiles.length === 0) return;
    // Switch to chat tab when sending
    setActiveTab("chat");
    let fullContent = messageText;
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map((f) => f.name).join("، ");
      fullContent += `\n\n[مرفقات: ${fileNames}]`;
    }
    const userMsg: Message = {
      role: "user",
      content: fullContent,
      attachments: attachedFiles.map((f) => ({ name: f.name, type: f.type })),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);
    try {
      await streamChat(newMessages);
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + attachedFiles.length > 5) { toast.error("الحد الأقصى 5 ملفات"); return; }
    setAttachedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  const clearChat = () => { setMessages([]); setAttachedFiles([]); };

  const openCorrectionDialog = (msgIndex: number) => {
    setCorrectionDialog({
      open: true,
      msgIndex,
      correctedAnswer: messages[msgIndex]?.content || "",
      reason: "",
    });
  };

  const submitCorrection = async () => {
    const { msgIndex, correctedAnswer, reason } = correctionDialog;
    let question = "";
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") { question = messages[i].content; break; }
    }
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [],
          correction: {
            original_question: question,
            original_answer: messages[msgIndex].content,
            corrected_answer: correctedAnswer,
            reason,
          },
        }),
      });
      if (resp.ok) {
        toast.success("تم حفظ التصحيح — سيُطبّق في المحادثات القادمة");
        setCorrectionDialog({ open: false, msgIndex: -1, correctedAnswer: "", reason: "" });
      } else {
        toast.error("فشل حفظ التصحيح");
      }
    } catch {
      toast.error("حدث خطأ");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">رقيم — مركز التقييم الذكي</h1>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              مساعد التقييم الذكي الموحد لإدارة المعرفة، التدريب، التحليل، والتقييم
            </p>
          </div>
        </div>
        {activeTab === "chat" && messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground text-xs">
            <Trash2 className="w-3.5 h-3.5 ml-1" /> محادثة جديدة
          </Button>
        )}
      </div>

      {/* Unified Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden" dir="rtl">
        <div className="border-b border-border bg-card/50 shrink-0 px-4 sm:px-6">
          <TabsList className="h-auto bg-transparent p-0 gap-0 w-full justify-start">
            {ALL_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs gap-1.5 px-3 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
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
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
                  <Sparkles className="w-8 h-8 text-primary-foreground" />
                </div>
                <div className="text-center space-y-1.5">
                  <h2 className="text-xl font-bold text-foreground">مرحباً، أنا رقيم</h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    مساعدك الذكي في التقييم — أتعلم فقط مما تزوّدني به.
                    استخدم التبويبات أعلاه لإدارة المعرفة والقواعد والتصحيحات.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => send(prompt)}
                      className="p-3 rounded-xl border border-border bg-card hover:bg-accent/50 text-sm text-right text-foreground transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="outline" className="text-xs gap-1">
                    <FileText className="w-3 h-3" /> تعلّم متحكم به
                  </Badge>
                  <Badge variant="outline" className="text-xs gap-1">IVS 2025 + تقييم</Badge>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-5">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "gradient-primary text-primary-foreground"
                      }`}
                    >
                      {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>
                    <div
                      className={`flex-1 rounded-xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-foreground"
                      }`}
                    >
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.attachments.map((att, j) => (
                            <Badge key={j} variant="secondary" className="text-xs gap-1">
                              <FileText className="w-3 h-3" /> {att.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert" dir="rtl" style={{ textAlign: 'right' }}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap" dir="rtl" style={{ textAlign: 'right' }}>{msg.content}</span>
                      )}
                      {msg.role === "assistant" && i === messages.length - 1 && isLoading && (
                        <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse mr-1 rounded-sm" />
                      )}
                      {msg.role === "assistant" && !isLoading && (
                        <div className="mt-2 pt-2 border-t border-border/50 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-6 text-muted-foreground hover:text-primary gap-1"
                            onClick={() => openCorrectionDialog(i)}
                          >
                            <Edit3 className="w-3 h-3" /> تصحيح
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shrink-0 text-primary-foreground">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-card border border-border rounded-xl px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div className="px-4 sm:px-6 pt-2 flex gap-2 flex-wrap shrink-0">
              {attachedFiles.map((file, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5 py-1 px-2.5">
                  <FileText className="w-3 h-3" />
                  <span className="text-xs max-w-[120px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(i)}><X className="w-3 h-3 hover:text-destructive" /></button>
                </Badge>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 sm:px-6 py-3 border-t border-border bg-card shrink-0">
            <div className="max-w-3xl mx-auto flex items-end gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 text-muted-foreground hover:text-primary"
                disabled={isLoading}
              >
                <Paperclip className="w-5 h-5" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب سؤالك هنا..."
                className="resize-none min-h-[44px] max-h-[120px] text-sm"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={() => send()}
                size="icon"
                disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Other Tabs */}
        <TabsContent value="knowledge" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex">
          <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4">
            <KnowledgeBaseModule />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="corrections" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex">
          <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4">
            <CorrectionsModule />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="rules" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex">
          <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4">
            <RulesEngineModule />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="tests" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex">
          <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4">
            <TestHistoryModule />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="performance" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=active]:flex">
          <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4">
            <PerformanceDashboard />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Correction Dialog */}
      <Dialog
        open={correctionDialog.open}
        onOpenChange={(open) => setCorrectionDialog((p) => ({ ...p, open }))}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تصحيح إجابة رقيم</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">الإجابة المصحّحة</label>
              <Textarea
                value={correctionDialog.correctedAnswer}
                onChange={(e) => setCorrectionDialog((p) => ({ ...p, correctedAnswer: e.target.value }))}
                rows={6}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">سبب التصحيح (اختياري)</label>
              <Textarea
                value={correctionDialog.reason}
                onChange={(e) => setCorrectionDialog((p) => ({ ...p, reason: e.target.value }))}
                rows={2}
                className="mt-1"
                placeholder="مثال: حسب معيار IVS 104 الفقرة 30..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionDialog((p) => ({ ...p, open: false }))}>
              إلغاء
            </Button>
            <Button onClick={submitCorrection}>حفظ التصحيح</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
