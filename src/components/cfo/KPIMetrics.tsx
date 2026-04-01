import { motion } from "framer-motion";
import { TrendingUp, Percent, FileText, BarChart3 } from "lucide-react";

const kpis = [
  { label: "متوسط مدة التحصيل", value: "23 يوم", icon: TrendingUp, description: "من تاريخ الإصدار للسداد" },
  { label: "نسبة التحصيل", value: "87.4%", icon: Percent, description: "من إجمالي الفواتير المستحقة" },
  { label: "فواتير هذا الشهر vs السابق", value: "8 / 6", icon: FileText, description: "+33% عن الشهر الماضي" },
  { label: "إيرادات الربع الحالي", value: "930,000 ر.س", icon: BarChart3, description: "الربع الأول 2025" },
];

export default function KPIMetrics() {
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
              <span className="text-xl font-bold text-foreground">{kpi.value}</span>
              <span className="text-sm text-muted-foreground mt-1">{kpi.label}</span>
              <span className="text-[11px] text-muted-foreground/70 mt-0.5">{kpi.description}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
