import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatNumber } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const MONTH_LABELS: Record<number, string> = {
  1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل", 5: "مايو", 6: "يونيو",
  7: "يوليو", 8: "أغسطس", 9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر",
};

interface MonthPoint { month: string; revenue: number }

export default function RevenueChart() {
  const [data, setData] = useState<MonthPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Fetch paid invoices from the last 12 months
      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1);

      const { data: invoices } = await supabase
        .from("invoices")
        .select("total_amount, paid_at, created_at")
        .eq("payment_status", "paid")
        .gte("created_at", since.toISOString());

      // Group by month
      const map = new Map<string, number>();

      // Seed last 12 months with 0
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        map.set(key, 0);
      }

      (invoices || []).forEach((inv: any) => {
        const date = new Date(inv.paid_at || inv.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        map.set(key, (map.get(key) || 0) + (inv.total_amount || 0));
      });

      const points: MonthPoint[] = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, revenue]) => ({
          month: MONTH_LABELS[parseInt(key.split("-")[1])] || key,
          revenue,
        }));

      setData(points);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="bg-card rounded-lg border border-border shadow-card p-5">
      <h3 className="font-semibold text-foreground mb-4">الإيرادات الشهرية (آخر 12 شهر)</h3>
      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="h-[300px]" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => v === 0 ? "0" : `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [`${formatNumber(value)} ر.س`, "الإيرادات"]}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", direction: "rtl" }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
