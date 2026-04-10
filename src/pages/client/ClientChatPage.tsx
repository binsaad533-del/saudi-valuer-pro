import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import RaqeemTypingIndicator from "@/components/client/chat/RaqeemTypingIndicator";
import { getGlobalChatInit } from "@/components/client/chat/globalChatInit";
import { AI } from "@/config/assistantIdentity";
import {
  Send, Paperclip, Plus, FileText, CreditCard,
  Sparkles, MessageSquare, ArrowRight, ThumbsUp, ThumbsDown,
} from "lucide-react";

interface ChatMessage {
  id: string;
  dbId?: string; // DB UUID for feedback
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  feedback?: "thumbs_up" | "thumbs_down" | null;
}

interface SuggestedAction {
  label: string;
  message: string;
}

const GLOBAL_QUICK_ACTIONS: SuggestedAction[] = [
  { label: "ملخص طلباتي", message: "أعطني ملخصاً شاملاً لجميع طلباتي" },
  { label: "طلب تقييم جديد", message: "أريد تقديم طلب تقييم جديد" },
  { label: "النواقص والمطلوب", message: "هل يوجد أي نواقص في طلباتي الحالية؟" },
  { label: "متابعة الدفع", message: "ما حالة الدفع في طلباتي؟" },
  { label: "الخطوة التالية", message: "ما هي الخطوة التالية المطلوبة مني؟" },
];

const ACTION_ICONS: Record<string, React.ReactNode> = {
  "ملخص طلباتي": <Sparkles className="w-3.5 h-3.5" />,
  "طلب تقييم جديد": <Plus className="w-3.5 h-3.5" />,
  "النواقص والمطلوب": <FileText className="w-3.5 h-3.5" />,
  "متابعة الدفع": <CreditCard className="w-3.5 h-3.5" />,
  "الخطوة التالية": <ArrowRight className="w-3.5 h-3.5" />,
};

// ── Fast-path intent detection (client-side) ──
const FAST_INTENTS: { pattern: RegExp; intent: string }[] = [
  { pattern: /ملخص|حالة.*طلب|وين.*وصل|ايش.*اخر|آخر.*تطور/i, intent: "status_summary" },
  { pattern: /نواقص|ناقص|مطلوب.*من/i, intent: "missing_items" },
  { pattern: /خطوة.*تالي|المطلوب.*مني|ايش.*اسوي/i, intent: "next_step" },
  { pattern: /طلب.*جديد|تقييم.*جديد|أريد.*تقديم/i, intent: "new_request" },
  { pattern: /عرض.*سعر|تسعير|كم.*تكلف/i, intent: "pricing" },
  { pattern: /دفع|سداد|تحويل|فاتور/i, intent: "payment" },
  { pattern: /مدة|كم.*يوم|متى.*جاهز|وقت/i, intent: "timeline" },
];

function detectFastIntent(text: string): string | null {
  for (const { pattern, intent } of FAST_INTENTS) {
    if (pattern.test(text)) return intent;
  }
  return null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ── Session ID (per browser session) ──
function getSessionId(): string {
  let sid = sessionStorage.getItem("chat_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("chat_session_id", sid);
  }
  return sid;
}

export default function ClientChatPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>(GLOBAL_QUICK_ACTIONS);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initCalledRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sendingRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const scrollBehaviorRef = useRef<ScrollBehavior>("auto");
  const sessionId = useRef(getSessionId());

  const replaceMessages = useCallback((nextMessages: ChatMessage[]) => {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    const lastMessage = messagesRef.current[messagesRef.current.length - 1];
    if (
      message.role === "assistant" &&
      lastMessage?.role === "assistant" &&
      lastMessage.content.trim() === message.content.trim()
    ) return;
    replaceMessages([...messagesRef.current, message]);
  }, [replaceMessages]);

  const seedInitialMessage = useCallback((message: ChatMessage) => {
    if (messagesRef.current.length > 0) return;
    replaceMessages([message]);
  }, [replaceMessages]);

  // ── Persist message to DB ──
  const persistMessage = useCallback(async (msg: ChatMessage): Promise<string | null> => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase.from("client_chat_messages" as any).insert({
        user_id: userId,
        session_id: sessionId.current,
        role: msg.role,
        content: msg.content,
        metadata: {},
      } as any).select("id").single();
      if (error) { console.error("Persist msg error:", error); return null; }
      return (data as any)?.id || null;
    } catch { return null; }
  }, [userId]);

  const getScrollViewport = useCallback(() => {
    return scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const viewport = getScrollViewport();
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  }, [getScrollViewport]);

  useEffect(() => {
    const viewport = getScrollViewport();
    if (!viewport) return;
    const handleScroll = () => {
      const dist = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldAutoScrollRef.current = dist < 120;
    };
    handleScroll();
    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [getScrollViewport, initialized]);

  useEffect(() => {
    if (!messages.length || !shouldAutoScrollRef.current) return;
    const behavior = scrollBehaviorRef.current;
    requestAnimationFrame(() => scrollToBottom(behavior));
    scrollBehaviorRef.current = "auto";
  }, [messages, scrollToBottom]);

  // ── Init ──
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name_ar")
        .eq("user_id", user.id)
        .maybeSingle();

      const name = profile?.full_name_ar || user.user_metadata?.full_name || "عميل";
      setUserName(name);

      try {
        const data = await getGlobalChatInit(user.id);
        if (data?.reply) {
          seedInitialMessage({
            id: `ai-${Date.now()}`,
            role: "assistant",
            content: data.reply,
            timestamp: new Date().toISOString(),
          });
          if (data.suggestedActions) setSuggestedActions(data.suggestedActions);
        } else {
          seedInitialMessage({
            id: `welcome-${Date.now()}`,
            role: "assistant",
            content: AI.welcomeGreeting(name) + "\n\nكيف يمكنني مساعدتك اليوم؟",
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        seedInitialMessage({
          id: `welcome-${Date.now()}`,
          role: "assistant",
          content: AI.welcomeGreeting(name) + "\n\nكيف يمكنني مساعدتك اليوم؟",
          timestamp: new Date().toISOString(),
        });
      }
      setInitialized(true);
    };
    init();
  }, [navigate, seedInitialMessage]);

  // ── Feedback handler ──
  const handleFeedback = useCallback(async (msgId: string, dbId: string | undefined, rating: "thumbs_up" | "thumbs_down") => {
    if (!dbId || !userId) return;

    // Optimistic update
    replaceMessages(messagesRef.current.map(m =>
      m.id === msgId ? { ...m, feedback: rating } : m
    ));

    try {
      await supabase.from("client_chat_feedback" as any).upsert({
        message_id: dbId,
        user_id: userId,
        rating,
      } as any, { onConflict: "message_id,user_id" as any });
    } catch (e) {
      console.error("Feedback save error:", e);
    }
  }, [userId, replaceMessages]);

  // ── Send message ──
  const sendMessage = useCallback(async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || sendingRef.current) return;

    shouldAutoScrollRef.current = true;
    scrollBehaviorRef.current = "smooth";

    const now = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedText,
      timestamp: now,
    };
    appendMessage(userMsg);
    setInput("");
    sendingRef.current = true;
    setSending(true);

    // Persist user message (fire-and-forget)
    persistMessage(userMsg).then(dbId => {
      if (dbId) {
        replaceMessages(messagesRef.current.map(m =>
          m.id === userMsg.id ? { ...m, dbId } : m
        ));
      }
    });

    try {
      const history = messagesRef.current.slice(-4).map((m) => ({
        content: m.content,
        sender_type: m.role === "user" ? "client" : "ai",
      }));

      const fastIntent = detectFastIntent(trimmedText);

      // Use streaming for real-time response
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || supabaseKey;

      const response = await fetch(`${supabaseUrl}/functions/v1/raqeem-client-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          message: trimmedText,
          is_global_chat: true,
          conversationHistory: history,
          requestContext: { client_user_id: userId },
          fast_intent: fastIntent,
          stream: true,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream") && response.body) {
        // Streaming mode — render chunks in real-time
        const aiMsgId = `ai-${Date.now()}`;
        const aiTimestamp = new Date().toISOString();
        let fullContent = "";

        // Add empty AI message immediately
        const streamMsg: ChatMessage = {
          id: aiMsgId, role: "assistant", content: "", timestamp: aiTimestamp, feedback: null,
        };
        appendMessage(streamMsg);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.delta) {
                fullContent += parsed.delta;
                // Update message content in-place
                replaceMessages(messagesRef.current.map(m =>
                  m.id === aiMsgId ? { ...m, content: fullContent } : m
                ));
              }
              if (parsed.done) {
                if (parsed.suggestedActions) setSuggestedActions(parsed.suggestedActions);
              }
            } catch {}
          }
        }

        // Persist final AI message
        if (fullContent.trim()) {
          persistMessage({ id: aiMsgId, role: "assistant", content: fullContent, timestamp: aiTimestamp }).then(dbId => {
            if (dbId) {
              replaceMessages(messagesRef.current.map(m =>
                m.id === aiMsgId ? { ...m, dbId } : m
              ));
            }
          });
        }
      } else {
        // Fallback: non-streaming JSON response
        const data = await response.json();
        const reply = data?.reply?.trim();
        if (reply) {
          const aiMsg: ChatMessage = {
            id: `ai-${Date.now()}`, role: "assistant", content: reply,
            timestamp: new Date().toISOString(), feedback: null,
          };
          appendMessage(aiMsg);
          persistMessage(aiMsg).then(dbId => {
            if (dbId) replaceMessages(messagesRef.current.map(m => m.id === aiMsg.id ? { ...m, dbId } : m));
          });
        }
        if (data?.suggestedActions) setSuggestedActions(data.suggestedActions);
        if (data?.scopeApproved) toast({ title: "تم اعتماد نطاق العمل بنجاح" });
      }
    } catch (err) {
      console.error("Chat error:", err);
      appendMessage({
        id: `err-${Date.now()}`,
        role: "assistant",
        content: AI.errorMessage,
        timestamp: new Date().toISOString(),
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [userId, navigate, toast, appendMessage, persistMessage, replaceMessages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const fileNames = Array.from(files).map(f => f.name).join("، ");
    for (const file of Array.from(files)) {
      const path = `client-data/global/${userId}/${crypto.randomUUID()}_${file.name}`;
      await supabase.storage.from("client-uploads").upload(path, file);
    }
    sendMessage(`تم رفع الملفات التالية: ${fileNames}`);
    e.target.value = "";
  };

  return (
    <div className="bg-background h-[calc(100vh-56px)] flex flex-col" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <RaqeemAnimatedLogo size={36} />
          <div>
            <h1 className="text-sm font-bold text-foreground">{AI.name} — مركز التشغيل</h1>
            <p className="text-[11px] text-muted-foreground">أدر جميع طلباتك من هنا بدون الحاجة للتنقل بين الصفحات</p>
          </div>
          <Badge variant="outline" className="mr-auto text-[10px] border-primary/30 text-primary">
            {AI.activeLabel}
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
                <div
                  className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : msg.role === "system"
                      ? "bg-muted/50 text-muted-foreground text-xs border border-border"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {/* Timestamp + Feedback row */}
                <div className={`flex items-center gap-2 mt-1 px-1 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <span className="text-[10px] text-muted-foreground/70">{formatTime(msg.timestamp)}</span>

                  {msg.role === "assistant" && msg.id !== messages[0]?.id && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleFeedback(msg.id, msg.dbId, "thumbs_up")}
                        disabled={!!msg.feedback}
                        className={`p-1 rounded hover:bg-muted/50 transition-colors ${
                          msg.feedback === "thumbs_up" ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
                        } ${msg.feedback ? "cursor-default" : "cursor-pointer"}`}
                        title="إجابة مفيدة"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, msg.dbId, "thumbs_down")}
                        disabled={!!msg.feedback}
                        className={`p-1 rounded hover:bg-muted/50 transition-colors ${
                          msg.feedback === "thumbs_down" ? "text-destructive" : "text-muted-foreground/50 hover:text-muted-foreground"
                        } ${msg.feedback ? "cursor-default" : "cursor-pointer"}`}
                        title="إجابة غير مفيدة"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {sending && <RaqeemTypingIndicator />}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      <div className="border-t border-border bg-card/50">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex flex-wrap gap-1.5">
            {suggestedActions.map((action, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-[11px] h-7 px-2.5 gap-1.5 rounded-full border-primary/20 hover:bg-primary/5 hover:border-primary/40 text-primary"
                onClick={() => sendMessage(action.message || action.label)}
                disabled={sending}
              >
                {ACTION_ICONS[action.label] || <MessageSquare className="w-3.5 h-3.5" />}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={AI.chatPlaceholder}
            className="flex-1 h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            disabled={sending}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => sendMessage(input)}
            disabled={sending || !input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
