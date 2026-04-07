import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Clock, CheckCircle2, AlertTriangle, Users, MapPin, BarChart3, Loader2, Eye, ArrowLeft,
} from "lucide-react";
import saudiRiyalIcon from "@/assets/saudi-riyal.png";
import TopBar from "@/components/layout/TopBar";
import StatCard from "@/components/dashboard/StatCard";
import QuickActions from "@/components/dashboard/QuickActions";
import ActivityTimeline from "@/components/dashboard/ActivityTimeline";
import WorkflowPipeline from "@/components/dashboard/WorkflowPipeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/workflow/StatusComponents";

const PURPOSE_MAP: Record<string, string> = {
  sale_purchase: "بيع / شراء", mortgage: "تمويل / رهن", financial_reporting: "تقارير مالية",
  insurance: "تأمين", taxation: "زكاة / ضريبة", expropriation: "نزع ملكية",
  litigation: "نزاع / قضاء", investment: "استثمار", lease_renewal: "تجديد إيجار",
  internal_decision: "قرار داخلي", regulatory: "تنظيمي", other: "أخرى",
};

export default function Dashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, clients: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [reqRes, clientRes] = await Promise.all([
        supabase.from("valuation_requests" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      const reqs = (reqRes.data as any[]) || [];
      setRequests(reqs);

      const completed = reqs.filter(r => ["completed", "final_report_ready"].includes(r.status)).length;
      const active = reqs.filter(r => !["completed", "final_report_ready", "cancelled", "draft"].includes(r.status)).length;

      setStats({
        total: reqs.length,
        active,
        completed,
        clients: clientRes.count || 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const recentRequests = requests.slice(0, 6);

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            index={0}
            title="إجمالي الطلبات"
            value={loading ? "..." : stats.total}
            subtitle="جميع الطلبات"
            icon={<FileText className="w-5 h-5" />}
            variant="primary"
            href="/client-requests"
          />
          <StatCard
            index={1}
            title="قيد التنفيذ"
            value={loading ? "..." : stats.active}
            subtitle="طلب نشط"
            icon={<Clock className="w-5 h-5" />}
            variant="warning"
            href="/client-requests"
          />
          <StatCard
            index={2}
            title="مكتملة"
            value={loading ? "..." : stats.completed}
            subtitle="تقرير جاهز"
            icon={<CheckCircle2 className="w-5 h-5" />}
            variant="accent"
            href="/client-requests"
          />
          <StatCard
            index={3}
            title="العملاء النشطين"
            value={loading ? "..." : stats.clients}
            subtitle="عميل مسجّل"
            icon={<Users className="w-5 h-5" />}
            variant="default"
            href="/clients-management"
          />
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Workflow Pipeline */}
        <WorkflowPipeline />

        {/* Recent Requests from DB */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                آخر الطلبات الواردة
              </CardTitle>
              <Link to="/client-requests">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  عرض الكل <ArrowLeft className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد طلبات بعد</p>
            ) : (
              <div className="space-y-2">
                {recentRequests.map((req: any) => (
                  <Link
                    key={req.id}
                    to={`/client-requests`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {req.ai_intake_summary?.clientInfo?.contactName || req.client_name_ar || "طلب جديد"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {PURPOSE_MAP[req.purpose] || req.purpose || "—"} · {formatDate(req.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {req.ai_intake_summary?.valuation_mode === "desktop" && (
                        <Badge variant="outline" className="text-[10px]">مكتبي</Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {req.status === "submitted" ? "جديد" : req.status === "completed" ? "مكتمل" : req.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3">
            <ActivityTimeline />
          </div>
        </div>
      </div>
    </div>
  );
}
