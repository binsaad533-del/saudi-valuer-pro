import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp, Clock, AlertTriangle, CheckCircle2, DollarSign, Bell } from "lucide-react";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import ReactMarkdown from "react-markdown";

interface SummaryStats {
  totalActive?: number;
  needsAction?: number;
  stale?: number;
  todayNew?: number;
  weekCompleted?: number;
  pendingRevenue?: number;
  unreadNotifications?: number;
  pendingInspections?: number;
  overdueInspections?: number;
  activeRequests?: number;
  pendingInvoices?: number;
  totalPending?: number;
  totalCollectedThisWeek?: number;
  overdueInvoices?: number;
}

interface DailySummaryData {
  role: string;
  greeting: string;
  date: string;
  stats: SummaryStats;
  insights: string[];
  message: string;
  isAiGenerated: boolean;
  generatedAt: string;
}

const STAT_CARDS: { key: keyof SummaryStats; label: string; icon: React.ElementType; color: string; show: (role: string) => boolean }[] = [
  { key: "needsAction", label: "بانتظارك", icon: Bell, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400", show: (r) => r === "owner" },
  { key: "stale", label: "متوقف +3 أيام", icon: AlertTriangle, color: "text-destructive bg-destructive/10", show: (r) => r === "owner" },
  { key: "totalActive", label: "نشط", icon: TrendingUp, color: "text-primary bg-primary/10", show: (r) => r === "owner" },
  { key: "weekCompleted", label: "مكتمل (أسبوع)", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400", show: (r) => r === "owner" },
  { key: "pendingRevenue", label: "مستحقات معلقة", icon: DollarSign, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400", show: (r) => r === "owner" || r === "financial_manager" },
  { key: "pendingInspections", label: "معاينات قادمة", icon: Clock, color: "text-primary bg-primary/10", show: (r) => r === "inspector" },
  { key: "overdueInspections", label: "معاينات متأخرة", icon: AlertTriangle, color: "text-destructive bg-destructive/10", show: (r) => r === "inspector" },
  { key: "overdueInvoices", label: "فواتير متأخرة", icon: AlertTriangle, color: "text-destructive bg-destructive/10", show: (r) => r === "financial_manager" },
];

export default function RaqeemDailySummary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DailySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("raqeem-daily-summary", {
        body: {},
      });

      if (error) throw error;

      if (data?.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch daily summary:", err);
      // Fallback to local generation
      await generateLocalSummary();
    }

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  const generateLocalSummary = async () => {
    try {
      const { data: assignments } = await supabase
        .from("valuation_assignments")
        .select("id, status, updated_at")
        .not("status", "in", "(issued,archived,cancelled)")
        .order("updated_at", { ascending: true });

      const items = assignments || [];
      const now = Date.now();
      const threeDays = 3 * 86400000;

      const stale = items.filter(a => (now - new Date(a.updated_at).getTime()) > threeDays).length;
      const needsAction = items.filter(a => ["professional_review", "draft_report_ready", "scope_generated"].includes(a.status)).length;

      const greeting = new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير";
      const insights: string[] = [];

      if (needsAction > 0) insights.push(`${needsAction} ملف بانتظار قرارك`);
      if (stale > 0) insights.push(`${stale} ملف متوقف أكثر من 3 أيام`);
      if (insights.length === 0) insights.push("لا توجد مهام عاجلة — جميع الملفات تسير بانتظام");

      setSummary({
        role: "owner",
        greeting,
        date: new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
        stats: { totalActive: items.length, needsAction, stale },
        insights,
        message: `${greeting}، إليك ملخص اليوم:\n\n${insights.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
        isAiGenerated: false,
        generatedAt: new Date().toISOString(),
      });
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  if (loading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">رقيم يحلّل البيانات...</span>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const visibleStats = STAT_CARDS.filter(s => s.show(summary.role) && summary.stats[s.key] !== undefined);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <RaqeemIcon size={18} />
            ملخص رقيم اليومي
            {summary.isAiGenerated && (
              <Badge variant="outline" className="text-[9px] font-normal border-primary/30 text-primary">
                AI
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {(summary.stats.needsAction || 0) > 0 && (
              <Badge variant="destructive" className="text-[10px]">{summary.stats.needsAction} عاجل</Badge>
            )}
            {(summary.stats.todayNew || 0) > 0 && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] border-0">
                {summary.stats.todayNew} جديد
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => fetchSummary(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{summary.date}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        {visibleStats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visibleStats.map(stat => {
              const value = summary.stats[stat.key];
              if (value === 0 && stat.key !== "totalActive") return null;
              const Icon = stat.icon;
              const displayValue = stat.key === "pendingRevenue" || stat.key === "totalPending" || stat.key === "totalCollectedThisWeek"
                ? `${(value || 0).toLocaleString()} ر.س`
                : value;
              return (
                <div key={stat.key} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium ${stat.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{displayValue}</span>
                  <span className="opacity-70">{stat.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* AI Summary Message */}
        <div className="text-sm text-foreground leading-[1.9] prose prose-sm max-w-none dark:prose-invert prose-p:my-1">
          <ReactMarkdown>{summary.message}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
