import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, TrendingUp, Users, MapPin, Clock, FileText,
  DollarSign, Target, AlertTriangle, CheckCircle, Loader2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { SAR } from "@/components/ui/saudi-riyal";

const COLORS = [
  "hsl(212, 60%, 50%)",
  "hsl(38, 90%, 50%)",
  "hsl(152, 55%, 44%)",
  "hsl(280, 50%, 50%)",
  "hsl(0, 72%, 51%)",
];

interface AnalyticsData {
  totalAssignments: number;
  completedAssignments: number;
  avgCompletionDays: number;
  totalRevenue: number;
  statusDistribution: { name: string; value: number }[];
  monthlyTrend: { month: string; count: number; revenue: number }[];
  cityDistribution: { name: string; value: number }[];
  inspectorPerformance: { name: string; completed: number; avgDays: number; rating: number }[];
  slaCompliance: number;
  overdueTasks: number;
}

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [assignmentsRes, paymentsRes, inspectorsRes] = await Promise.all([
        supabase.from("valuation_assignments").select("id, status, created_at, updated_at, sla_total_days, sla_status, property_type, assigned_inspector_id"),
        supabase.from("payments").select("amount, payment_status, created_at, paid_at"),
        supabase.from("inspector_profiles").select("user_id, total_completed, avg_rating, avg_completion_hours")
          .eq("is_active", true).limit(20),
      ]);

      const assignments = assignmentsRes.data || [];
      const payments = paymentsRes.data || [];
      const inspectors = inspectorsRes.data || [];

      // Status distribution
      const statusMap: Record<string, number> = {};
      assignments.forEach(a => {
        const s = a.status || "unknown";
        statusMap[s] = (statusMap[s] || 0) + 1;
      });
      const statusLabels: Record<string, string> = {
        new: "جديد", assigned: "مُسند", in_progress: "قيد التنفيذ",
        inspection: "معاينة", review: "مراجعة", approved: "معتمد",
        completed: "مكتمل", cancelled: "ملغي",
      };
      const statusDistribution = Object.entries(statusMap).map(([k, v]) => ({
        name: statusLabels[k] || k, value: v,
      }));

      // Monthly trend (last 6 months)
      const monthlyMap: Record<string, { count: number; revenue: number }> = {};
      const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap[key] = { count: 0, revenue: 0 };
      }
      assignments.forEach(a => {
        const key = a.created_at?.substring(0, 7);
        if (key && monthlyMap[key]) monthlyMap[key].count++;
      });
      payments.filter(p => p.payment_status === "paid").forEach(p => {
        const key = (p.paid_at || p.created_at)?.substring(0, 7);
        if (key && monthlyMap[key]) monthlyMap[key].revenue += p.amount;
      });
      const monthlyTrend = Object.entries(monthlyMap).map(([k, v]) => {
        const [, m] = k.split("-");
        return { month: monthNames[parseInt(m) - 1], ...v };
      });

      // Property type distribution (instead of city)
      const propMap: Record<string, number> = {};
      const propLabels: Record<string, string> = {
        residential: "سكني", commercial: "تجاري", land: "أراضي",
        industrial: "صناعي", agricultural: "زراعي", mixed_use: "متعدد",
      };
      assignments.forEach(a => {
        const c = propLabels[a.property_type] || a.property_type || "غير محدد";
        propMap[c] = (propMap[c] || 0) + 1;
      });
      const cityDistribution = Object.entries(propMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }));

      // Inspector performance
      const inspectorPerformance = inspectors.slice(0, 8).map((ip, i) => ({
        name: `معاين ${i + 1}`,
        completed: ip.total_completed || 0,
        avgDays: Math.round((ip.avg_completion_hours || 48) / 24),
        rating: ip.avg_rating || 0,
      }));

      // Totals
      const completedAssignments = assignments.filter(a => a.status === "closed" || a.status === "report_issued").length;
      const totalRevenue = payments
        .filter(p => p.payment_status === "paid")
        .reduce((sum, p) => sum + p.amount, 0);

      const completionDays = assignments
        .filter(a => (a.status === "closed" || a.status === "report_issued") && a.created_at && a.updated_at)
        .map(a => (new Date(a.updated_at!).getTime() - new Date(a.created_at!).getTime()) / (1000 * 60 * 60 * 24));
      const avgCompletionDays = completionDays.length > 0
        ? Math.round(completionDays.reduce((a, b) => a + b, 0) / completionDays.length)
        : 0;

      const slaCompliance = assignments.length > 0
        ? Math.round(assignments.filter(a => a.sla_status !== "overdue").length / assignments.length * 100)
        : 100;
      const overdueTasks = assignments.filter(a => a.sla_status === "overdue").length;

      setData({
        totalAssignments: assignments.length,
        completedAssignments,
        avgCompletionDays,
        totalRevenue,
        statusDistribution,
        monthlyTrend,
        cityDistribution,
        inspectorPerformance,
        slaCompliance,
        overdueTasks,
      });
    } catch (err) {
      console.error("Analytics load error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    { label: "إجمالي المهام", value: data.totalAssignments, icon: FileText, color: "text-primary" },
    { label: "مهام مكتملة", value: data.completedAssignments, icon: CheckCircle, color: "text-success" },
    { label: "متوسط الإنجاز (يوم)", value: data.avgCompletionDays, icon: Clock, color: "text-warning" },
    { label: "الإيرادات", value: data.totalRevenue.toLocaleString(), icon: DollarSign, color: "text-primary", hasCurrency: true },
    { label: "التزام SLA", value: `${data.slaCompliance}%`, icon: Target, color: data.slaCompliance >= 80 ? "text-success" : "text-destructive" },
    { label: "مهام متأخرة", value: data.overdueTasks, icon: AlertTriangle, color: data.overdueTasks > 0 ? "text-destructive" : "text-success" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          التحليلات والتقارير الإدارية
        </h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة شاملة على أداء المنصة والعمليات</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4 text-center">
              <kpi.icon className={`h-5 w-5 mx-auto mb-2 ${kpi.color}`} />
              <p className="text-2xl font-bold text-foreground inline-flex items-center justify-center gap-1">{kpi.value} {(kpi as any).hasCurrency && <SAR size={16} />}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" dir="rtl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="performance">أداء المعاينين</TabsTrigger>
          <TabsTrigger value="geography">التوزيع الجغرافي</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Monthly Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  الاتجاه الشهري
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" name="عدد المهام" stroke="hsl(212, 60%, 50%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="revenue" name="الإيرادات" stroke="hsl(152, 55%, 44%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  توزيع الحالات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data.statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                      {data.statusDistribution.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                أداء المعاينين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data.inspectorPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis dataKey="name" type="category" fontSize={11} width={70} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name="مهام مكتملة" fill="hsl(212, 60%, 50%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="avgDays" name="متوسط الأيام" fill="hsl(38, 90%, 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Ratings table */}
              <div className="mt-4 border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-right font-medium text-muted-foreground">المعاين</th>
                      <th className="p-2 text-center font-medium text-muted-foreground">مكتمل</th>
                      <th className="p-2 text-center font-medium text-muted-foreground">متوسط (يوم)</th>
                      <th className="p-2 text-center font-medium text-muted-foreground">التقييم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.inspectorPerformance.map((ip, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2 font-medium">{ip.name}</td>
                        <td className="p-2 text-center">{ip.completed}</td>
                        <td className="p-2 text-center">{ip.avgDays}</td>
                        <td className="p-2 text-center">
                          <Badge variant={ip.rating >= 4 ? "default" : ip.rating >= 3 ? "secondary" : "destructive"}>
                            {ip.rating.toFixed(1)} ⭐
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geography" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                توزيع المهام حسب نوع العقار
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data.cityDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" name="عدد المهام" fill="hsl(212, 60%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                {data.cityDistribution.map((city, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                    <span className="text-sm font-medium">{city.name}</span>
                    <Badge variant="secondary">{city.value} مهمة</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
