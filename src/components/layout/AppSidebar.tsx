import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  BookOpen,
} from "lucide-react";

const logo = "/favicon.png";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

const ownerNav: NavItem[] = [
  { label: "لوحة التحكم", icon: LayoutDashboard, path: "/" },
  { label: "قاعدة المعرفة المهنية", icon: BookOpen, path: "/knowledge" },
  { label: "الإعدادات", icon: Settings, path: "/settings" },
];

const inspectorNav: NavItem[] = [
  { label: "المعاينات", icon: LayoutDashboard, path: "/inspector" },
  { label: "الإعدادات", icon: Settings, path: "/inspector/settings" },
];

const financialNav: NavItem[] = [
  { label: "اللوحة المالية", icon: LayoutDashboard, path: "/cfo-dashboard" },
  { label: "الإعدادات", icon: Settings, path: "/account" },
];

const clientNav: NavItem[] = [
  { label: "لوحة التحكم", icon: LayoutDashboard, path: "/client" },
  { label: "الإعدادات", icon: Settings, path: "/client/settings" },
];

const roleKeyMap: Record<string, string> = {
  owner: "المالك",
  financial_manager: "المدير المالي",
  admin_coordinator: "المنسق",
  inspector: "المعاين",
  client: "العميل",
};

function getNavForRole(role: string | null): NavItem[] {
  switch (role) {
    case "inspector": return inspectorNav;
    case "financial_manager": return financialNav;
    case "client": return clientNav;
    default: return ownerNav;
  }
}

export default function AppSidebar() {
  const location = useLocation();
  const { user, role } = useAuth();
  const { language } = useLanguage();
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
    toast.success("تم تسجيل الخروج");
    window.location.replace("/login");
  };

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const items = getNavForRole(role);
  const initials = profileName ? profileName.charAt(0) : "م";
  const CollapseIcon = language === "ar" ? ChevronLeft : ChevronRight;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar border-e border-sidebar-border">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <img src={logo} alt="جساس" className="w-8 h-8 rounded-md bg-white p-0.5 object-contain" />
        {!collapsed && (
          <span className="text-sidebar-foreground font-bold text-sm leading-tight truncate">
            جساس للتقييم
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors
                ${active
                  ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
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
                {roleKeyMap[role || ""] || ""}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Collapse toggle (desktop) */}
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
