import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import {
  LayoutDashboard,
  FileText,
  Search,
  Users,
  Settings,
  Building2,
  ClipboardCheck,
  Archive,
  Shield,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  MapPin,
  Sparkles,
  LogOut,
  Brain,
  Calculator,
  BarChart3,
} from "lucide-react";
const logo = "/favicon.png";

interface NavChild {
  labelKey: string;
  path: string;
}

interface NavItem {
  labelKey: string;
  icon: React.ElementType;
  path: string;
  children?: NavChild[];
  roles?: string[];
}

interface NavSection {
  titleKey?: string;
  items: NavItem[];
  roles?: string[];
}

const navSections: NavSection[] = [
  {
    items: [
      { labelKey: "raqeem", icon: Sparkles, path: "/raqeem", roles: ["owner"] },
      { labelKey: "dashboard", icon: LayoutDashboard, path: "/", roles: ["owner", "admin_coordinator"] },
      { labelKey: "coordinatorPanel", icon: ClipboardCheck, path: "/coordinator-dashboard", roles: ["admin_coordinator", "owner"] },
    ],
  },
  {
    titleKey: "valuationSection",
    items: [
      { labelKey: "valuations", icon: FileText, path: "/valuations", roles: ["owner"] },
      { labelKey: "marketData", icon: Building2, path: "/market-data", roles: ["owner"] },
    ],
    roles: ["owner"],
  },
  {
    titleKey: "operationsSection",
    items: [
      { labelKey: "clientRequests", icon: ClipboardCheck, path: "/client-requests", roles: ["owner", "admin_coordinator"] },
      { labelKey: "inspections", icon: MapPin, path: "/inspectors", roles: ["owner", "admin_coordinator"] },
      { labelKey: "clients", icon: Users, path: "/clients-management", roles: ["owner", "admin_coordinator"] },
    ],
    roles: ["owner", "admin_coordinator"],
  },
  {
    titleKey: "aiSection",
    items: [
      { labelKey: "smartTools", icon: Brain, path: "/smart-tools", roles: ["owner", "admin_coordinator"] },
    ],
    roles: ["owner", "admin_coordinator"],
  },
  {
    titleKey: "financeSection",
    items: [
      { labelKey: "cfoDashboard", icon: LayoutDashboard, path: "/cfo-dashboard" },
    ],
  },
  {
    titleKey: "systemSection",
    items: [
      { labelKey: "analytics", icon: BarChart3, path: "/analytics", roles: ["owner"] },
      { labelKey: "compliance", icon: Shield, path: "/compliance", roles: ["owner"] },
      { labelKey: "settings", icon: Settings, path: "/settings", roles: ["owner"] },
      { labelKey: "myProfile", icon: Settings, path: "/settings", roles: ["admin_coordinator", "financial_manager"] },
    ],
  },
];

const roleKeyMap: Record<string, string> = {
  owner: "platformOwner",
  financial_manager: "financialManager",
  admin_coordinator: "adminCoordinator",
  inspector: "inspector",
  client: "client",
};

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name_ar")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfileName(data.full_name_ar);
      });
  }, [user]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // silently ignore
    } finally {
      toast.success(t("logout"));
      window.location.replace("/login");
    }
  };

  const toggleExpand = (labelKey: string) => {
    setExpandedItems((prev) =>
      prev.includes(labelKey) ? prev.filter((l) => l !== labelKey) : [...prev, labelKey]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  const canSee = (roles?: string[]) => {
    if (!roles) return true;
    if (!role) return false;
    return roles.includes(role);
  };

  const filteredSections = navSections
    .filter((s) => canSee(s.roles))
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => canSee(item.roles)),
    }))
    .filter((s) => s.items.length > 0);

  const initials = profileName ? profileName.charAt(0) : "م";
  const CollapseIcon = language === "ar" ? ChevronLeft : ChevronRight;

  const sidebarContent = (
    <div className="flex flex-col h-full gradient-sidebar border-l border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <img src={logo} alt="جساس" className="w-10 h-10 object-contain rounded-md bg-white p-0.5" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-primary font-bold text-lg leading-tight">
              jsaas-valuation
            </span>
            <span className="text-sidebar-muted text-[11px]">{t("platformName")}</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-3 px-3 space-y-1">
        {filteredSections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.titleKey && !collapsed && (
              <div className="px-3 pt-4 pb-1.5 text-[11px] font-semibold text-sidebar-muted/70 uppercase tracking-wider">
                {t(section.titleKey)}
              </div>
            )}
            {section.titleKey && collapsed && <div className="my-2 mx-3 border-t border-sidebar-border" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                const expanded = expandedItems.includes(item.labelKey);

                if (item.children) {
                  return (
                    <div key={item.labelKey}>
                      <button
                        onClick={() => toggleExpand(item.labelKey)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                          ${active ? "bg-sidebar-accent text-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                      >
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-right">{t(item.labelKey)}</span>
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                          </>
                        )}
                      </button>
                      {expanded && !collapsed && (
                        <div className="mr-8 mt-0.5 space-y-0.5 border-r-2 border-primary/15 pr-3">
                          {item.children.map((child) => (
                            <Link
                              key={child.path}
                              to={child.path}
                              className={`block px-3 py-2 rounded-lg text-[13px] transition-all
                                ${isActive(child.path) ? "text-primary bg-sidebar-accent font-medium" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
                            >
                              {t(child.labelKey)}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.path + item.labelKey}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                      ${active ? "bg-sidebar-accent text-primary font-medium shadow-blue" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && <span>{t(item.labelKey)}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed ? (
        <div className="px-5 py-4 border-t border-sidebar-border space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              {initials}
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-sidebar-foreground text-sm font-medium">
                {profileName || "..."}
              </span>
              <span className="text-sidebar-muted text-[11px]">
                {t(roleKeyMap[role || ""] || role || "")}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t("logout")}
          </button>
        </div>
      ) : (
        <div className="px-2 py-3 border-t border-sidebar-border flex justify-center">
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            title={t("logout")}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center py-3 border-t border-sidebar-border text-sidebar-muted hover:text-primary transition-colors"
      >
        <CollapseIcon className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 rounded-lg bg-card shadow-card border border-border"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-card shadow-card border border-border"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-screen z-50 transition-all duration-300
          ${mobileOpen ? "translate-x-0" : "translate-x-full"} lg:translate-x-0 lg:sticky lg:top-0 lg:shrink-0
          ${collapsed ? "w-[68px]" : "w-[260px]"}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
