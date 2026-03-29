import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "primary" | "accent" | "warning";
  href?: string;
  details?: { label: string; value: string | number }[];
  index?: number;
}

const variantStyles = {
  default: "bg-card border-border",
  primary: "bg-primary/5 border-primary/20",
  accent: "bg-success/5 border-success/20",
  warning: "bg-warning/5 border-warning/20",
};

const iconStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  accent: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};

export default function StatCard({ title, value, subtitle, icon, trend, variant = "default", href, details, index = 0 }: StatCardProps) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      whileHover={href ? { scale: 1.03, y: -4 } : undefined}
      whileTap={href ? { scale: 0.98 } : undefined}
      className={`rounded-lg border p-5 shadow-card transition-shadow h-full flex flex-col ${variantStyles[variant]} ${href ? "hover:shadow-md cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col flex-1">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-2xl font-bold text-foreground mt-1">{value}</span>
          {subtitle && <span className="text-xs text-muted-foreground mt-1">{subtitle}</span>}
          {trend && (
            <span className={`text-xs mt-1 ${trend.positive ? "text-success" : "text-destructive"}`}>
              {trend.value}
            </span>
          )}
        </div>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: index * 0.08 + 0.2 }}
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconStyles[variant]}`}
        >
          {icon}
        </motion.div>
      </div>
      {details && details.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
          {details.map((d, i) => (
            <motion.div
              key={d.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.08 + 0.3 + i * 0.05 }}
              className="flex flex-col"
            >
              <span className="text-[10px] text-muted-foreground">{d.label}</span>
              <span className="text-sm font-semibold text-foreground">{d.value}</span>
            </motion.div>
          ))}
        </div>
      )}
      {href && (
        <div className="mt-auto pt-3 border-t border-border/50 flex items-center gap-1 text-xs text-primary font-medium group">
          <span>عرض التفاصيل</span>
          <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
        </div>
      )}
    </motion.div>
  );

  if (href) {
    return <Link to={href}>{inner}</Link>;
  }
  return inner;
}
