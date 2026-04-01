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
import { useLanguage } from "@/contexts/LanguageContext";

interface QuickAction {
  labelKey: string;
  icon: React.ElementType;
  path: string;
  variant: "primary" | "default";
  roles?: string[];
}

const actions: QuickAction[] = [
  { labelKey: "newValuation", icon: FolderPlus, path: "/valuations/new", variant: "primary" },
  { labelKey: "allValuations", icon: FileText, path: "/valuations", variant: "default" },
  { labelKey: "reviewQuality", icon: ClipboardCheck, path: "/review", variant: "default" },
  { labelKey: "marketComparables", icon: Building2, path: "/comparables", variant: "default", roles: ["owner"] },
  { labelKey: "advancedSearch", icon: Search, path: "/search", variant: "default" },
  { labelKey: "exportReports", icon: FileDown, path: "/reports", variant: "default" },
  { labelKey: "clientManagement", icon: Users, path: "/clients", variant: "default" },
  { labelKey: "compliance", icon: Shield, path: "/compliance", variant: "default" },
];

export default function QuickActions() {
  const { role } = useAuth();
  const { t } = useLanguage();

  const visibleActions = actions.filter((a) => {
    if (!a.roles) return true;
    if (!role) return false;
    return a.roles.includes(role);
  });

  return (
    <div className="bg-card rounded-lg border border-border shadow-card animate-fade-in">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">{t("quickActions")}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.path + action.labelKey}
              to={action.path}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all hover:shadow-card
                ${action.variant === "primary"
                  ? "gradient-primary text-primary-foreground border-primary/30 hover:opacity-90"
                  : "bg-muted/30 text-foreground border-border hover:bg-muted"
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium text-center">{t(action.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
