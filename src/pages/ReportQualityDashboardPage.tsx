import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown, CheckCircle, XCircle, BarChart3, Users, FileWarning } from "lucide-react";
import { getGrade, IVS_STANDARDS } from "@/lib/ivs-quality-standards";
import { format, subDays, startOfDay } from "date-fns";

type Period = "7d" | "30d" | "90d" | "all";

export default function ReportQualityDashboardPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [valuationType, setValuationType] = useState<string>("all");

  const dateFrom = useMemo(() => {
    if (period === "all") return null;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    return startOfDay(subDays(new Date(), days)).toISOString();
  }, [period]);

  // Fetch quality scores with assignment data
  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["quality-dashboard", period, valuationType],
    queryFn: async () => {
      let query = supabase
        .from("report_quality_scores")
        .select("*, valuation_assignments!inner(id, valuation_type, property_type, created_by, reference_number, status)")
        .order("created_at", { ascending: false });

      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }
      if (valuationType !== "all") {
        query = query.eq("valuation_assignments.valuation_type", valuationType as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch profiles for valuator names
  const valuatorIds = useMemo(() => {
    const ids = new Set<string>();
    scores.forEach((s: any) => {
      if (s.scored_by) ids.add(s.scored_by);
      if (s.valuation_assignments?.created_by) ids.add(s.valuation_assignments.created_by);
    });
    return Array.from(ids);
  }, [scores]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["quality-profiles", valuatorIds],
    queryFn: async () => {
      if (!valuatorIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name_ar")
        .in("user_id", valuatorIds);
      return data || [];
    },
    enabled: valuatorIds.length > 0,
  });

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach((p: any) => { m[p.user_id] = p.full_name_ar || "غير معروف"; });
    return m;
  }, [profiles]);

  // Computed metrics
  const metrics = useMemo(() => {
    if (!scores.length) return null;

    const totalScores = scores.map((s: any) => s.score as number);
    const avg = Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length);
    const rejected = scores.filter((s: any) => s.score < 70).length;
    const excellent = scores.filter((s: any) => s.score >= 90).length;
    const canIssue = scores.filter((s: any) => s.can_issue).length;

    // Common failures by standard
    const standardFailures: Record<string, number> = {};
    scores.forEach((s: any) => {
      if (s.standard_breakdown && typeof s.standard_breakdown === "object") {
        const breakdown = s.standard_breakdown as Record<string, any>;
        Object.entries(breakdown).forEach(([code, data]: [string, any]) => {
          if (data && typeof data === "object" && data.score !== undefined && data.score < 70) {
            standardFailures[code] = (standardFailures[code] || 0) + 1;
          }
        });
      }
    });

    const topFailures = Object.entries(standardFailures)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code, count]) => {
        const std = IVS_STANDARDS.find(s => s.code === code);
        return { code, title_ar: std?.title_ar || code, count, pct: Math.round((count / scores.length) * 100) };
      });

    // Per-valuator performance
    const valuatorScores: Record<string, number[]> = {};
    scores.forEach((s: any) => {
      const uid = s.valuation_assignments?.created_by || s.scored_by;
      if (uid) {
        if (!valuatorScores[uid]) valuatorScores[uid] = [];
        valuatorScores[uid].push(s.score);
      }
    });

    const valuatorPerformance = Object.entries(valuatorScores)
      .map(([uid, sc]) => ({
        uid,
        name: profileMap[uid] || "غير معروف",
        avg: Math.round(sc.reduce((a, b) => a + b, 0) / sc.length),
        count: sc.length,
        rejected: sc.filter(v => v < 70).length,
        excellent: sc.filter(v => v >= 90).length,
      }))
      .sort((a, b) => b.avg - a.avg);

    // Grade distribution
    const gradeDistribution = [
      { name: "ممتاز", value: excellent, color: "hsl(var(--chart-2))" },
      { name: "جيد جداً", value: scores.filter((s: any) => s.score >= 80 && s.score < 90).length, color: "hsl(var(--chart-1))" },
      { name: "مقبول", value: scores.filter((s: any) => s.score >= 70 && s.score < 80).length, color: "hsl(var(--chart-4))" },
      { name: "مرفوض", value: rejected, color: "hsl(var(--chart-5))" },
    ].filter(d => d.value > 0);

    // Trend data (group by day)
    const trendMap: Record<string, { total: number; count: number }> = {};
    scores.forEach((s: any) => {
      const day = format(new Date(s.created_at), "MM/dd");
      if (!trendMap[day]) trendMap[day] = { total: 0, count: 0 };
      trendMap[day].total += s.score;
      trendMap[day].count++;
    });
    const trend = Object.entries(trendMap)
      .map(([day, d]) => ({ day, avg: Math.round(d.total / d.count) }))
      .reverse();

    return { avg, rejected, excellent, canIssue, total: scores.length, topFailures, valuatorPerformance, gradeDistribution, trend };
  }, [scores, profileMap]);

  const grade = metrics ? getGrade(metrics.avg) : null;

  return (
    <div className="space-y-6 p-1" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مراقبة جودة التقارير</h1>
          <p className="text-sm text-muted-foreground mt-1">تحليل شامل لمستوى جودة التقارير وأداء المقيمين</p>
        </div>
        <div className="flex gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">آخر 7 أيام</SelectItem>
              <SelectItem value="30d">آخر 30 يوم</SelectItem>
              <SelectItem value="90d">آخر 90 يوم</SelectItem>
              <SelectItem value="all">الكل</SelectItem>
            </SelectContent>
          </Select>
          <Select value={valuationType} onValueChange={setValuationType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأنواع</SelectItem>
              <SelectItem value="real_estate">عقاري</SelectItem>
              <SelectItem value="equipment">معدات</SelectItem>
              <SelectItem value="business">منشآت</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">جاري التحميل...</div>
      ) : !metrics || metrics.total === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد بيانات جودة للفترة المحددة</CardContent></Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">متوسط الجودة</p>
                    <p className={`text-3xl font-bold mt-1 ${grade?.color}`}>{metrics.avg}%</p>
                    <Badge variant="outline" className={`mt-2 ${grade?.color}`}>{grade?.label_ar}</Badge>
                  </div>
                  <div className={`p-3 rounded-full ${metrics.avg >= 80 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {metrics.avg >= 80 ? <TrendingUp className="h-6 w-6 text-green-600" /> : <TrendingDown className="h-6 w-6 text-red-600" />}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي التقارير</p>
                    <p className="text-3xl font-bold mt-1 text-foreground">{metrics.total}</p>
                    <p className="text-xs text-muted-foreground mt-2">{metrics.canIssue} قابل للإصدار</p>
                  </div>
                  <div className="p-3 rounded-full bg-primary/10">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">تقارير مرفوضة</p>
                    <p className="text-3xl font-bold mt-1 text-destructive">{metrics.rejected}</p>
                    <p className="text-xs text-muted-foreground mt-2">{Math.round((metrics.rejected / metrics.total) * 100)}% من الإجمالي</p>
                  </div>
                  <div className="p-3 rounded-full bg-destructive/10">
                    <XCircle className="h-6 w-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">تقارير ممتازة</p>
                    <p className="text-3xl font-bold mt-1 text-green-600">{metrics.excellent}</p>
                    <p className="text-xs text-muted-foreground mt-2">{Math.round((metrics.excellent / metrics.total) * 100)}% من الإجمالي</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-500/10">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">اتجاه جودة التقارير</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.trend.length > 1 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={metrics.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" fontSize={12} />
                      <YAxis domain={[0, 100]} fontSize={12} />
                      <Tooltip formatter={(v: number) => [`${v}%`, "المتوسط"]} />
                      <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">بيانات غير كافية لعرض الاتجاه</div>
                )}
              </CardContent>
            </Card>

            {/* Grade Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">توزيع التصنيفات</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={metrics.gradeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {metrics.gradeDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Failures */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileWarning className="h-4 w-4 text-destructive" />
                  أكثر المعايير فشلاً
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics.topFailures.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">لا توجد إخفاقات</p>
                ) : (
                  metrics.topFailures.map((f) => (
                    <div key={f.code} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{f.code} — {f.title_ar}</span>
                        <span className="text-destructive font-semibold">{f.count} ({f.pct}%)</span>
                      </div>
                      <Progress value={f.pct} className="h-2 [&>div]:bg-destructive" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Valuator Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  أداء المقيمين
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.valuatorPerformance.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات</p>
                ) : (
                  <div className="space-y-3">
                    {metrics.valuatorPerformance.map((v) => {
                      const vGrade = getGrade(v.avg);
                      return (
                        <div key={v.uid} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{v.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{v.count} تقرير</p>
                          </div>
                          <div className="text-center px-3">
                            <p className={`text-lg font-bold ${vGrade.color}`}>{v.avg}%</p>
                            <p className={`text-[10px] ${vGrade.color}`}>{vGrade.label_ar}</p>
                          </div>
                          <div className="flex gap-2 text-xs">
                            {v.excellent > 0 && (
                              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">{v.excellent} ممتاز</Badge>
                            )}
                            {v.rejected > 0 && (
                              <Badge variant="destructive" className="text-xs">{v.rejected} مرفوض</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
