import { motion } from "framer-motion";
import { ClipboardCheck, Clock, ShieldCheck, AlertTriangle, FileText, CreditCard } from "lucide-react";

interface Props {
  counts: {
    newRequests: number;
    stale: number;
    awaitingApproval: number;
    stopped: number;
    pendingPayments: number;
    draftsReady: number;
  };
}

const cards = [
  { key: "newRequests" as const, label: "طلب جديد", icon: ClipboardCheck, color: "text-primary" },
  { key: "stale" as const, label: "متأخر", icon: Clock, color: "text-red-500" },
  { key: "awaitingApproval" as const, label: "بانتظار اعتمادك", icon: ShieldCheck, color: "text-amber-600 dark:text-amber-400" },
  { key: "stopped" as const, label: "متوقف", icon: AlertTriangle, color: "text-red-500" },
  { key: "pendingPayments" as const, label: "دفعة معلقة", icon: CreditCard, color: "text-blue-500" },
  { key: "draftsReady" as const, label: "مسودة جاهزة", icon: FileText, color: "text-emerald-600 dark:text-emerald-400" },
];

export default function OperationalOverview({ counts }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const value = counts[card.key];
        const isAlert = card.key === "stale" || card.key === "stopped";
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className={`rounded-xl border bg-card p-4 transition-all hover:shadow-sm ${
              isAlert && value > 0 ? "border-red-200 dark:border-red-800/40" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className={`w-4 h-4 ${card.color}`} />
              <span className={`text-2xl font-bold tabular-nums ${isAlert && value > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                {value}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">{card.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
