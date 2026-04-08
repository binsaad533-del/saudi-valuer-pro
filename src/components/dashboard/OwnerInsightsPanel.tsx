import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  PIPELINE_PHASES,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/workflow-engine";
import { Loader2, AlertTriangle, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { SAR } from "@/components/ui/saudi-riyal";
import { formatNumber } from "@/lib/utils";

interface PipelineCounts {
  [status: string]: number;
}

export default function OwnerInsightsPanel() {
  const [counts, setCounts] = useState<PipelineCounts>({});
  const [loading, setLoading] = useState(true);
  const [financials, setFinancials] = useState({ revenue: 0, pending: 0, overdue: 0 });
  const [performance, setPerformance] = useState({ avgDays: 0, issuedThisMonth: 0, inspectionsCompleted: 0 });
  const [bottlenecks, setBottlenecks] = useState<string[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    // Status counts
    const { data: assignments } = await supabase
      .from("valuation_assignments")
      .select("status, created_at, updated_at");

    const c: PipelineCounts = {};
    const now = Date.now();
    let totalDays = 0;
    let completedCount = 0;
    let issuedThisMonth = 0;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    (assignments || []).forEach((row) => {
      const s = row.status as string;
      c[s] = (c[s] || 0) + 1;

      // Performance: avg completion time for issued/archived
      if (["issued", "archived"].includes(s)) {
        const days = Math.floor((new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / 86400000);
        totalDays += days;
        completedCount++;
        if (new Date(row.updated_at) >= monthStart) issuedThisMonth++;
      }
    });

    setCounts(c);

    // Bottlenecks
    const bn: string[] = [];
    Object.entries(c).forEach(([status, count]) => {
      if (count >= 3 && !["issued", "archived", "draft", "cancelled"].includes(status)) {
        bn.push(status);
      }
    });
    setBottlenecks(bn);

    // Inspections completed this month
    const { count: inspCount } = await supabase
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted")
      .gte("updated_at", monthStart.toISOString());

    setPerformance({
      avgDays: completedCount > 0 ? Math.round(totalDays / completedCount) : 0,
      issuedThisMonth,
      inspectionsCompleted: inspCount || 0,
    });

    // Financials
    const { data: payments } = await supabase
      .from("payments")
      .select("amount, payment_status, payment_stage");

    let revenue = 0, pending = 0;
    (payments || []).forEach((p: any) => {
      if (p.payment_status === "paid") revenue += (p.amount || 0);
      else if (p.payment_status === "pending") pending += (p.amount || 0);
    });

    setFinancials({ revenue, pending, overdue: 0 });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="h-48 animate-pulse bg-muted/20" />
        ))}
      </div>
    );
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const activePhases = PIPELINE_PHASES.filter(p => p.key !== "finalization");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Financial Summary */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            الملخص المالي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">إجمالي المحصّل</span>
            <span className="text-lg font-bold text-success">
              {formatNumber(financials.revenue)} <SAR />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">بانتظار التحصيل</span>
            <span className="text-lg font-bold text-warning">
              {formatNumber(financials.pending)} <SAR />
            </span>
          </div>
          {financials.revenue > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">نسبة التحصيل</span>
                <span className="text-[10px] font-medium text-foreground">
                  {Math.round((financials.revenue / (financials.revenue + financials.pending)) * 100)}%
                </span>
              </div>
              <Progress value={Math.round((financials.revenue / (financials.revenue + financials.pending)) * 100)} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Performance */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            أداء الفريق
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-foreground">{performance.issuedThisMonth}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">تقرير صادر هذا الشهر</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-foreground">{performance.avgDays}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">متوسط أيام الإنجاز</p>
            </div>
          </div>
          <div className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
            <span className="text-xs text-muted-foreground">معاينات مكتملة</span>
            <Badge variant="secondary" className="text-xs">{performance.inspectionsCompleted}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Summary (compact — replaces Kanban) */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-foreground" />
              خط سير العمل
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">{total} إجمالي</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {activePhases.map((phase) => {
            const phaseCount = phase.statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);
            const pct = total > 0 ? Math.round((phaseCount / total) * 100) : 0;
            const hasBottleneck = phase.statuses.some(s => bottlenecks.includes(s));
            return (
              <div key={phase.key} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-28 shrink-0 truncate">{phase.label}</span>
                <Progress value={pct} className="h-1.5 flex-1" />
                <div className="flex items-center gap-1 w-12 justify-end">
                  {hasBottleneck && <AlertTriangle className="w-3 h-3 text-warning" />}
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
