import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/workflow-engine";

interface Insight {
  type: "warning" | "suggestion" | "info";
  text: string;
}

export default function RaqeemExecutiveInsight() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const analyze = async () => {
    setLoading(true);
    try {
      const { data: assignments } = await supabase
        .from("valuation_assignments")
        .select("id, status, updated_at, reference_number")
        .not("status", "in", "(issued,archived,cancelled)")
        .order("updated_at", { ascending: true });

      const items = assignments || [];
      const now = Date.now();
      const threeDaysMs = 3 * 86400000;
      const result: Insight[] = [];

      // Stale detection
      const staleItems = items.filter(a => (now - new Date(a.updated_at).getTime()) > threeDaysMs);
      if (staleItems.length > 0) {
        result.push({ type: "warning", text: `${staleItems.length} ملف متوقف — يُوصى بالتدخل` });
      }

      // Bottleneck detection
      const statusCounts: Record<string, number> = {};
      items.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });
      Object.entries(statusCounts).forEach(([status, count]) => {
        if (count >= 3 && !["draft"].includes(status)) {
          const label = STATUS_LABELS[status]?.ar || status;
          result.push({ type: "warning", text: `تكدس في "${label}" (${count} ملفات)` });
        }
      });

      // Urgent reviews
      const urgentStatuses = ["professional_review", "draft_report_ready"];
      const urgentCount = items.filter(a => urgentStatuses.includes(a.status)).length;
      if (urgentCount > 0) {
        result.push({ type: "suggestion", text: `${urgentCount} ملف جاهز لحكمك المهني أو اعتمادك` });
      }

      // Speed suggestion
      const fastTrack = items.filter(a => a.status === "scope_generated").length;
      if (fastTrack > 0) {
        result.push({ type: "suggestion", text: `${fastTrack} نطاق عمل جاهز — اعتمده لتسريع التنفيذ` });
      }

      if (result.length === 0) {
        result.push({ type: "info", text: "جميع الملفات تسير بانتظام — لا توجد مخاطر حالية" });
      }

      setInsights(result);
    } catch {
      setInsights([{ type: "info", text: "تعذر تحليل البيانات" }]);
    }
    setLoading(false);
  };

  useEffect(() => { analyze(); }, []);

  const typeStyles = {
    warning: "border-r-red-400",
    suggestion: "border-r-amber-400",
    info: "border-r-emerald-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="rounded-xl border border-primary/15 bg-primary/[0.02] p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RaqeemIcon size={16} />
          <span className="text-xs font-bold text-foreground">رقيم التنفيذي</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => analyze()} disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4">
          <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
          <span className="text-[11px] text-muted-foreground">رقيم يحلّل...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + i * 0.05 }}
              className={`border-r-2 ${typeStyles[insight.type]} pr-3 py-1`}
            >
              <p className="text-[11px] text-foreground leading-relaxed">{insight.text}</p>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
