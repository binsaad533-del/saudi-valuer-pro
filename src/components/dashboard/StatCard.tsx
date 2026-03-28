import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "primary" | "accent" | "warning";
}

const variantStyles = {
  default: "bg-card border-border",
  primary: "bg-primary/5 border-primary/20",
  accent: "bg-accent/5 border-accent/20",
  warning: "bg-warning/5 border-warning/20",
};

const iconStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  warning: "bg-warning/10 text-warning",
};

export default function StatCard({ title, value, subtitle, icon, trend, variant = "default" }: StatCardProps) {
  return (
    <div className={`rounded-lg border p-5 shadow-card animate-fade-in ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-2xl font-bold text-foreground mt-1 animate-count-up">{value}</span>
          {subtitle && <span className="text-xs text-muted-foreground mt-1">{subtitle}</span>}
          {trend && (
            <span className={`text-xs mt-1 ${trend.positive ? "text-success" : "text-destructive"}`}>
              {trend.value}
            </span>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconStyles[variant]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
