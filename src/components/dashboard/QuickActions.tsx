import {
  FileText,
  FolderPlus,
  ClipboardCheck,
  Search,
  FileDown,
  Building2,
  Shield,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface QuickAction {
  label: string;
  icon: React.ElementType;
  path: string;
  variant: "primary" | "default";
  roles?: string[];
}

const actions: QuickAction[] = [
  { label: "طلب تقييم جديد", icon: FolderPlus, path: "/valuations/new", variant: "primary" },
  { label: "جميع التقييمات", icon: FileText, path: "/valuations", variant: "default" },
  { label: "المراجعة والجودة", icon: ClipboardCheck, path: "/review", variant: "default" },
  { label: "المقارنات السوقية", icon: Building2, path: "/comparables", variant: "default", roles: ["super_admin", "valuer"] },
  { label: "بحث متقدم", icon: Search, path: "/search", variant: "default" },
  { label: "تصدير التقارير", icon: FileDown, path: "/reports", variant: "default" },
  { label: "إدارة العملاء", icon: Users, path: "/clients", variant: "default" },
  { label: "الامتثال", icon: Shield, path: "/compliance", variant: "default" },
];

export default function QuickActions() {
  return (
    <div className="bg-card rounded-lg border border-border shadow-card animate-fade-in">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">إجراءات سريعة</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.path + action.label}
              to={action.path}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all hover:shadow-card
                ${action.variant === "primary"
                  ? "gradient-primary text-primary-foreground border-primary/30 hover:opacity-90"
                  : "bg-muted/30 text-foreground border-border hover:bg-muted"
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium text-center">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
