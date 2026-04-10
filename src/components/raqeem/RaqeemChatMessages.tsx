/**
 * RaqeemChatMessages — Chat message list with orchestration display
 * Extracted from RaqeemPage
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import {
  Bot, User, Edit3, FileText, Loader2, CheckCircle2, AlertCircle, Zap,
} from "lucide-react";

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

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  generate_scope: { label: "توليد نطاق العمل والتسعير", icon: "📋" },
  run_valuation: { label: "تشغيل محرك التقييم", icon: "🔢" },
  generate_report: { label: "توليد مسودة التقرير", icon: "📄" },
  check_compliance: { label: "فحص الامتثال والجودة", icon: "✅" },
  extract_documents: { label: "استخراج بيانات المستندات", icon: "📑" },
  translate_report: { label: "ترجمة التقرير", icon: "🌐" },
  check_consistency: { label: "فحص تطابق النسختين", icon: "🔍" },
};

interface Props {
  messages: Message[];
  isLoading: boolean;
  onCorrect: (msgIndex: number) => void;
  onSendMessage?: (message: string) => void;
}

/** Extract 🟢 action lines from content and return {cleanContent, actions} */
function extractActions(content: string): { cleanContent: string; actions: string[] } {
  const actions: string[] = [];
  const lines = content.split("\n");
  const cleanLines: string[] = [];
  for (const line of lines) {
    const match = line.match(/🟢\s*\*{0,2}(.+?)\*{0,2}\s*$/);
    if (match) {
      actions.push(match[1].trim());
    } else {
      cleanLines.push(line);
    }
  }
  return { cleanContent: cleanLines.join("\n"), actions };
}

export default function RaqeemChatMessages({ messages, isLoading, onCorrect, onSendMessage }: Props) {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "gradient-primary text-primary-foreground"}`}>
            {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
          </div>
          <div className={`flex-1 rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {msg.attachments.map((att, j) => (<Badge key={j} variant="secondary" className="text-xs gap-1"><FileText className="w-3 h-3" /> {att.name}</Badge>))}
              </div>
            )}
            {msg.orchestration && msg.orchestration.length > 0 && (
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5"><Zap className="w-3.5 h-3.5 text-primary" /><span>تنسيق الأنظمة</span></div>
                {msg.orchestration.map((tool, ti) => {
                  const toolInfo = TOOL_LABELS[tool.name] || { label: tool.name, icon: "⚙️" };
                  return (
                    <div key={ti} className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs ${tool.status === "running" ? "border-primary/30 bg-primary/5" : tool.status === "complete" ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                      <span className="text-base">{toolInfo.icon}</span>
                      <span className="font-medium flex-1">{toolInfo.label}</span>
                      {tool.status === "running" && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                      {tool.status === "complete" && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                      {tool.status === "error" && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                    </div>
                  );
                })}
              </div>
            )}
            {msg.role === "assistant" ? (() => {
              const { cleanContent, actions } = extractActions(msg.content);
              return (
                <>
                  <div className="prose prose-sm max-w-none dark:prose-invert" dir="rtl" style={{ textAlign: 'right', unicodeBidi: 'plaintext' as any }}><ReactMarkdown>{cleanContent}</ReactMarkdown></div>
                  {actions.length > 0 && !isLoading && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {actions.map((action, ai) => (
                        <Button
                          key={ai}
                          size="sm"
                          className="gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => onSendMessage?.(action)}
                        >
                          <Zap className="w-3 h-3" />
                          {action}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              );
            })() : (
              <span className="whitespace-pre-wrap leading-[1.9]" dir="rtl" style={{ textAlign: 'right', unicodeBidi: 'plaintext' }}>{msg.content}</span>
            )}
            {msg.role === "assistant" && i === messages.length - 1 && isLoading && <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse mr-1 rounded-sm" />}
            {msg.role === "assistant" && !isLoading && (
              <div className="mt-2 pt-2 border-t border-border/50 flex justify-end">
                <Button variant="ghost" size="sm" className="text-xs h-6 text-muted-foreground hover:text-primary gap-1" onClick={() => onCorrect(i)}><Edit3 className="w-3 h-3" /> تصحيح</Button>
              </div>
            )}
          </div>
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shrink-0 text-primary-foreground"><Bot className="w-3.5 h-3.5" /></div>
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
  );
}
