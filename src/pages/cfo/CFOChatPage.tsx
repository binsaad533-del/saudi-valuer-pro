import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import { AI } from "@/config/assistantIdentity";
import {
  Send, ThumbsUp, ThumbsDown, DollarSign, FileText,
  CheckCircle, ArrowRight, BarChart3,
} from "lucide-react";

interface ChatMessage {
  id: string;
  dbId?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  feedback?: "thumbs_up" | "thumbs_down" | null;
}

interface SuggestedAction {
  label: string;
  message: string;
}

const QUICK_ACTIONS: SuggestedAction[] = [
  { label: "💳 المدفوعات المعلقة", message: "اعرض المدفوعات المعلقة" },
  { label: "📋 طلبات بانتظار تأكيد", message: "اعرض الطلبات التي تنتظر تأكيداً مالياً" },
  { label: "📊 الملخص المالي", message: "اعرض الملخص المالي الحالي" },
  { label: "❓ الخطوة التالية", message: "ما الإجراء المالي التالي المطلوب؟" },
];

const ACTION_ICONS: Record<string, React.ReactNode> = {
  "💳 المدفوعات المعلقة": <DollarSign className="w-3.5 h-3.5" />,
  "📋 طلبات بانتظار تأكيد": <FileText className="w-3.5 h-3.5" />,
  "📄 فواتير غير مسددة": <FileText className="w-3.5 h-3.5" />,
  "📊 الملخص المالي": <BarChart3 className="w-3.5 h-3.5" />,
  "✅ تأكيد دفعة": <CheckCircle className="w-3.5 h-3.5" />,
  "❓ الخطوة التالية": <ArrowRight className="w-3.5 h-3.5" />,
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getSessionId(): string {
  let sid = sessionStorage.getItem("cfo_chat_session_id");
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem("cfo_chat_session_id", sid); }
  return sid;
}

export default function CFOChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>(QUICK_ACTIONS);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const initCalledRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sendingRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const sessionId = useRef(getSessionId());

  const replaceMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const appendMessage = useCallback((msg: ChatMessage) => {
    const last = messagesRef.current[messagesRef.current.length - 1];
    if (msg.role === "assistant" && last?.role === "assistant" && last.content.trim() === msg.content.trim()) return;
    replaceMessages([...messagesRef.current, msg]);
  }, [replaceMessages]);

  const persistMessage = useCallback(async (msg: ChatMessage): Promise<string | null> => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase.from("client_chat_messages" as any).insert({
        user_id: userId, session_id: sessionId.current, role: msg.role,
        content: msg.content, metadata: { context: "cfo_chat" },
      } as any).select("id").single();
      if (error) return null;
      return (data as any)?.id || null;
    } catch { return null; }
  }, [userId]);

  const getScrollViewport = useCallback(() => {
    return scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const vp = getScrollViewport();
    if (vp) vp.scrollTo({ top: vp.scrollHeight, behavior });
  }, [getScrollViewport]);

  useEffect(() => {
    const vp = getScrollViewport();
    if (!vp) return;
    const h = () => { shouldAutoScrollRef.current = vp.scrollHeight - vp.scrollTop - vp.clientHeight < 120; };
    h();
    vp.addEventListener("scroll", h);
    return () => vp.removeEventListener("scroll", h);
  }, [getScrollViewport, initialized]);

  useEffect(() => {
    if (!messages.length || !shouldAutoScrollRef.current) return;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [messages, scrollToBottom]);

  // Init
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("full_name_ar").eq("user_id", user.id).maybeSingle();
      const name = profile?.full_name_ar || "المدير المالي";

      replaceMessages([{
        id: `welcome-${Date.now()}`, role: "assistant",
        content: `أهلاً ${name}، كيف أساعدك اليوم؟\n\nأنا ${AI.name} — مساعدك المالي داخل المنصة.\n\nأساعدك في:\n- عرض المدفوعات المعلقة وتأكيدها\n- التحقق من حالة السداد لأي طلب\n- متابعة الفواتير غير المسددة\n- توضيح أهلية الطلبات للانتقال للمرحلة التالية\n- عرض الملخص المالي الحالي\n\nأعمل ضمن صلاحيات المدير المالي فقط.`,
        timestamp: new Date().toISOString(),
      }]);
      setInitialized(true);
    })();
  }, [navigate, replaceMessages]);

  // Feedback
  const handleFeedback = useCallback(async (msgId: string, dbId: string | undefined, rating: "thumbs_up" | "thumbs_down") => {
    if (!dbId || !userId) return;
    replaceMessages(messagesRef.current.map(m => m.id === msgId ? { ...m, feedback: rating } : m));
    try {
      await supabase.from("client_chat_feedback" as any).upsert({
        message_id: dbId, user_id: userId, rating,
      } as any, { onConflict: "message_id,user_id" as any });
    } catch {}
  }, [userId, replaceMessages]);

  // Send
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return;

    shouldAutoScrollRef.current = true;
    const now = new Date().toISOString();
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: trimmed, timestamp: now };
    appendMessage(userMsg);
    setInput("");
    sendingRef.current = true;
    setSending(true);

    persistMessage(userMsg).then(dbId => {
      if (dbId) replaceMessages(messagesRef.current.map(m => m.id === userMsg.id ? { ...m, dbId } : m));
    });

    try {
      const history = messagesRef.current.slice(-6).map(m => ({ content: m.content, sender_type: m.role === "user" ? "cfo" : "ai" }));

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || supabaseKey;

      const response = await fetch(`${supabaseUrl}/functions/v1/raqeem-cfo-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: history,
          cfo_user_id: userId,
          stream: true,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream") && response.body) {
        const aiMsgId = `ai-${Date.now()}`;
        const aiTs = new Date().toISOString();
        let fullContent = "";
        let finalReply = "";
        let buffer = "";
        appendMessage({ id: aiMsgId, role: "assistant", content: "", timestamp: aiTs, feedback: null });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const processSseLine = (line: string) => {
          if (!line.startsWith("data: ")) return;
          const raw = line.slice(6).trim();
          if (!raw) return;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.delta) {
              fullContent += parsed.delta;
              replaceMessages(messagesRef.current.map(m => m.id === aiMsgId ? { ...m, content: fullContent } : m));
            }
            if (parsed.done) {
              if (parsed.reply) {
                finalReply = parsed.reply;
                replaceMessages(messagesRef.current.map(m => m.id === aiMsgId ? { ...m, content: finalReply } : m));
              }
              if (parsed.suggestedActions) setSuggestedActions(parsed.suggestedActions);
            }
          } catch {}
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const rawLine of lines) {
            processSseLine(rawLine.trimEnd());
          }
        }
        const remaining = buffer.trim();
        if (remaining) processSseLine(remaining);

        const contentToPersist = (finalReply || fullContent).trim();
        if (contentToPersist) {
          persistMessage({ id: aiMsgId, role: "assistant", content: contentToPersist, timestamp: aiTs }).then(dbId => {
            if (dbId) replaceMessages(messagesRef.current.map(m => m.id === aiMsgId ? { ...m, dbId } : m));
          });
        }
      } else {
        const data = await response.json();
        const reply = data?.reply?.trim();
        if (reply) {
          const aiMsg: ChatMessage = { id: `ai-${Date.now()}`, role: "assistant", content: reply, timestamp: new Date().toISOString(), feedback: null };
          appendMessage(aiMsg);
          persistMessage(aiMsg).then(dbId => {
            if (dbId) replaceMessages(messagesRef.current.map(m => m.id === aiMsg.id ? { ...m, dbId } : m));
          });
        }
        if (data?.suggestedActions) setSuggestedActions(data.suggestedActions);
      }
    } catch (err) {
      console.error("CFO chat error:", err);
      appendMessage({ id: `err-${Date.now()}`, role: "assistant", content: "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.", timestamp: new Date().toISOString() });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [userId, appendMessage, persistMessage, replaceMessages]);

  return (
    <div className="bg-background h-[calc(100vh-56px)] flex flex-col" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <RaqeemAnimatedLogo size={36} />
          <div>
            <h1 className="text-sm font-bold text-foreground">{AI.name} — المساعد المالي</h1>
            <p className="text-[11px] text-muted-foreground">أدر الدورة المالية للطلبات من هنا</p>
          </div>
          <Badge variant="outline" className="mr-auto text-[10px] border-blue-500/30 text-blue-600">
            مدير مالي
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {!initialized && (
            <div className="flex items-center justify-center py-16">
              <RaqeemAnimatedLogo size={64} />
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1">
                  <RaqeemAnimatedLogo size={28} />
                </div>
              )}
              <div className={`max-w-[85%] ${msg.role === "user" ? "text-left" : ""}`}>
                <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                <div className={`flex items-center gap-2 mt-1 px-1 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <span className="text-[10px] text-muted-foreground/70">{formatTime(msg.timestamp)}</span>
                  {msg.role === "assistant" && msg.id !== messages[0]?.id && (
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => handleFeedback(msg.id, msg.dbId, "thumbs_up")}
                        className={`p-0.5 rounded transition-colors ${msg.feedback === "thumbs_up" ? "text-green-500" : "text-muted-foreground/40 hover:text-green-500"}`}>
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleFeedback(msg.id, msg.dbId, "thumbs_down")}
                        className={`p-0.5 rounded transition-colors ${msg.feedback === "thumbs_down" ? "text-red-500" : "text-muted-foreground/40 hover:text-red-500"}`}>
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1">
                <RaqeemAnimatedLogo size={28} />
              </div>
              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RaqeemAnimatedLogo size={16} />
                  <span>{AI.name} يفكر...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      {suggestedActions.length > 0 && (
        <div className="border-t border-border bg-card/50 px-4 py-2">
          <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
            {suggestedActions.map((action, i) => (
              <Button key={i} variant="outline" size="sm"
                className="text-xs shrink-0 gap-1.5 h-8"
                onClick={() => sendMessage(action.message)} disabled={sending}>
                {ACTION_ICONS[action.label]}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="اسأل عن المدفوعات أو الفواتير..."
            className="flex-1 h-10 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            disabled={sending} />
          <Button size="icon" className="shrink-0 h-10 w-10"
            onClick={() => sendMessage(input)} disabled={!input.trim() || sending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
