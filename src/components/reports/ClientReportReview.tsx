import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { REPORT_SECTIONS } from "@/lib/report-types";
import {
  MessageSquareText, Send, CheckCircle, Clock, Eye,
  Loader2, AlertTriangle, XCircle, FileText, History,
} from "lucide-react";

interface Props {
  reportId: string;
  requestId: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: "مفتوح", icon: AlertTriangle, color: "bg-warning/10 text-warning" },
  under_review: { label: "قيد المراجعة", icon: Eye, color: "bg-primary/10 text-primary" },
  resolved: { label: "تم الحل", icon: CheckCircle, color: "bg-success/10 text-success" },
  rejected: { label: "مرفوض", icon: XCircle, color: "bg-destructive/10 text-destructive" },
};

export default function ClientReportReview({ reportId, requestId }: Props) {
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

      await supabase.from("valuation_requests" as any)
        .update({ status: "final_payment_pending" as any })
        .eq("id", requestId);

      toast({ title: "تم تأكيد المراجعة" });
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
        <div className="p-3 bg-muted/30 rounded-lg border-2 border-dashed border-warning/30 text-center">
          <div className="text-warning font-bold text-sm mb-1 opacity-50">DRAFT / مسودة</div>
          <p className="text-[10px] text-muted-foreground">راجع المسودة وأضف ملاحظاتك أدناه</p>
        </div>

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
                    {new Date(comment.created_at).toLocaleDateString("ar-SA")}
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
