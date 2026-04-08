import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PIPELINE_PHASES } from "@/lib/workflow-engine";
import { AlertTriangle, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { SAR } from "@/components/ui/saudi-riyal";
import { formatNumber } from "@/lib/utils";

interface PipelineCounts { [status: string]: number; }

export default function OwnerInsightsPanel() {
  const [counts, setCounts] = useState<PipelineCounts>({});
  const [loading, setLoading] = useState(true);
  const [financials, setFinancials] = useState({ revenue: 0, pending: 0 });
  const [performance, setPerformance] = useState({ avgDays: 0, issuedThisMonth: 0, inspectionsCompleted: 0 });
  const [bottlenecks, setBottlenecks] = useState<string[]>([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const { data: assignments } = await supabase
      .from("valuation_assignments")
      .select("status, created_at, updated_at");

    const c: PipelineCounts = {};
    let totalDays = 0, completedCount = 0, issuedThisMonth = 0;
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    (assignments || []).forEach((row) => {
      const s = row.status as string;
      c[s] = (c[s] || 0) + 1;
      if (["issued", "archived"].includes(s)) {
        totalDays += Math.floor((new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / 86400000);
        completedCount++;
        if (new Date(row.updated_at) >= monthStart) issuedThisMonth++;
      }
    });

    setCounts(c);

    const bn: string[] = [];
    Object.entries(c).forEach(([status, count]) => {
      if (count >= 3 && !["issued", "archived", "draft", "cancelled"].includes(status)) bn.push(status);
    });
    setBottlenecks(bn);

    const { count: inspCount } = await supabase.from("inspections").select("id", { count: "exact", head: true }).eq("status", "submitted").gte("updated_at", monthStart.toISOString());
    setPerformance({ avgDays: completedCount > 0 ? Math.round(totalDays / completedCount) : 0, issuedThisMonth, inspectionsCompleted: inspCount || 0 });

    const { data: payments } = await supabase.from("payments").select("amount, payment_status");
    let revenue = 0, pending = 0;
    (payments || []).forEach((p: any) => {
      if (p.payment_status === "paid") revenue += (p.amount || 0);
      else if (p.payment_status === "pending") pending += (p.amount || 0);
    });
    setFinancials({ revenue, pending });
    setLoading(false);
  };

  if (loading) return <Card className="h-48 animate-pulse bg-muted/20" />;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const activePhases = PIPELINE_PHASES.filter(p => p.key !== "finalization");
  const collectionRate = financials.revenue + financials.pending > 0
    ? Math.round((financials.revenue / (financials.revenue + financials.pending)) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Financial Summary */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            الملخص المالي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-muted-foreground">المحصّل</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(financials.revenue)} <SAR /></span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-muted-foreground">معلّق</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatNumber(financials.pending)} <SAR /></span>
          </div>
          {collectionRate > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">نسبة التحصيل</span>
                <span className="text-[10px] font-medium text-foreground">{collectionRate}%</span>
              </div>
              <Progress value={collectionRate} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance KPIs */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            أداء الفريق
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/30 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-foreground">{performance.issuedThisMonth}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">تقرير صادر</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-foreground">{performance.avgDays}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">متوسط الأيام</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-foreground">{performance.inspectionsCompleted}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">معاينة</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              خط سير العمل
            </CardTitle>
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{total}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {activePhases.map((phase) => {
            const phaseCount = phase.statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);
            const pct = total > 0 ? Math.round((phaseCount / total) * 100) : 0;
            const hasBottleneck = phase.statuses.some(s => bottlenecks.includes(s));
            return (
              <div key={phase.key} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-24 shrink-0 truncate">{phase.label}</span>
                <Progress value={pct} className="h-1.5 flex-1" />
                <div className="flex items-center gap-1 w-10 justify-end">
                  {hasBottleneck && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                  <span className="text-[10px] font-medium text-foreground">{phaseCount}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
