import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, Clock } from "lucide-react";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import { motion } from "framer-motion";

interface StatusData {
  systemOk: boolean;
  criticalAlerts: number;
  lastUpdate: string;
  raqeemActive: boolean;
  complianceOk: boolean;
}

export default function SystemStatusBar() {
  const [data, setData] = useState<StatusData>({
    systemOk: true, criticalAlerts: 0, lastUpdate: "", raqeemActive: true, complianceOk: true,
  });

  useEffect(() => {
    const load = async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

      const [{ count: staleCount }, { count: pendingPayments }] = await Promise.all([
        supabase.from("valuation_assignments").select("id", { count: "exact", head: true })
          .lt("updated_at", threeDaysAgo)
          .not("status", "in", "(issued,archived,cancelled,draft)"),
        supabase.from("payments").select("id", { count: "exact", head: true })
          .eq("payment_status", "pending").eq("payment_type", "bank_transfer"),
      ]);

      const criticals = (staleCount || 0) + (pendingPayments || 0);

      setData({
        systemOk: criticals === 0,
        criticalAlerts: criticals,
        lastUpdate: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
        raqeemActive: true,
        complianceOk: true,
      });
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-between px-4 py-2 rounded-lg border border-border bg-card/80 backdrop-blur-sm"
    >
      <div className="flex items-center gap-4">
        {/* System Health */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${data.systemOk ? "bg-emerald-500" : "bg-red-500"} animate-pulse`} />
          <span className="text-[11px] text-muted-foreground">النظام</span>
        </div>

        {/* Critical Alerts */}
        {data.criticalAlerts > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{data.criticalAlerts} تنبيه حرج</span>
          </div>
        )}

        {/* Raqeem */}
        <div className="flex items-center gap-1.5">
          <RaqeemIcon size={14} />
          <span className="text-[11px] text-muted-foreground">رقيم نشط</span>
        </div>

        {/* Compliance */}
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-emerald-500" />
          <span className="text-[11px] text-muted-foreground">الامتثال</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Clock className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">آخر تحديث: {data.lastUpdate}</span>
      </div>
    </motion.div>
  );
}
