import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import RaqeemTypingIndicator from "@/components/client/chat/RaqeemTypingIndicator";
import { AI } from "@/config/assistantIdentity";
import {
  Send, Paperclip, Plus, FileText, Clock, CreditCard,
  ClipboardCheck, HelpCircle, Upload, Sparkles, MessageSquare,
  ArrowRight,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initCalledRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);

  const replaceMessages = useCallback((nextMessages: ChatMessage[]) => {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    replaceMessages([...messagesRef.current, message]);
  }, [replaceMessages]);

  const seedInitialMessage = useCallback((message: ChatMessage) => {
    if (messagesRef.current.length > 0) return;
    replaceMessages([message]);
  }, [replaceMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Init: load user, send proactive first message
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

      // Send proactive first message
      try {
        const { data, error } = await supabase.functions.invoke("raqeem-client-chat", {
          body: {
            message: "__init_global_chat__",
            is_global_chat: true,
            conversationHistory: [],
            requestContext: { client_user_id: user.id },
          },
        });

        if (!error && data?.reply) {
          seedInitialMessage({
            id: `ai-${Date.now()}`,
            role: "assistant",
            content: data.reply,
            timestamp: new Date().toISOString(),
          });
          if (data.suggestedActions) setSuggestedActions(data.suggestedActions);
        } else {
          // Fallback welcome
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

  const sendMessage = useCallback(async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedText,
      timestamp: new Date().toISOString(),
    };
    appendMessage(userMsg);
    setInput("");
    setSending(true);

    try {
      const history = messagesRef.current.slice(-20).map((message) => ({
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

      const reply = data?.reply?.trim();
      if (reply) {
        appendMessage({
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: reply,
          timestamp: new Date().toISOString(),
        });
      }

      // Handle action tokens
      if (data?.newRequestTriggered) {
        navigate("/client/new-request");
      }
      if (data?.switchedRequestId) {
        navigate(`/client/request/${data.switchedRequestId}`);
      }
      if (data?.suggestedActions) {
        setSuggestedActions(data.suggestedActions);
      }
      if (data?.scopeApproved) {
        toast({ title: "تم اعتماد نطاق العمل بنجاح" });
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
      setSending(false);
    }
  }, [sending, userId, navigate, toast, appendMessage]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    
    const fileNames = Array.from(files).map(f => f.name).join("، ");
    
    // Upload files
    for (const file of Array.from(files)) {
      const path = `client-data/global/${userId}/${crypto.randomUUID()}_${file.name}`;
      await supabase.storage.from("client-uploads").upload(path, file);
    }
    
    sendMessage(`تم رفع الملفات التالية: ${fileNames}`);
    e.target.value = "";
  };

  return (
    <div className="bg-background h-[calc(100vh-56px)] flex flex-col" dir="rtl">
      {/* Chat Header */}
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
      <ScrollArea className="flex-1">
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
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
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
