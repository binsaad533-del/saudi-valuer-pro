import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Download,
  Plus,
  History,
  AlertTriangle,
  Lock,
  CalendarClock,
  RefreshCw,
  FileText,
} from "lucide-react";
import {
  createNewReportVersion,
  regenerateReportPDF,
  createRevaluation,
  type ReportVersionType,
} from "@/lib/valuation-engine-api";

interface ReportLifecyclePanelProps {
  assignment: any;
  reports: any[];
  onRefresh: () => void;
}

const VERSION_TYPES: { value: ReportVersionType; label: string }[] = [
  { value: "change_intended_users", label: "تغيير المستخدمين المقصودين" },
  { value: "change_purpose", label: "تغيير الغرض من التقييم" },
  { value: "minor_update", label: "تحديث طفيف" },
  { value: "addendum", label: "ملحق" },
];

function getReportStatus(report: any): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any } {
  if (report.expired_at || report.status === "expired") {
    return { label: "منتهي الصلاحية", variant: "destructive", icon: AlertTriangle };
  }
  if (report.superseded_by) {
    return { label: "ملغى (مُحدَّث)", variant: "secondary", icon: RefreshCw };
  }
  if (report.is_locked && report.is_final) {
    // Check if approaching expiry
    if (report.expiry_date) {
      const daysLeft = Math.ceil((new Date(report.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 14 && daysLeft > 0) {
        return { label: `صالح (${daysLeft} يوم متبقي)`, variant: "outline", icon: CalendarClock };
      }
    }
    return { label: "صادر ومؤمّن", variant: "default", icon: Lock };
  }
  return { label: "مسودة", variant: "secondary", icon: FileText };
}

export default function ReportLifecyclePanel({ assignment, reports, onRefresh }: ReportLifecyclePanelProps) {
  const { toast } = useToast();
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [versionType, setVersionType] = useState<ReportVersionType>("minor_update");
  const [versionReason, setVersionReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [creatingReval, setCreatingReval] = useState(false);

  
  const issuedReport = reports.find((r: any) => r.is_final && r.is_locked);
  const assignmentId = assignment?.id;

  const handleCreateVersion = async () => {
    if (!assignmentId || !issuedReport) return;
    setCreatingVersion(true);
    try {
      const result = await createNewReportVersion(
        assignmentId,
        issuedReport.id,
        versionType,
        versionReason || undefined,
        undefined
      );
      toast({
        title: "✅ تم إنشاء إصدار جديد",
        description: `الإصدار ${result.version} جاهز للتعديل`,
      });
      setDialogOpen(false);
      setVersionReason("");
      onRefresh();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleDownload = async (report: any) => {
    if (!assignmentId) return;
    setDownloading(report.id);
    try {
      const result = await regenerateReportPDF(assignmentId, report.id);
      if (result.report_url) {
        window.open(result.report_url, "_blank");
      }
      toast({ title: "✅ تم تحميل التقرير" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleRevaluation = async () => {
    if (!assignmentId) return;
    setCreatingReval(true);
    try {
      await createRevaluation(assignmentId);
      toast({
        title: "✅ تم إنشاء إعادة تقييم",
        description: "مهمة جديدة مرتبطة بالتقييم السابق",
      });
      onRefresh();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setCreatingReval(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Report Status Overview */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            دورة حياة التقرير
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Assignment Info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-muted-foreground">نوع المهمة</p>
              <p className="font-medium text-foreground mt-0.5">
                {assignment?.assignment_type === "revaluation" ? "إعادة تقييم" : "تقييم جديد"}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-muted-foreground">تاريخ التقييم</p>
              <p className="font-medium text-foreground mt-0.5">
                {assignment?.valuation_date || "غير محدد"}
              </p>
            </div>
            {assignment?.is_retrospective && (
              <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                <p className="text-amber-600 font-medium flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5" />
                  تقييم بأثر رجعي
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {assignment.retrospective_note_ar || "التقييم لتاريخ سابق"}
                </p>
              </div>
            )}
          </div>

          {/* Reports List */}
          <div className="space-y-2">
            {reports.map((report: any) => {
              const status = getReportStatus(report);
              const StatusIcon = status.icon;
              return (
                <div
                  key={report.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card text-xs"
                >
                  <StatusIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">
                        v{report.version}
                      </span>
                      <Badge variant={status.variant} className="text-[9px] h-4">
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-muted-foreground">
                      {report.issue_date && (
                        <span>صدر: {report.issue_date}</span>
                      )}
                      {report.expiry_date && (
                        <span>ينتهي: {report.expiry_date}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleDownload(report)}
                    disabled={downloading === report.id}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {issuedReport && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    إصدار جديد
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إنشاء إصدار جديد</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      سيتم إنشاء نسخة جديدة من التقرير مع الاحتفاظ بالإصدار السابق.
                    </p>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">نوع التغيير</label>
                      <Select
                        value={versionType}
                        onValueChange={(v) => setVersionType(v as ReportVersionType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VERSION_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">سبب التغيير</label>
                      <Textarea
                        value={versionReason}
                        onChange={(e) => setVersionReason(e.target.value)}
                        placeholder="وصف التغيير المطلوب..."
                        rows={3}
                      />
                    </div>
                    <Button
                      onClick={handleCreateVersion}
                      disabled={creatingVersion}
                      className="w-full"
                    >
                      {creatingVersion ? "جاري الإنشاء..." : "إنشاء الإصدار الجديد"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {issuedReport && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={handleRevaluation}
                disabled={creatingReval}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                إعادة تقييم
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      {reports.length > 1 && (
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              سجل الإصدارات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pr-4 space-y-3">
              <div className="absolute right-1.5 top-0 bottom-0 w-px bg-border" />
              {reports.map((report: any, i: number) => {
                const status = getReportStatus(report);
                return (
                  <div key={report.id} className="relative pr-6 text-xs">
                    <div className={`absolute right-0 top-1 w-3 h-3 rounded-full border-2 ${
                      i === 0 ? "bg-primary border-primary" : "bg-background border-border"
                    }`} />
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">الإصدار {report.version}</span>
                      <Badge variant={status.variant} className="text-[9px] h-4">
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      {report.created_at ? new Date(report.created_at).toLocaleDateString("ar-SA") : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
