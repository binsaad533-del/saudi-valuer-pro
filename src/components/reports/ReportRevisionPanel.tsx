import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
import { formatDate } from "@/lib/utils";

  MessageSquareText, CheckCircle, XCircle, Clock, Eye,
  History, FileText, Loader2, AlertTriangle, RefreshCw,
} from "lucide-react";

interface Props {
  reportId: string;
  assignmentId: string;
  requestId?: string;
  isAdmin?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: "مفتوح", icon: AlertTriangle, color: "bg-warning/10 text-warning" },
  under_review: { label: "قيد المراجعة", icon: Eye, color: "bg-primary/10 text-primary" },
  resolved: { label: "تم الحل", icon: CheckCircle, color: "bg-success/10 text-success" },
  rejected: { label: "مرفوض", icon: XCircle, color: "bg-destructive/10 text-destructive" },
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  revision: "مراجعة",
  client_comment: "ملاحظة عميل",
  internal_correction: "تصحيح داخلي",
  post_issuance_correction: "تصحيح بعد الإصدار",
  addendum: "ملحق",
};

export default function ReportRevisionPanel({ reportId, assignmentId, requestId, isAdmin = false }: Props) {
  const { toast } = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [changeLog, setChangeLog] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolutionNote, setResolutionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "versions" | "changelog">("comments");

  const loadData = async () => {
    const [commentsRes, versionsRes, changeLogRes, reportRes] = await Promise.all([
      supabase.from("report_comments" as any).select("*").eq("report_id", reportId).order("created_at", { ascending: false }),
      supabase.from("report_versions" as any).select("*").eq("report_id", reportId).order("version_number", { ascending: false }),
      supabase.from("report_change_log" as any).select("*").eq("report_id", reportId).order("created_at", { ascending: false }),
      supabase.from("reports" as any).select("*").eq("id", reportId).single(),
    ]);
    setComments((commentsRes.data as any[]) || []);
    setVersions((versionsRes.data as any[]) || []);
    setChangeLog((changeLogRes.data as any[]) || []);
    setReport(reportRes.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [reportId]);

  const updateCommentStatus = async (commentId: string, newStatus: string) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updateData: any = { status: newStatus };
      if (newStatus === "resolved" || newStatus === "rejected") {
        updateData.resolved_by = user?.id;
        updateData.resolved_at = new Date().toISOString();
        if (resolutionNote) updateData.resolution_note = resolutionNote;
      }
      await supabase.from("report_comments" as any).update(updateData).eq("id", commentId);

      // Log to chat
      if (requestId) {
        const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
        await supabase.from("request_messages" as any).insert({
          request_id: requestId,
          sender_type: "system" as any,
          content: `📋 تم تحديث حالة الملاحظة إلى: ${statusLabel}${resolutionNote ? `\nالملاحظة: ${resolutionNote}` : ""}`,
        });
      }

      setResolutionNote("");
      toast({ title: "تم تحديث الحالة" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createNewVersion = async (changeSummary: string, changeType: string, relatedCommentId?: string) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentVersion = report?.version || 1;
      const newVersion = currentVersion + 1;

      // Save current content as version snapshot
      await supabase.from("report_versions" as any).insert({
        report_id: reportId,
        version_number: currentVersion,
        content_snapshot: { content_ar: report?.content_ar, content_en: report?.content_en, cover_page: report?.cover_page },
        created_by: user?.id,
        change_summary: changeSummary,
      });

      // Update report version
      await supabase.from("reports" as any).update({ version: newVersion }).eq("id", reportId);

      // Log change
      await supabase.from("report_change_log" as any).insert({
        report_id: reportId,
        version_from: currentVersion,
        version_to: newVersion,
        change_type: changeType,
        changed_by: user?.id,
        change_summary_ar: changeSummary,
        related_comment_id: relatedCommentId,
      });

      if (requestId) {
        await supabase.from("request_messages" as any).insert({
          request_id: requestId,
          sender_type: "system" as any,
          content: `📄 تم إصدار نسخة جديدة من التقرير (الإصدار ${newVersion})\nالتغيير: ${changeSummary}`,
        });
      }

      toast({ title: `تم إنشاء الإصدار ${newVersion}` });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const issuePostIssuanceCorrection = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentVersion = report?.version || 1;
      const newVersion = currentVersion + 1;

      // Save snapshot
      await supabase.from("report_versions" as any).insert({
        report_id: reportId,
        version_number: currentVersion,
        content_snapshot: { content_ar: report?.content_ar, content_en: report?.content_en, cover_page: report?.cover_page },
        created_by: user?.id,
        change_summary: "نسخة ما قبل التصحيح بعد الإصدار",
      });

      // Create corrected version (unlock temporarily, then re-lock)
      await supabase.from("reports" as any).update({
        version: newVersion,
        status: "corrected_reissue",
      }).eq("id", reportId);

      await supabase.from("report_change_log" as any).insert({
        report_id: reportId,
        version_from: currentVersion,
        version_to: newVersion,
        change_type: "post_issuance_correction",
        changed_by: user?.id,
        change_summary_ar: "تصحيح وإعادة إصدار بعد الإصدار النهائي",
      });

      if (requestId) {
        await supabase.from("request_messages" as any).insert({
          request_id: requestId,
          sender_type: "system" as any,
          content: `⚠️ تم إصدار نسخة مصححة من التقرير النهائي (الإصدار ${newVersion})`,
        });
      }

      toast({ title: "تم إصدار النسخة المصححة" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openCount = comments.filter(c => c.status === "open").length;
  const underReviewCount = comments.filter(c => c.status === "under_review").length;

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-3 rounded-lg bg-warning/10 text-center">
          <p className="text-lg font-bold text-warning">{openCount}</p>
          <p className="text-[10px] text-muted-foreground">مفتوح</p>
        </div>
        <div className="p-3 rounded-lg bg-primary/10 text-center">
          <p className="text-lg font-bold text-primary">{underReviewCount}</p>
          <p className="text-[10px] text-muted-foreground">قيد المراجعة</p>
        </div>
        <div className="p-3 rounded-lg bg-success/10 text-center">
          <p className="text-lg font-bold text-success">{comments.filter(c => c.status === "resolved").length}</p>
          <p className="text-[10px] text-muted-foreground">تم الحل</p>
        </div>
        <div className="p-3 rounded-lg bg-muted text-center">
          <p className="text-lg font-bold text-foreground">{report?.version || 1}</p>
          <p className="text-[10px] text-muted-foreground">الإصدار</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {[
          { key: "comments" as const, label: "الملاحظات", icon: MessageSquareText, count: comments.length },
          { key: "versions" as const, label: "الإصدارات", icon: History, count: versions.length },
          { key: "changelog" as const, label: "سجل التغييرات", icon: FileText, count: changeLog.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded text-xs font-medium transition-colors ${
              activeTab === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
            {tab.count > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 mr-1">{tab.count}</Badge>}
          </button>
        ))}
      </div>

      {/* Comments Tab */}
      {activeTab === "comments" && (
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">لا توجد ملاحظات</p>
          ) : (
            comments.map(comment => {
              const config = STATUS_CONFIG[comment.status] || STATUS_CONFIG.open;
              const Icon = config.icon;
              return (
                <Card key={comment.id} className="shadow-sm">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${config.color} text-[10px]`}>
                            <Icon className="w-3 h-3 ml-1" />{config.label}
                          </Badge>
                          {comment.section_key && (
                            <Badge variant="outline" className="text-[10px]">{comment.section_key}</Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            v{comment.report_version} • {comment.author_type === "client" ? "العميل" : "المقيّم"}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{comment.comment_text}</p>
                        {comment.resolution_note && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                            <span className="font-medium">الرد: </span>{comment.resolution_note}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDate(comment.created_at)} - {new Date(comment.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>

                    {/* Admin actions */}
                    {isAdmin && (comment.status === "open" || comment.status === "under_review") && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <Textarea
                          value={resolutionNote}
                          onChange={e => setResolutionNote(e.target.value)}
                          placeholder="ملاحظة الحل أو الرفض..."
                          className="text-xs min-h-[50px]"
                        />
                        <div className="flex gap-1.5">
                          {comment.status === "open" && (
                            <Button size="sm" variant="outline" className="text-xs flex-1" onClick={() => updateCommentStatus(comment.id, "under_review")} disabled={saving}>
                              <Eye className="w-3 h-3 ml-1" />قيد المراجعة
                            </Button>
                          )}
                          <Button size="sm" className="text-xs flex-1" onClick={() => updateCommentStatus(comment.id, "resolved")} disabled={saving}>
                            <CheckCircle className="w-3 h-3 ml-1" />تم الحل
                          </Button>
                          <Button size="sm" variant="destructive" className="text-xs" onClick={() => updateCommentStatus(comment.id, "rejected")} disabled={saving}>
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Admin: create new version based on resolved comments */}
          {isAdmin && comments.some(c => c.status === "resolved") && (
            <Card className="border-primary/20">
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">إصدار نسخة جديدة بناءً على الملاحظات المحلولة</p>
                <Button size="sm" className="w-full text-xs" onClick={() => createNewVersion("مراجعة بناءً على ملاحظات العميل", "client_comment")} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <RefreshCw className="w-3 h-3 ml-1" />}
                  إصدار نسخة مراجعة
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Post-issuance correction */}
          {isAdmin && report?.is_final && (
            <Card className="border-destructive/20">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="font-medium">التقرير النهائي مؤمّن - تصحيح بعد الإصدار فقط</span>
                </div>
                <Button size="sm" variant="destructive" className="w-full text-xs" onClick={issuePostIssuanceCorrection} disabled={saving}>
                  إصدار نسخة مصححة
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Versions Tab */}
      {activeTab === "versions" && (
        <div className="space-y-2">
          {/* Current version */}
          <Card className="border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary text-[10px]">الإصدار الحالي</Badge>
                  <span className="text-sm font-bold">v{report?.version || 1}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {report?.updated_at ? formatDate(report.updated_at) : ""}
                </span>
              </div>
            </CardContent>
          </Card>

          {versions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">لا توجد إصدارات سابقة</p>
          ) : (
            versions.map(ver => (
              <Card key={ver.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">الإصدار {ver.version_number}</span>
                      {ver.change_summary && <p className="text-xs text-muted-foreground mt-0.5">{ver.change_summary}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(ver.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Change Log Tab */}
      {activeTab === "changelog" && (
        <div className="space-y-2">
          {changeLog.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">لا يوجد سجل تغييرات</p>
          ) : (
            changeLog.map(log => (
              <Card key={log.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          v{log.version_from} → v{log.version_to}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {CHANGE_TYPE_LABELS[log.change_type] || log.change_type}
                        </Badge>
                      </div>
                      {log.change_summary_ar && <p className="text-xs text-foreground">{log.change_summary_ar}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
