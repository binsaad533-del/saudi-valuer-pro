import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import {
  Activity,
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Building2,
  ClipboardCheck,
  MapPin,
  LogOut,
  BarChart3,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  FolderOpen,
  Wallet,
  BookOpen,
  Bell,
  Shield,
} from "lucide-react";

const logo = "/favicon.png";

interface NavItem {
  labelKey: string;
  icon: React.ElementType;
  path: string;
}

interface NavGroup {
  items: NavItem[];
  separator?: boolean;
}

/* ── Role-based nav configs ─────────────────────────── */

const ownerNav: NavGroup[] = [
  {
    items: [
      { labelKey: "dashboard", icon: LayoutDashboard, path: "/" },
      { labelKey: "clientRequests", icon: ClipboardCheck, path: "/client-requests" },
      { labelKey: "valuations", icon: FileText, path: "/valuations" },
    ],
  },
  {
    separator: true,
    items: [
      { labelKey: "marketData", icon: Building2, path: "/market-data" },
      { labelKey: "inspections", icon: MapPin, path: "/inspectors" },
      { labelKey: "clients", icon: Users, path: "/clients-management" },
      { labelKey: "reports", icon: FolderOpen, path: "/reports" },
      { labelKey: "commercial", icon: Wallet, path: "/commercial" },
    ],
  },
  {
    separator: true,
    items: [
      { labelKey: "knowledgeBase", icon: BookOpen, path: "/knowledge" },
      { labelKey: "analytics", icon: BarChart3, path: "/analytics" },
      { labelKey: "auditLog", icon: Shield, path: "/audit-log" },
      { labelKey: "systemMonitoring", icon: Activity, path: "/system-monitoring" },
      { labelKey: "notifications", icon: Bell, path: "/notifications" },
      { labelKey: "settings", icon: Settings, path: "/settings" },
    ],
  },
];

const inspectorNav: NavGroup[] = [
  {
    items: [
      { labelKey: "inspections", icon: MapPin, path: "/inspector" },
      { labelKey: "notifications", icon: Bell, path: "/inspector/notifications" },
      { labelKey: "myProfile", icon: UserCircle, path: "/inspector/settings" },
    ],
  },
];

const clientNav: NavGroup[] = [
  {
    items: [
      { labelKey: "dashboard", icon: LayoutDashboard, path: "/client" },
      { labelKey: "clientRequests", icon: ClipboardCheck, path: "/client/requests" },
      { labelKey: "reports", icon: FolderOpen, path: "/client/dashboard" },
      { labelKey: "notifications", icon: Bell, path: "/client/notifications" },
      { labelKey: "myProfile", icon: UserCircle, path: "/client/settings" },
    ],
  },
];

const financialNav: NavGroup[] = [
  {
    items: [
      { labelKey: "cfoDashboard", icon: Wallet, path: "/cfo-dashboard" },
      { labelKey: "notifications", icon: Bell, path: "/notifications" },
      { labelKey: "myProfile", icon: UserCircle, path: "/account" },
    ],
  },
];

const roleKeyMap: Record<string, string> = {
  owner: "platformOwner",
  financial_manager: "financialManager",
  inspector: "inspector",
  client: "client",
};

function getNavForRole(role: string | null): NavGroup[] {
  switch (role) {
    case "inspector": return inspectorNav;
    case "client": return clientNav;
    case "financial_manager": return financialNav;
    default: return ownerNav;
  }
}

export default function AppSidebar() {
  const location = useLocation();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");

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
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    toast.success(t("logout"));
    window.location.replace("/login");
  };

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const groups = getNavForRole(role);
  const initials = profileName ? profileName.charAt(0) : "م";
  const CollapseIcon = language === "ar" ? ChevronLeft : ChevronRight;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar border-e border-sidebar-border">
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <img src={logo} alt="جساس" className="w-8 h-8 rounded-md bg-white p-0.5 object-contain" />
        {!collapsed && (
          <span className="text-sidebar-foreground font-bold text-sm leading-tight truncate">
            جساس للتقييم
          </span>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.separator && (
              <div className="my-1.5 mx-2 border-t border-sidebar-border" />
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors
                    ${active
                      ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-sidebar-border px-3 py-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-xs font-medium truncate">
                {profileName || "..."}
              </p>
              <p className="text-sidebar-muted text-[10px] truncate">
                {t(roleKeyMap[role || ""] || "")}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
              title={t("logout")}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            title={t("logout")}
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Collapse toggle (desktop) ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center py-2 border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-primary transition-colors"
      >
        <CollapseIcon className={`w-3.5 h-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 right-3 z-50 p-2 rounded-lg bg-card shadow-md border border-border"
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
            className="lg:hidden fixed top-3 left-3 z-[60] p-2 rounded-lg bg-card shadow-md border border-border"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-screen z-50 transition-all duration-300
          ${mobileOpen ? "translate-x-0" : "translate-x-full"} lg:translate-x-0 lg:sticky lg:top-0 lg:shrink-0
          ${collapsed ? "w-[56px]" : "w-[220px]"}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
