import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { TrendingUp, Percent, FileText, BarChart3, Loader2 } from "lucide-react";
import { SAR } from "@/components/ui/saudi-riyal";
import { formatNumber } from "@/lib/utils";

interface KPI {
  label: string;
  value: string;
  description: string;
  icon: React.ElementType;
  hasCurrency?: boolean;
}

export default function KPIMetrics() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();

      const [allRes, paidRes, thisMonthRes, lastMonthRes, quarterRes] = await Promise.all([
        supabase.from("invoices").select("total_amount, payment_status"),
        supabase.from("invoices").select("total_amount, paid_at, created_at").eq("payment_status", "paid"),
        supabase.from("invoices").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
        supabase.from("invoices").select("id", { count: "exact", head: true })
          .gte("created_at", startOfLastMonth).lt("created_at", startOfMonth),
        supabase.from("invoices").select("total_amount").eq("payment_status", "paid").gte("paid_at", startOfQuarter),
      ]);

      // Collection rate: paid / (paid + pending + overdue)
      const all = (allRes.data || []) as any[];
      const totalAmount = all.reduce((s, r) => s + (r.total_amount || 0), 0);
      const paidAmount  = all.filter(r => r.payment_status === "paid").reduce((s, r) => s + (r.total_amount || 0), 0);
      const collectionRate = totalAmount > 0 ? ((paidAmount / totalAmount) * 100).toFixed(1) : "0";

      // Average collection days: avg(paid_at - created_at)
      const paid = (paidRes.data || []) as any[];
      let avgDays = "—";
      if (paid.length > 0) {
        const diffs = paid
          .filter(r => r.paid_at && r.created_at)
          .map(r => (new Date(r.paid_at).getTime() - new Date(r.created_at).getTime()) / 86400000);
        if (diffs.length > 0) {
          avgDays = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length) + " يوم";
        }
      }

      // This month vs last month count
      const thisMonthCount = thisMonthRes.count || 0;
      const lastMonthCount = lastMonthRes.count || 0;
      const monthComparison = `${thisMonthCount} / ${lastMonthCount}`;
      const monthTrend = lastMonthCount > 0
        ? `${thisMonthCount >= lastMonthCount ? "+" : ""}${Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)}% عن الشهر الماضي`
        : "لا يوجد مقارنة";

      // Quarter revenue
      const quarterRevenue = ((quarterRes.data || []) as any[]).reduce((s, r) => s + (r.total_amount || 0), 0);
      const quarterLabel = `الربع ${Math.floor(now.getMonth() / 3) + 1} / ${now.getFullYear()}`;

      setKpis([
        { label: "متوسط مدة التحصيل",              value: avgDays,          description: "من تاريخ الإصدار للسداد",  icon: TrendingUp },
        { label: "نسبة التحصيل",                   value: `${collectionRate}%`, description: "من إجمالي قيمة الفواتير", icon: Percent },
        { label: "فواتير هذا الشهر vs السابق",    value: monthComparison,  description: monthTrend,                  icon: FileText },
        { label: "إيرادات الربع الحالي",            value: formatNumber(quarterRevenue), description: quarterLabel, icon: BarChart3, hasCurrency: true },
      ]);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border shadow-card p-5">
        <h3 className="font-semibold text-foreground mb-4">مؤشرات الأداء</h3>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border shadow-card p-5">
      <h3 className="font-semibold text-foreground mb-4">مؤشرات الأداء</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-foreground inline-flex items-center gap-1">
                {kpi.value} {kpi.hasCurrency && <SAR size={16} />}
              </span>
              <span className="text-sm text-muted-foreground mt-1">{kpi.label}</span>
              <span className="text-[11px] text-muted-foreground/70 mt-0.5">{kpi.description}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
