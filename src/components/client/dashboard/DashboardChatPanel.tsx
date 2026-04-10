import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import RaqeemTypingIndicator from "@/components/client/chat/RaqeemTypingIndicator";
import { getGlobalChatInit } from "@/components/client/chat/globalChatInit";
import { AI } from "@/config/assistantIdentity";
import {
  Send, Maximize2, Sparkles, MessageSquare, ArrowRight,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const QUICK_ACTIONS = [
  { label: "ملخص طلباتي", message: "أعطني ملخصاً سريعاً لجميع طلباتي" },
  { label: "الخطوة التالية", message: "ما هي الخطوة التالية المطلوبة مني؟" },
  { label: "طلب جديد", message: "أريد تقديم طلب تقييم جديد" },
];

interface Props {
  userId: string;
  userName: string;
}

export default function DashboardChatPanel({ userId, userName }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const initCalledRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sendingRef = useRef(false);

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
    ) {
      return;
    }

    replaceMessages([...messagesRef.current, message]);
  }, [replaceMessages]);

  const seedInitialMessage = useCallback((message: ChatMessage) => {
    if (messagesRef.current.length > 0) return;
    replaceMessages([message]);
  }, [replaceMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Proactive init
  useEffect(() => {
    if (!userId || initCalledRef.current) return;
    initCalledRef.current = true;
    const init = async () => {
      try {
        const data = await getGlobalChatInit(userId);
        if (data?.reply) {
          seedInitialMessage({ id: `ai-0`, role: "assistant", content: data.reply });
        } else {
          seedInitialMessage({ id: `ai-0`, role: "assistant", content: `مرحباً ${userName} 👋\nكيف يمكنني مساعدتك؟` });
        }
      } catch {
        seedInitialMessage({ id: `ai-0`, role: "assistant", content: `مرحباً ${userName} 👋\nكيف يمكنني مساعدتك؟` });
      }
      setInitialized(true);
    };
    init();
  }, [userId, userName, seedInitialMessage]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || sendingRef.current) return;

    appendMessage({ id: `u-${Date.now()}`, role: "user", content: trimmedText });
    setInput("");
    sendingRef.current = true;
    setSending(true);

    try {
      const history = messagesRef.current.slice(-12).map((message) => ({
        content: message.content,
        sender_type: message.role === "user" ? "client" : "ai",
      }));

      const { data, error } = await supabase.functions.invoke("raqeem-client-chat", {
        body: {
          message: trimmedText,
          is_global_chat: true,
          conversationHistory: history,
          requestContext: { client_user_id: userId },
        },
      });

      if (error) throw error;
      if (data?.reply) {
        appendMessage({ id: `ai-${Date.now()}`, role: "assistant", content: data.reply });
      }
      if (data?.newRequestTriggered) navigate("/client/new-request");
      if (data?.switchedRequestId) navigate(`/client/request/${data.switchedRequestId}`);
    } catch {
      appendMessage({ id: `err-${Date.now()}`, role: "assistant", content: AI.errorMessage });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [userId, navigate, appendMessage]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <RaqeemAnimatedLogo size={28} />
          <CardTitle className="text-sm">{AI.name} — مركز التشغيل</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          onClick={() => navigate("/client/chat")}
          title="فتح في صفحة كاملة"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {/* Messages area */}
        <ScrollArea className="h-[320px] px-3 py-2">
          <div className="space-y-3">
            {!initialized && (
              <div className="flex items-center justify-center py-8">
                <RaqeemAnimatedLogo size={48} />
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <RaqeemAnimatedLogo size={22} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 border border-border text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-xs max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {sending && <RaqeemTypingIndicator />}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Quick actions */}
        <div className="px-3 py-1.5 border-t border-border flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((a, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="text-[10px] h-6 px-2 gap-1 rounded-full border-primary/20 text-primary hover:bg-primary/5"
              onClick={() => sendMessage(a.message)}
              disabled={sending}
            >
              {i === 0 ? <Sparkles className="w-3 h-3" /> : i === 2 ? <MessageSquare className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
              {a.label}
            </Button>
          ))}
        </div>

        {/* Input */}
        <div className="px-3 py-2 border-t border-border flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب رسالتك..."
            className="flex-1 h-8 text-xs"
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
            className="h-8 w-8 shrink-0"
            onClick={() => sendMessage(input)}
            disabled={sending || !input.trim()}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
