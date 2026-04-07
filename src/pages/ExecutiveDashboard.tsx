import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Eye,
  RotateCcw,
  FileOutput,
  ThumbsUp,
  XCircle,
  AlertCircle,
} from "lucide-react";

/* ── Types ── */
interface Assignment {
  id: string;
  reference_number: string;
  status: string;
  asset_type: string | null;
  confidence_score: number | null;
  final_value_approved: boolean | null;
  created_at: string;
  client_id: string | null;
  client?: { name_ar: string } | null;
}

/* ── Status helpers ── */
const STATUS_NEW = ["draft", "submitted"];
const STATUS_PROGRESS = ["processing", "inspection", "valuation_ready", "under_review"];
const STATUS_APPROVAL = ["under_review"];
const STATUS_COMPLETE = ["approved", "issued"];
const STATUS_BLOCKED = ["rejected", "on_hold", "cancelled"];

const statusLabel: Record<string, string> = {
  draft: "مسودة",
  submitted: "مقدم",
  processing: "قيد المعالجة",
  inspection: "معاينة",
  valuation_ready: "جاهز للتقييم",
  under_review: "تحت المراجعة",
  approved: "معتمد",
  issued: "صادر",
  rejected: "مرفوض",
  on_hold: "معلق",
  cancelled: "ملغى",
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (STATUS_COMPLETE.includes(s)) return "default";
  if (STATUS_BLOCKED.includes(s)) return "destructive";
  if (STATUS_APPROVAL.includes(s)) return "secondary";
  return "outline";
};

const assetTypeLabel: Record<string, string> = {
  real_estate: "عقار",
  land: "أرض",
  apartment: "شقة",
  villa: "فيلا",
  commercial: "تجاري",
  industrial: "صناعي",
  equipment: "آلات ومعدات",
  vehicle: "مركبة",
};

/* ── Component ── */
export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");

  const [clientRequests, setClientRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [{ data: aData }, { data: pData }, { data: reqData }] = await Promise.all([
        supabase
          .from("valuation_assignments")
          .select("id, reference_number, status, asset_type, confidence_score, final_value_approved, created_at, client_id, clients(name_ar)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("profiles").select("full_name_ar").eq("user_id", user.id).maybeSingle(),
        supabase.from("valuation_requests" as any).select("*").order("created_at", { ascending: false }).limit(10),
      ]);

      if (pData) setProfileName(pData.full_name_ar || "");

      const mapped = (aData || []).map((a: any) => ({
        ...a,
        client: a.clients || null,
      }));
      setAssignments(mapped);
      setClientRequests((reqData as any[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  /* ── Derived counts ── */
  const newCount = assignments.filter(a => STATUS_NEW.includes(a.status)).length;
  const progressCount = assignments.filter(a => STATUS_PROGRESS.includes(a.status)).length;
  const approvalCount = assignments.filter(a => STATUS_APPROVAL.includes(a.status)).length;
  const completedCount = assignments.filter(a => STATUS_COMPLETE.includes(a.status)).length;
  const blockedCount = assignments.filter(a => STATUS_BLOCKED.includes(a.status)).length;

  /* ── Alerts ── */
  const highRisk = assignments.filter(a => a.confidence_score !== null && a.confidence_score < 60 && !STATUS_COMPLETE.includes(a.status));
  const lowConfidence = assignments.filter(a => a.confidence_score !== null && a.confidence_score >= 60 && a.confidence_score < 75 && !STATUS_COMPLETE.includes(a.status));
  const alerts = [
    ...highRisk.map(a => ({ id: a.id, ref: a.reference_number, type: "risk" as const, msg: `تقييم عالي المخاطر — ثقة ${a.confidence_score}%` })),
    ...lowConfidence.map(a => ({ id: a.id, ref: a.reference_number, type: "warning" as const, msg: `مستوى ثقة منخفض — ${a.confidence_score}%` })),
    ...assignments.filter(a => STATUS_BLOCKED.includes(a.status)).map(a => ({ id: a.id, ref: a.reference_number, type: "blocked" as const, msg: `تقرير متوقف — ${statusLabel[a.status] || a.status}` })),
  ];

  const metrics = [
    { label: "طلبات جديدة", value: newCount, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "قيد التنفيذ", value: progressCount, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "بانتظار الاعتماد", value: approvalCount, icon: ShieldCheck, color: "text-info", bg: "bg-info/10" },
    { label: "مكتملة", value: completedCount, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "متوقفة", value: blockedCount, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-bold text-foreground">
            مرحباً، {profileName || "المالك"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">نظرة شاملة على جميع التقييمات</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {metrics.map(m => {
            const Icon = m.icon;
            return (
              <Card key={m.label} className="shadow-sm">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className={`w-10 h-10 rounded-lg ${m.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${m.color}`} />
                  </div>
                  <span className="text-2xl font-bold text-foreground">{m.value}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Requests Table */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">جميع الطلبات</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">رقم الطلب</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">العميل</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">نوع الأصل</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">الحالة</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">الثقة</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">القرار</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.slice(0, 20).map(a => (
                      <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-foreground">{a.reference_number}</td>
                        <td className="px-4 py-2.5 text-foreground">{a.client?.name_ar || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{assetTypeLabel[a.asset_type || ""] || a.asset_type || "—"}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={statusVariant(a.status)} className="text-[11px]">
                            {statusLabel[a.status] || a.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          {a.confidence_score !== null ? (
                            <span className={`font-semibold text-xs ${a.confidence_score >= 75 ? "text-success" : a.confidence_score >= 60 ? "text-warning" : "text-destructive"}`}>
                              {a.confidence_score}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {a.final_value_approved ? (
                            <Badge variant="default" className="text-[10px] bg-success text-success-foreground">معتمد</Badge>
                          ) : STATUS_APPROVAL.includes(a.status) ? (
                            <Badge variant="secondary" className="text-[10px]">بانتظار</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="عرض التفاصيل"
                              onClick={() => navigate(`/assignment/${a.id}`)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {STATUS_APPROVAL.includes(a.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-success hover:text-success"
                                title="اعتماد"
                                onClick={() => navigate(`/assignment/${a.id}`)}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {!STATUS_COMPLETE.includes(a.status) && !STATUS_BLOCKED.includes(a.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-warning hover:text-warning"
                                title="طلب مراجعة"
                                onClick={() => navigate(`/assignment/${a.id}`)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {a.status === "approved" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary hover:text-primary"
                                title="إصدار التقرير"
                                onClick={() => navigate(`/reports/generate/${a.id}`)}
                              >
                                <FileOutput className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {assignments.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          لا توجد طلبات حالياً
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {assignments.length > 20 && (
                <div className="p-3 text-center border-t border-border">
                  <Button variant="link" size="sm" onClick={() => navigate("/valuations")}>
                    عرض جميع الطلبات ({assignments.length})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerts Panel */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                تنبيهات ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[450px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-success mb-2" />
                  <p className="text-sm">لا توجد تنبيهات</p>
                </div>
              ) : (
                alerts.slice(0, 15).map((alert, i) => (
                  <button
                    key={`${alert.id}-${i}`}
                    onClick={() => navigate(`/assignment/${alert.id}`)}
                    className="w-full text-right p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {alert.type === "risk" && <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                      {alert.type === "warning" && <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />}
                      {alert.type === "blocked" && <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{alert.ref}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{alert.msg}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
