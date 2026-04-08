/**
 * RaqeemContextCard — Embeddable smart card showing Raqeem's contextual insights.
 * Appears in each page with stage-aware observations and inline chat.
 */
import { useEffect, useState, useRef } from "react";
import { useRaqeemAgent } from "@/contexts/RaqeemAgentContext";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle, CheckCircle2, Info, Send, ChevronDown, ChevronUp,
  Loader2, Sparkles, MessageSquare,
} from "lucide-react";

interface RaqeemContextCardProps {
  assignmentId: string;
  stage?: string;
  pageContext?: string;
  className?: string;
}

export default function RaqeemContextCard({
  assignmentId,
  stage,
  pageContext,
  className = "",
}: RaqeemContextCardProps) {
  const {
    insight, isAnalyzing, messages, isChatting, isExpanded,
    setAssignment, analyze, chat, toggleExpanded,
  } = useRaqeemAgent();

  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Initialize context & auto-analyze
  useEffect(() => {
    if (!initialized.current || assignmentId !== undefined) {
      initialized.current = true;
      setAssignment(assignmentId, stage);
    }
  }, [assignmentId, stage, setAssignment]);

  // Auto-analyze when assignment is set
  useEffect(() => {
    if (assignmentId && !insight && !isAnalyzing) {
      analyze(pageContext);
    }
  }, [assignmentId, insight, isAnalyzing, analyze, pageContext]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!chatInput.trim() || isChatting) return;
    chat(chatInput.trim(), pageContext);
    setChatInput("");
  };

  const riskCount = insight?.risk_flags?.length || 0;

  return (
    <Card className={`border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden ${className}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-primary/5 transition-colors"
        onClick={toggleExpanded}
      >
        <RaqeemAnimatedLogo size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">رقيم – مساعدك الذكي</span>
            {isAnalyzing && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
            {riskCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {riskCount} تحذير
              </Badge>
            )}
            {riskCount === 0 && insight && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3 ml-0.5" /> جاهز
              </Badge>
            )}
          </div>
          {insight?.summary && !isExpanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {insight.summary}
            </p>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="pt-0 pb-3 px-4 space-y-3">
          {/* Insight Summary */}
          {insight && (
            <div className="space-y-2">
              {insight.summary && (
                <p className="text-sm font-medium text-foreground">{insight.summary}</p>
              )}

              {/* Observations */}
              {insight.observations?.length > 0 && (
                <div className="space-y-1">
                  {insight.observations.map((obs, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                      <span className="text-muted-foreground">{obs}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Risk Flags */}
              {insight.risk_flags?.length > 0 && (
                <div className="space-y-1 bg-destructive/5 rounded-md p-2">
                  {insight.risk_flags.map((risk, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-destructive" />
                      <span className="text-destructive">{risk}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Next Action */}
              {insight.next_action && (
                <div className="flex items-start gap-2 text-xs bg-primary/5 rounded-md p-2">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  <span className="font-medium text-primary">{insight.next_action}</span>
                </div>
              )}

              {/* Confidence */}
              {insight.confidence != null && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>درجة الثقة:</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(insight.confidence * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <span>{(insight.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {isAnalyzing && !insight && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري تحليل الوضع...</span>
            </div>
          )}

          {/* Chat Toggle */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={(e) => { e.stopPropagation(); setShowChat(!showChat); }}
            >
              <MessageSquare className="w-3 h-3 ml-1" />
              {showChat ? "إخفاء المحادثة" : "اسأل رقيم"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={(e) => { e.stopPropagation(); analyze(pageContext); }}
              disabled={isAnalyzing}
            >
              <Sparkles className="w-3 h-3 ml-1" />
              تحديث
            </Button>
          </div>

          {/* Inline Chat */}
          {showChat && (
            <div className="border rounded-lg bg-background">
              <ScrollArea className="max-h-48 p-2" ref={scrollRef as any}>
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    اسأل رقيم عن أي شيء يخص هذه المهمة...
                  </p>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`mb-2 text-xs ${msg.role === "user" ? "text-left" : "text-right"}`}
                  >
                    <div
                      className={`inline-block max-w-[90%] rounded-lg px-3 py-2 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-xs max-w-none text-right">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                {isChatting && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>رقيم يفكر...</span>
                  </div>
                )}
              </ScrollArea>
              <div className="flex gap-1 p-2 border-t">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="اكتب سؤالك..."
                  className="text-xs min-h-[32px] h-8 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleSend}
                  disabled={!chatInput.trim() || isChatting}
                >
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
