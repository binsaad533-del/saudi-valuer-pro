import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Server, Database, Cpu, Clock, FileWarning, Zap, BarChart3,
  Shield, TrendingUp
} from "lucide-react";

interface HealthCheck {
  id: string;
  check_type: string;
  status: string;
  response_time_ms: number;
  details: Record<string, unknown>;
  checked_at: string;
}

interface SystemEvent {
  id: string;
  event_type: string;
  category: string;
  title: string;
  description: string | null;
  severity: string;
  metadata: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
}

interface Stats {
  active_requests: number;
  completed_reports: number;
  processing_jobs: number;
  today_errors: number;
  unresolved_alerts: number;
  recent_health_checks: HealthCheck[];
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  healthy: { icon: CheckCircle2, color: "text-emerald-500", label: "سليم" },
  degraded: { icon: AlertTriangle, color: "text-amber-500", label: "بطيء" },
  down: { icon: XCircle, color: "text-destructive", label: "متوقف" },
};

const severityColors: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 text-white",
  warning: "bg-amber-500 text-white",
  medium: "bg-yellow-500 text-white",
  low: "bg-blue-500 text-white",
  info: "bg-muted text-muted-foreground",
};

export default function SystemMonitoringPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [healthStatus, setHealthStatus] = useState<{ overall: string; checks: Record<string, { status: string; response_time_ms: number }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const runHealthCheck = useCallback(async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("system-health-check", {
        body: { action: "health_check" },
      });
      if (error) throw error;
      setHealthStatus(data);
      toast.success("تم فحص صحة النظام");
    } catch {
      toast.error("فشل فحص صحة النظام");
    } finally {
      setChecking(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch stats from edge function
      const { data: statsData } = await supabase.functions.invoke("system-health-check", {
        body: { action: "get_stats" },
      });
      if (statsData) setStats(statsData);

      // Fetch recent events directly
      const { data: eventsData } = await supabase
        .from("system_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (eventsData) setEvents(eventsData as unknown as SystemEvent[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    runHealthCheck();
  }, [fetchData, runHealthCheck]);

  const resolveEvent = async (id: string) => {
    await supabase
      .from("system_events")
      .update({ resolved: true, resolved_at: new Date().toISOString() } as any)
      .eq("id", id);
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, resolved: true } : e)));
    toast.success("تم حل المشكلة");
  };

  const overallStatus = healthStatus?.overall || "healthy";
  const sc = statusConfig[overallStatus] || statusConfig.healthy;
  const StatusIcon = sc.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مراقبة النظام</h1>
          <p className="text-sm text-muted-foreground">متابعة صحة النظام والأداء والتنبيهات</p>
        </div>
        <Button onClick={() => { runHealthCheck(); fetchData(); }} disabled={checking} size="sm">
          <RefreshCw className={`w-4 h-4 me-1.5 ${checking ? "animate-spin" : ""}`} />
          فحص الآن
        </Button>
      </div>

      {/* Overall Status Banner */}
      <Card className={`border-2 ${overallStatus === "healthy" ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" : overallStatus === "degraded" ? "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20" : "border-destructive/30 bg-destructive/5"}`}>
        <CardContent className="flex items-center gap-4 py-4">
          <StatusIcon className={`w-10 h-10 ${sc.color}`} />
          <div>
            <p className="text-lg font-bold text-foreground">حالة النظام: {sc.label}</p>
            <p className="text-sm text-muted-foreground">
              آخر فحص: {healthStatus ? new Date(healthStatus.checks?.database ? Date.now() : 0).toLocaleTimeString("ar-SA") : "—"}
            </p>
          </div>
          {healthStatus?.checks && (
            <div className="flex gap-6 ms-auto">
              {Object.entries(healthStatus.checks).map(([key, val]) => (
                <div key={key} className="text-center">
                  <p className="text-xs text-muted-foreground">{key === "database" ? "قاعدة البيانات" : "واجهة API"}</p>
                  <p className={`text-sm font-bold ${statusConfig[val.status]?.color || "text-foreground"}`}>{val.response_time_ms}ms</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "طلبات نشطة", value: stats?.active_requests ?? 0, icon: Activity, color: "text-blue-500" },
          { label: "تقارير مكتملة", value: stats?.completed_reports ?? 0, icon: FileWarning, color: "text-emerald-500" },
          { label: "معالجات جارية", value: stats?.processing_jobs ?? 0, icon: Cpu, color: "text-amber-500" },
          { label: "أخطاء اليوم", value: stats?.today_errors ?? 0, icon: AlertTriangle, color: stats?.today_errors ? "text-destructive" : "text-muted-foreground" },
          { label: "تنبيهات معلقة", value: stats?.unresolved_alerts ?? 0, icon: Shield, color: stats?.unresolved_alerts ? "text-orange-500" : "text-muted-foreground" },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3 text-center">
              <s.icon className={`w-6 h-6 mx-auto mb-1.5 ${s.color}`} />
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="health" dir="rtl">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="health"><Server className="w-3.5 h-3.5 me-1" />الصحة</TabsTrigger>
          <TabsTrigger value="errors"><AlertTriangle className="w-3.5 h-3.5 me-1" />الأخطاء</TabsTrigger>
          <TabsTrigger value="performance"><TrendingUp className="w-3.5 h-3.5 me-1" />الأداء</TabsTrigger>
          <TabsTrigger value="operations"><BarChart3 className="w-3.5 h-3.5 me-1" />العمليات</TabsTrigger>
        </TabsList>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">سجل فحوصات الصحة</CardTitle></CardHeader>
            <CardContent>
              {stats?.recent_health_checks?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>النوع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>وقت الاستجابة</TableHead>
                      <TableHead>الوقت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recent_health_checks.map((hc) => {
                      const hsc = statusConfig[hc.status] || statusConfig.healthy;
                      const HIcon = hsc.icon;
                      return (
                        <TableRow key={hc.id}>
                          <TableCell className="font-medium">{hc.check_type === "database" ? "قاعدة البيانات" : hc.check_type === "api" ? "واجهة API" : hc.check_type}</TableCell>
                          <TableCell><span className={`flex items-center gap-1 ${hsc.color}`}><HIcon className="w-3.5 h-3.5" />{hsc.label}</span></TableCell>
                          <TableCell>{hc.response_time_ms}ms</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{new Date(hc.checked_at).toLocaleString("ar-SA")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد فحوصات مسجلة</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">سجل الأخطاء والتنبيهات</CardTitle></CardHeader>
            <CardContent>
              {events.filter((e) => ["error", "alert"].includes(e.event_type)).length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الخطورة</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>الفئة</TableHead>
                      <TableHead>الوقت</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events
                      .filter((e) => ["error", "alert"].includes(e.event_type))
                      .map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell><Badge className={severityColors[ev.severity] || severityColors.info}>{ev.severity}</Badge></TableCell>
                          <TableCell className="font-medium">{ev.title}</TableCell>
                          <TableCell className="text-muted-foreground">{ev.category}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString("ar-SA")}</TableCell>
                          <TableCell>{ev.resolved ? <Badge variant="secondary">محلول</Badge> : <Badge variant="destructive">مفتوح</Badge>}</TableCell>
                          <TableCell>
                            {!ev.resolved && (
                              <Button size="sm" variant="outline" onClick={() => resolveEvent(ev.id)}>حل</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد أخطاء مسجلة ✓</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" />أداء قاعدة البيانات</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {healthStatus?.checks?.database ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">وقت الاستجابة</span>
                      <span className="font-bold">{healthStatus.checks.database.response_time_ms}ms</span>
                    </div>
                    <Progress value={Math.min(100, (healthStatus.checks.database.response_time_ms / 2000) * 100)} />
                    <p className="text-xs text-muted-foreground">المعيار: أقل من 200ms ممتاز، أقل من 2000ms مقبول</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">اضغط "فحص الآن" لقياس الأداء</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" />أداء واجهة API</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {healthStatus?.checks?.api ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">وقت الاستجابة</span>
                      <span className="font-bold">{healthStatus.checks.api.response_time_ms}ms</span>
                    </div>
                    <Progress value={Math.min(100, (healthStatus.checks.api.response_time_ms / 1000) * 100)} />
                    <p className="text-xs text-muted-foreground">استجابة وظائف الحافة</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">اضغط "فحص الآن" لقياس الأداء</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Operations Tab */}
        <TabsContent value="operations" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-3xl font-bold text-foreground">{stats?.active_requests ?? 0}</p>
                <p className="text-sm text-muted-foreground">طلبات تقييم نشطة</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-3xl font-bold text-foreground">{stats?.completed_reports ?? 0}</p>
                <p className="text-sm text-muted-foreground">تقارير مكتملة</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-3xl font-bold text-foreground">{stats?.processing_jobs ?? 0}</p>
                <p className="text-sm text-muted-foreground">معالجات جارية</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent all events */}
          <Card>
            <CardHeader><CardTitle className="text-base">سجل الأحداث</CardTitle></CardHeader>
            <CardContent>
              {events.length ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {events.slice(0, 20).map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <Badge className={`${severityColors[ev.severity] || severityColors.info} shrink-0 mt-0.5`}>{ev.severity}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{ev.title}</p>
                        {ev.description && <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(ev.created_at).toLocaleString("ar-SA")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد أحداث مسجلة</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
