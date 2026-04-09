/**
 * RaqeemChatPage — Universal Raqeem chat accessible to all authenticated users.
 * Supports file/image uploads of all types and sizes.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ArrowRight, Paperclip, X, FileText, Image, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";

interface Attachment {
  name: string;
  type: string;
  size: number;
  url?: string;
  file?: File;
  uploading?: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
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

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[^a-zA-Z0-9\u0600-\u06FF._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

function getFileIcon(type: string) {
  if (isImageType(type)) return Image;
  if (type.includes("pdf") || type.includes("word") || type.includes("document")) return FileText;
  return File;
}

export default function RaqeemChatPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveRole = role === "admin_coordinator" || role === "valuation_manager" || role === "valuer"
    ? "owner" : (role || "client");

  const suggestedPrompts = ROLE_PROMPTS[effectiveRole] || ROLE_PROMPTS.client;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const uploadFile = async (file: File): Promise<Attachment | null> => {
    if (!user) {
      toast.error("يجب تسجيل الدخول لرفع الملفات");
      return null;
    }

    const sanitized = sanitizeFileName(file.name) || `file-${Date.now()}`;
    const path = `${user.id}/raqeem-chat/${Date.now()}-${sanitized}`;

    const { data, error } = await supabase.storage
      .from("client-uploads")
      .upload(path, file, { upsert: false });

    if (error) {
      console.error("Upload error:", error);
      toast.error(`فشل رفع: ${file.name}`);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("client-uploads")
      .getPublicUrl(data.path);

    return {
      name: file.name,
      type: file.type,
      size: file.size,
      url: urlData.publicUrl,
    };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: Attachment[] = Array.from(files).map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
      file: f,
      uploading: true,
    }));

    setAttachedFiles((prev) => [...prev, ...newFiles]);

    // Upload all files in parallel
    setIsUploading(true);
    const results = await Promise.all(
      Array.from(files).map(async (file, idx) => {
        const result = await uploadFile(file);
        // Update individual file status
        setAttachedFiles((prev) =>
          prev.map((a, i) => {
            if (i === prev.length - newFiles.length + idx) {
              return result
                ? { ...result, uploading: false }
                : { ...a, uploading: false };
            }
            return a;
          })
        );
        return result;
      })
    );

    // Remove failed uploads
    setAttachedFiles((prev) => prev.filter((a) => !a.uploading || a.url));
    setIsUploading(false);

    const successCount = results.filter(Boolean).length;
    if (successCount > 0) {
      toast.success(`تم رفع ${successCount} ملف بنجاح`);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = useCallback(async (text: string, files: Attachment[] = []) => {
    if ((!text.trim() && files.length === 0) || isLoading) return;

    const attachmentContext = files.length > 0
      ? `\n\n[مرفقات: ${files.map((f) => `${f.name} (${f.type})`).join("، ")}]`
      : "";

    const userMsg: Message = {
      role: "user",
      content: text.trim() || (files.length > 0 ? `تم إرفاق ${files.length} ملف` : ""),
      attachments: files.length > 0 ? files : undefined,
    };

    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      const messageContent = (text.trim() || "") + attachmentContext;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m.role === "user" && m === userMsg ? messageContent : m.content,
          })),
          userRole: effectiveRole,
          attachments: files.map((f) => ({ name: f.name, type: f.type, url: f.url })),
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

  const handleSend = () => {
    sendMessage(input, attachedFiles);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getBackPath = () => {
    if (effectiveRole === "client") return "/client";
    if (effectiveRole === "inspector") return "/inspector";
    return "/";
  };

  const renderAttachments = (attachments: Attachment[]) => (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att, i) => {
        const Icon = getFileIcon(att.type);
        if (isImageType(att.type) && att.url) {
          return (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={att.url}
                alt={att.name}
                className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-border"
              />
            </a>
          );
        }
        return (
          <a
            key={i}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border text-xs hover:bg-accent transition-colors"
          >
            <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="truncate max-w-[120px]">{att.name}</span>
            <span className="text-muted-foreground">{formatFileSize(att.size)}</span>
          </a>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(getBackPath())}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-primary-foreground">
            <RaqeemIcon size={40} className="text-primary-foreground" />
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
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <RaqeemIcon size={28} className="text-primary" />
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
                  {msg.attachments && msg.attachments.length > 0 && renderAttachments(msg.attachments)}
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

      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-4 py-2">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {attachedFiles.map((att, i) => {
              const Icon = getFileIcon(att.type);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs"
                >
                  {att.uploading ? (
                    <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className="truncate max-w-[100px]">{att.name}</span>
                  <span className="text-muted-foreground">{formatFileSize(att.size)}</span>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 items-end">
            {/* File Upload Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading}
              className="shrink-0 h-11 w-11 text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="*/*"
            />

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالتك هنا أو أرفق ملفات..."
              className="resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={(!input.trim() && attachedFiles.length === 0) || isLoading || isUploading}
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
