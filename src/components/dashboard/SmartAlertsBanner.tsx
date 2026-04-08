import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, CreditCard, Clock } from "lucide-react";

interface AlertItem {
  type: "new_requests" | "stale" | "payment_pending";
  count: number;
  label: string;
  icon: React.ElementType;
  accent: string;
}

export default function SmartAlertsBanner() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const items: AlertItem[] = [];

      // New requests awaiting action
      const { count: newCount } = await supabase
        .from("valuation_assignments")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "scope_generated"]);
      if ((newCount || 0) > 0) {
        items.push({ type: "new_requests", count: newCount!, label: "طلب جديد بانتظار مراجعتك", icon: Bell, accent: "text-amber-600 dark:text-amber-400" });
      }

      // Stale assignments (>3 days without update, excluding terminal)
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      const { count: staleCount } = await supabase
        .from("valuation_assignments")
        .select("id", { count: "exact", head: true })
        .lt("updated_at", threeDaysAgo)
        .not("status", "in", "(issued,archived,cancelled,draft)");
      if ((staleCount || 0) > 0) {
        items.push({ type: "stale", count: staleCount!, label: "مهمة متوقفة أكثر من 3 أيام", icon: Clock, accent: "text-red-600 dark:text-red-400" });
      }

      // Payment proofs pending review
      const { count: paymentCount } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "pending")
        .eq("payment_type", "bank_transfer");
      if ((paymentCount || 0) > 0) {
        items.push({ type: "payment_pending", count: paymentCount!, label: "إثبات دفع بانتظار التحقق", icon: CreditCard, accent: "text-blue-600 dark:text-blue-400" });
      }

      setAlerts(items);
    };
    load();
  }, []);

  if (alerts.length === 0) return null;

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">تنبيهات تحتاج انتباهك</p>
            <p className="text-xs text-muted-foreground">{alerts.length} تنبيه نشط</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {alerts.map((alert) => {
            const Icon = alert.icon;
            return (
              <div
                key={alert.type}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
              >
                <Icon className={`w-4 h-4 ${alert.accent}`} />
                <span className="text-xs text-foreground font-medium">{alert.count}</span>
                <span className="text-xs text-muted-foreground">{alert.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
