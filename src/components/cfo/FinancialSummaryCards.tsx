import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { formatNumber } from "@/lib/utils";
import { SAR, SARIcon } from "@/components/ui/saudi-riyal";

interface Summary {
  revenue: number;
  pending: number;
  invoiceCount: number;
  pendingReceipts: number;
}

const variantStyles: Record<string, { bg: string; icon: string; border: string }> = {
  success:     { bg: "bg-success/5",     icon: "bg-success/10 text-success",         border: "border-success/20" },
  primary:     { bg: "bg-primary/5",     icon: "bg-primary/10 text-primary",         border: "border-primary/20" },
  warning:     { bg: "bg-warning/5",     icon: "bg-warning/10 text-warning",         border: "border-warning/20" },
  destructive: { bg: "bg-destructive/5", icon: "bg-destructive/10 text-destructive", border: "border-destructive/20" },
};

export default function FinancialSummaryCards() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [paidRes, pendingRes, countRes, receiptsRes] = await Promise.all([
        supabase.from("invoices").select("total_amount").eq("payment_status", "paid"),
        supabase.from("invoices").select("total_amount").eq("payment_status", "pending"),
        supabase.from("invoices").select("id", { count: "exact", head: true }),
        supabase.from("payment_receipts" as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      setSummary({
        revenue:        (paidRes.data    || []).reduce((s, r: any) => s + (r.total_amount || 0), 0),
        pending:        (pendingRes.data || []).reduce((s, r: any) => s + (r.total_amount || 0), 0),
        invoiceCount:   countRes.count    || 0,
        pendingReceipts: receiptsRes.count || 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const cards = summary ? [
    {
      title: "إجمالي الإيرادات المحصّلة",
      value: summary.revenue,
      sub: "من الفواتير المدفوعة",
      icon: SARIcon,
      variant: "success" as const,
      isCurrency: true,
    },
    {
      title: "المستحقات المعلقة",
      value: summary.pending,
      sub: "فواتير لم تُسدَّد",
      icon: Clock,
      variant: "warning" as const,
      isCurrency: true,
    },
    {
      title: "إجمالي الفواتير",
      value: summary.invoiceCount,
      sub: "منذ بداية التشغيل",
      icon: CreditCard,
      variant: "primary" as const,
      isCurrency: false,
    },
    {
      title: "إيصالات بانتظار المراجعة",
      value: summary.pendingReceipts,
      sub: "تحتاج تأكيد المدير المالي",
      icon: AlertTriangle,
      variant: "destructive" as const,
      isCurrency: false,
    },
  ] : [];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border p-5 h-28 flex items-center justify-center bg-card">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const style = variantStyles[card.variant];
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className={`rounded-lg border p-5 shadow-card ${style.bg} ${style.border}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">{card.title}</span>
                <span className="text-2xl font-bold text-foreground mt-1">
                  {card.isCurrency ? (
                    <>{formatNumber(card.value)} <SAR /></>
                  ) : (
                    formatNumber(card.value)
                  )}
                </span>
                <span className="text-xs text-muted-foreground mt-1">{card.sub}</span>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${style.icon}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
