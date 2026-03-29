import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "primary" | "accent" | "warning";
  href?: string;
  details?: { label: string; value: string | number }[];
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

export default function StatCard({ title, value, subtitle, icon, trend, variant = "default", href, details }: StatCardProps) {
  const content = (
    <div className={`rounded-lg border p-5 shadow-card animate-fade-in transition-all ${variantStyles[variant]} ${href ? "hover:shadow-md hover:scale-[1.02] cursor-pointer" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col flex-1">
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
      {details && details.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
          {details.map((d) => (
            <div key={d.label} className="flex flex-col">
              <span className="text-[10px] text-muted-foreground">{d.label}</span>
              <span className="text-sm font-semibold text-foreground">{d.value}</span>
            </div>
          ))}
        </div>
      )}
      {href && (
        <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-1 text-xs text-primary font-medium">
          <span>عرض التفاصيل</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }
  return content;
}
