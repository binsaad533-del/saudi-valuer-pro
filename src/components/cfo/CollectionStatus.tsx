import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";

const STATUS_COLORS: Record<string, string> = {
  paid:    "hsl(var(--success))",
  pending: "hsl(var(--warning))",
  overdue: "hsl(var(--destructive))",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "مدفوعة", pending: "معلقة", overdue: "متأخرة",
};

interface Slice { status: string; label: string; amount: number; percentage: string }

export default function CollectionStatus() {
  const [data, setData] = useState<Slice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("total_amount, payment_status")
        .in("payment_status", ["paid", "pending", "overdue"]);

      const grouped: Record<string, number> = {};
      (invoices || []).forEach((inv: any) => {
        grouped[inv.payment_status] = (grouped[inv.payment_status] || 0) + (inv.total_amount || 0);
      });

      const total = Object.values(grouped).reduce((s, v) => s + v, 0);

      setData(
        Object.entries(grouped).map(([status, amount]) => ({
          status,
          label: STATUS_LABELS[status] || status,
          amount,
          percentage: total > 0 ? ((amount / total) * 100).toFixed(1) : "0",
        }))
      );
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="bg-card rounded-lg border border-border shadow-card p-5">
      <h3 className="font-semibold text-foreground mb-4">حالة التحصيل</h3>
      {loading ? (
        <div className="h-[250px] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
          لا توجد بيانات بعد
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-[250px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  dataKey="amount" nameKey="label" paddingAngle={3}>
                  {data.map(entry => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#ccc"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${formatNumber(value)} ر.س`}
                  contentStyle={{ borderRadius: 8, direction: "rtl" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col justify-center gap-3">
            {data.map(d => (
              <div key={d.status} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.status] }} />
                  <span className="text-sm text-foreground">{d.label}</span>
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-foreground">{formatNumber(d.amount)} <SAR /></span>
                  <span className="text-xs text-muted-foreground mr-2">({d.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
