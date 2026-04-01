import { DollarSign, CreditCard, Clock, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface SummaryCard {
  title: string;
  value: number;
  trend: string;
  trendPositive: boolean;
  icon: React.ElementType;
  variant: "success" | "primary" | "warning" | "destructive";
}

const cards: SummaryCard[] = [
  { title: "إجمالي الإيرادات", value: 2970000, trend: "+12.5%", trendPositive: true, icon: DollarSign, variant: "success" },
  { title: "المدفوعات المستلمة", value: 2230000, trend: "+8.3%", trendPositive: true, icon: CreditCard, variant: "primary" },
  { title: "الفواتير المعلقة", value: 540000, trend: "+15.2%", trendPositive: false, icon: Clock, variant: "warning" },
  { title: "المبالغ المتأخرة", value: 200000, trend: "-5.1%", trendPositive: true, icon: AlertTriangle, variant: "destructive" },
];

const variantStyles: Record<string, { bg: string; icon: string; border: string }> = {
  success: { bg: "bg-success/5", icon: "bg-success/10 text-success", border: "border-success/20" },
  primary: { bg: "bg-primary/5", icon: "bg-primary/10 text-primary", border: "border-primary/20" },
  warning: { bg: "bg-warning/5", icon: "bg-warning/10 text-warning", border: "border-warning/20" },
  destructive: { bg: "bg-destructive/5", icon: "bg-destructive/10 text-destructive", border: "border-destructive/20" },
};

export default function FinancialSummaryCards() {
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
                  {card.value.toLocaleString("ar-SA")} ر.س
                </span>
                <span className={`text-xs mt-1 ${card.trendPositive ? "text-success" : "text-destructive"}`}>
                  {card.trend} عن الشهر السابق
                </span>
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
