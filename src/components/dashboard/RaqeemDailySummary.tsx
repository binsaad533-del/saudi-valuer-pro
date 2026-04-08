import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { normalizeStatus, STATUS_LABELS } from "@/lib/workflow-engine";

interface DailySummary {
  urgentCount: number;
  staleCount: number;
  newCount: number;
  message: string;
}

export default function RaqeemDailySummary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const generateSummary = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: assignments } = await supabase
        .from("valuation_assignments")
        .select("id, status, updated_at, reference_number")
        .not("status", "in", "(issued,archived,cancelled)")
        .order("updated_at", { ascending: true });

      const now = Date.now();
      const threeDaysMs = 3 * 86400000;
      const items = assignments || [];

      const newItems = items.filter(a => ["submitted", "scope_generated"].includes(a.status));
      const staleItems = items.filter(a => (now - new Date(a.updated_at).getTime()) > threeDaysMs);
      const urgentItems = items.filter(a =>
        ["professional_review", "draft_report_ready", "client_review", "draft_approved"].includes(a.status)
      );

      // Build intelligent message
      const parts: string[] = [];

      if (newItems.length > 0) {
        parts.push(`${newItems.length} طلب جديد بانتظار مراجعتك وإعداد نطاق العمل`);
      }

      if (urgentItems.length > 0) {
        const reviewStatuses = urgentItems.map(a => STATUS_LABELS[a.status]?.ar || a.status);
        const uniqueStatuses = [...new Set(reviewStatuses)];
        parts.push(`${urgentItems.length} ملف في مرحلة حرجة (${uniqueStatuses.join("، ")})`);
      }

      if (staleItems.length > 0) {
        parts.push(`⚠ ${staleItems.length} ملف متوقف أكثر من 3 أيام — يُنصح بمراجعتها`);
      }

      if (parts.length === 0) {
        parts.push("لا توجد مهام عاجلة حالياً — جميع الملفات تسير بانتظام ✓");
      }

      const greeting = new Date().getHours() < 12 ? "صباح الخير" : new Date().getHours() < 18 ? "مساء الخير" : "مساء الخير";

      setSummary({
        urgentCount: urgentItems.length,
        staleCount: staleItems.length,
        newCount: newItems.length,
        message: `${greeting}، إليك ملخص اليوم:\n\n${parts.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
      });
    } catch {
      setSummary({
        urgentCount: 0, staleCount: 0, newCount: 0,
        message: "تعذر تحميل الملخص اليومي",
      });
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { generateSummary(); }, []);

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">رقيم يحلّل البيانات...</span>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            ملخص رقيم اليومي
          </CardTitle>
          <div className="flex items-center gap-2">
            {summary.urgentCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">{summary.urgentCount} عاجل</Badge>
            )}
            {summary.newCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] border-0">{summary.newCount} جديد</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => generateSummary(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-foreground whitespace-pre-line leading-[1.9]">
          {summary.message}
        </div>
      </CardContent>
    </Card>
  );
}
