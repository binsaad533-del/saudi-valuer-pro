/**
 * RaqeemChatPage — Universal Raqeem chat accessible to all authenticated users.
 * Adapts behavior based on user role via permissions engine.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/raqeem-chat`;

const ROLE_PROMPTS: Record<string, string[]> = {
  owner: [
    "ما هي حالة الطلبات النشطة؟",
    "اشرح لي منهجيات التقييم المعتمدة",
    "ما هي متطلبات تقرير التقييم حسب تقييم؟",
    "كيف أحسب معدل الرسملة؟",
  ],
  client: [
    "ما هي حالة طلبي الحالي؟",
    "كيف أقدم طلب تقييم جديد؟",
    "ما هي المستندات المطلوبة؟",
    "متى سيكون التقرير جاهزاً؟",
  ],
  inspector: [
    "ما هي المعاينات المطلوبة مني؟",
    "كيف أرفع صور المعاينة؟",
    "ما هي متطلبات التقرير الميداني؟",
  ],
  financial_manager: [
    "ما هي المدفوعات المعلقة؟",
    "عرض ملخص الإيرادات",
    "ما هي الفواتير المتأخرة؟",
  ],
};

export default function RaqeemChatPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const effectiveRole = role === "admin_coordinator" || role === "valuation_manager" || role === "valuer"
    ? "owner" : (role || "client");

  const suggestedPrompts = ROLE_PROMPTS[effectiveRole] || ROLE_PROMPTS.client;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          userRole: effectiveRole,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) toast.error("تم تجاوز الحد المسموح للطلبات");
        else toast.error("حدث خطأ في الاتصال بالمساعد");
        setIsLoading(false);
        return;
      }

      if (resp.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || parsed.content || "";
                assistantContent += delta;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                  return updated;
                });
              } catch {}
            }
          }
        }
      } else {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || data.content || data.response || "لم أتمكن من الإجابة";
        setMessages((prev) => [...prev, { role: "assistant", content }]);
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, effectiveRole]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const getBackPath = () => {
    if (effectiveRole === "client") return "/client";
    if (effectiveRole === "inspector") return "/inspector";
    return "/";
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(getBackPath())}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <RaqeemIcon size={20} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">رقيم</h1>
            <p className="text-xs text-muted-foreground">مساعدك الذكي</p>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-16 space-y-6">
              <div className="flex items-center justify-center mx-auto">
                <RaqeemAnimatedLogo size={128} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground mb-1">مرحباً، أنا رقيم</h2>
                <p className="text-sm text-muted-foreground">كيف يمكنني مساعدتك اليوم؟</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-xs text-right p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <RaqeemIcon size={14} className="text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-xl px-4 py-2.5 max-w-[80%] text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <RaqeemIcon size={14} className="text-primary" />
              </div>
              <div className="bg-muted rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-card sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالتك هنا..."
              className="resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="shrink-0 h-11 w-11"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
