import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  PIPELINE_PHASES,
  STATUS_LABELS,
  STATUS_COLORS,
  WORKFLOW_STATUSES,
  getStatusIndex,
} from "@/lib/workflow-engine";
import { Loader2, AlertTriangle } from "lucide-react";

interface PipelineCounts {
  [status: string]: number;
}

export default function WorkflowPipeline() {
  const [counts, setCounts] = useState<PipelineCounts>({});
  const [loading, setLoading] = useState(true);
  const [totalActive, setTotalActive] = useState(0);
  const [bottlenecks, setBottlenecks] = useState<string[]>([]);

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    const { data } = await supabase
      .from("valuation_assignments")
      .select("status");

    if (!data) { setLoading(false); return; }

    const c: PipelineCounts = {};
    data.forEach((row) => {
      const s = row.status as string;
      c[s] = (c[s] || 0) + 1;
    });

    setCounts(c);
    setTotalActive(data.filter(r => !["closed", "archived", "rejected"].includes(r.status as string)).length);

    // Detect bottlenecks (statuses with >3 items stuck)
    const bn: string[] = [];
    Object.entries(c).forEach(([status, count]) => {
      if (count >= 3 && !["closed", "archived", "draft"].includes(status)) {
        bn.push(status);
      }
    });
    setBottlenecks(bn);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">خط سير العمل</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {totalActive} طلب نشط
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phase bars */}
        <div className="space-y-3">
          {PIPELINE_PHASES.map((phase) => {
            const phaseCount = phase.statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);
            const pct = total > 0 ? Math.round((phaseCount / total) * 100) : 0;
            return (
              <div key={phase.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">{phase.label}</span>
                  <span className="text-xs text-muted-foreground">{phaseCount} ({pct}%)</span>
                </div>
                <Progress value={pct} className="h-2" />
                {/* Detail badges */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {phase.statuses.map((s) => {
                    const n = counts[s] || 0;
                    if (n === 0) return null;
                    return (
                      <span
                        key={s}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[s] || "bg-muted text-muted-foreground"}`}
                      >
                        {STATUS_LABELS[s]?.ar || s}: {n}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottleneck alerts */}
        {bottlenecks.length > 0 && (
          <div className="bg-warning/10 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-warning">
              <AlertTriangle className="w-4 h-4" />
              نقاط اختناق محتملة
            </div>
            {bottlenecks.map((s) => (
              <div key={s} className="text-xs text-muted-foreground">
                • {STATUS_LABELS[s]?.ar}: {counts[s]} طلبات متراكمة
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
