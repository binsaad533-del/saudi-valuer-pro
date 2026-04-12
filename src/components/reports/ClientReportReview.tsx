import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clientApproveDraft } from "@/lib/workflow-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { REPORT_SECTIONS } from "@/lib/report-types";
import { formatDate } from "@/lib/utils";
import {
  MessageSquareText, Send, CheckCircle, Eye,
  Loader2, AlertTriangle, XCircle, History,
  Inbox, Settings, ClipboardCheck, PackageCheck,
} from "lucide-react";

type ProgressStep = "received" | "processing" | "review" | "ready";

const STEPS: { key: ProgressStep; label: string; icon: any }[] = [
  { key: "received", label: "استلام", icon: Inbox },
  { key: "processing", label: "معالجة", icon: Settings },
  { key: "review", label: "مراجعة", icon: ClipboardCheck },
  { key: "ready", label: "جاهز", icon: PackageCheck },
];

function getCurrentStep(report: any, comments: any[]): ProgressStep {
  if (!report) return "received";
  const hasOpenComments = comments.some((c) => c.status === "open" || c.status === "under_review");
  if (report.status === "delivered" || report.status === "issued") return "ready";
  if (report.status === "approved") return "review";
  if (hasOpenComments || report.status === "review") return "processing";
  return "received";
}

function ProgressTracker({ currentStep }: { currentStep: ProgressStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-between gap-1 p-3 rounded-lg bg-muted/30 border border-border">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;

        return (
          <div key={step.key} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isCompleted
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : isCurrent
                    ? "bg-primary/10 text-primary ring-2 ring-primary/30"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isCurrent ? "text-primary" : isCompleted ? "text-green-700 dark:text-green-400" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 rounded-full mt-[-14px] ${
                  isCompleted ? "bg-green-400 dark:bg-green-600" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  reportId: string;
  requestId: string;
  assignmentId?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: "مفتوح", icon: AlertTriangle, color: "bg-warning/10 text-warning" },
  under_review: { label: "قيد المراجعة", icon: Eye, color: "bg-primary/10 text-primary" },
  resolved: { label: "تم الحل", icon: CheckCircle, color: "bg-success/10 text-success" },
  rejected: { label: "مرفوض", icon: XCircle, color: "bg-destructive/10 text-destructive" },
};

export default function ClientReportReview({ reportId, requestId, assignmentId }: Props) {
  const { toast } = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [selectedSection, setSelectedSection] = useState("general");

  const loadData = async () => {
    const [commentsRes, reportRes] = await Promise.all([
      supabase.from("report_comments" as any).select("*").eq("report_id", reportId).order("created_at", { ascending: false }),
      supabase.from("reports" as any).select("*").eq("id", reportId).single(),
    ]);
    setComments((commentsRes.data as any[]) || []);
    setReport(reportRes.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [reportId]);

  const submitComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase.from("report_comments" as any).insert({
        report_id: reportId,
        request_id: requestId,
        author_id: user.id,
        author_type: "client",
        section_key: selectedSection === "general" ? null : selectedSection,
        comment_text: newComment,
        status: "open",
        report_version: report?.version || 1,
      });

      const sectionLabel = selectedSection === "general"
        ? "عام"
        : REPORT_SECTIONS.find(s => s.key === selectedSection)?.title_ar || selectedSection;

      await supabase.from("request_messages" as any).insert({
        request_id: requestId,
        sender_id: user.id,
        sender_type: "client" as any,
        content: `📝 ملاحظة على التقرير (${sectionLabel}):\n${newComment}`,
        metadata: { type: "report_comment", report_id: reportId, section: selectedSection },
      });

      await supabase.from("valuation_requests" as any)
        .update({ status: "client_comments" as any })
        .eq("id", requestId);

      setNewComment("");
      setSelectedSection("general");
      toast({ title: "تم إرسال الملاحظة" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const confirmNoComments = async () => {
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from("request_messages" as any).insert({
        request_id: requestId,
        sender_id: user?.id,
        sender_type: "client" as any,
        content: "✅ تم مراجعة المسودة - لا توجد ملاحظات إضافية",
      });

      // Advance workflow: stage_7_client_draft → pending_payment_2
      if (assignmentId) {
        const result = await clientApproveDraft(assignmentId);
        if (!result.success) {
          toast({ title: "خطأ", description: result.error || "فشل تأكيد المراجعة", variant: "destructive" });
          return;
        }
      } else {
        // Fallback: direct status update on request
        await supabase.from("valuation_requests" as any)
          .update({ status: "pending_payment_2" as any })
          .eq("id", requestId);
      }

      toast({ title: "تم تأكيد المراجعة — الانتقال للدفعة النهائية" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const openComments = comments.filter(c => c.status === "open" || c.status === "under_review");

  return (
    <Card className="shadow-card border-info/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-info" />
            مراجعة المسودة
          </div>
          <Badge variant="secondary" className="text-[10px]">الإصدار {report?.version || 1}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Tracker */}
        <ProgressTracker currentStep={getCurrentStep(report, comments)} />


        <div className="space-y-2">
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="text-xs h-8">
              <SelectValue placeholder="القسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">ملاحظة عامة</SelectItem>
              {REPORT_SECTIONS.map(s => (
                <SelectItem key={s.key} value={s.key}>{s.title_ar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="أضف ملاحظتك على المسودة..."
            className="text-sm min-h-[60px]"
          />
          <Button size="sm" className="w-full text-xs" onClick={submitComment} disabled={!newComment.trim() || sending}>
            {sending ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Send className="w-3 h-3 ml-1" />}
            إرسال الملاحظة
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center"><span className="bg-card px-2 text-[10px] text-muted-foreground">أو</span></div>
        </div>

        <Button size="sm" variant="outline" className="w-full text-xs" onClick={confirmNoComments} disabled={sending || openComments.length > 0}>
          <CheckCircle className="w-3 h-3 ml-1" />
          المسودة مقبولة - لا توجد ملاحظات
        </Button>
        {openComments.length > 0 && (
          <p className="text-[10px] text-muted-foreground text-center">لا يمكن التأكيد حتى يتم حل جميع الملاحظات المفتوحة ({openComments.length})</p>
        )}

        {comments.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-foreground flex items-center gap-1">
              <History className="w-3 h-3" /> ملاحظاتك ({comments.length})
            </p>
            {comments.map(comment => {
              const config = STATUS_CONFIG[comment.status] || STATUS_CONFIG.open;
              const Icon = config.icon;
              return (
                <div key={comment.id} className="p-2.5 rounded-lg bg-muted/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge className={`${config.color} text-[10px]`}>
                      <Icon className="w-2.5 h-2.5 ml-0.5" />{config.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">v{comment.report_version}</span>
                  </div>
                  <p className="text-xs text-foreground">{comment.comment_text}</p>
                  {comment.resolution_note && (
                    <div className="p-1.5 bg-success/5 rounded text-[10px] text-muted-foreground">
                      <span className="font-medium text-success">الرد: </span>{comment.resolution_note}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(comment.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
