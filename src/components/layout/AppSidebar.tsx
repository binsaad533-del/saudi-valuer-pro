import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  LayoutDashboard, Settings, LogOut, BookOpen, FileText,
  Users, UserCheck, ClipboardList, Archive, BarChart3,
  DollarSign, Shield, Search, Activity, Bell, Briefcase,
  TrendingUp, MapPin, Scale, Wrench,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";

const logo = "/favicon.png";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// ── Owner Navigation (hierarchical) ──
const ownerNavGroups: NavGroup[] = [
  {
    title: "الرئيسية",
    items: [
      { label: "لوحة التحكم", icon: LayoutDashboard, path: "/" },
      { label: "البحث", icon: Search, path: "/search" },
    ],
  },
  {
    title: "العمليات",
    items: [
      { label: "طلبات العملاء", icon: ClipboardList, path: "/client-requests" },
      { label: "ملفات التقييم", icon: Scale, path: "/valuations" },
      { label: "تقييم جديد", icon: Briefcase, path: "/valuations/new" },
    ],
  },
  {
    title: "التقارير والإصدار",
    items: [
      { label: "التقارير", icon: FileText, path: "/reports" },
      { label: "الأرشيف", icon: Archive, path: "/archive" },
    ],
  },
  {
    title: "الإدارة",
    items: [
      { label: "العملاء", icon: Users, path: "/clients-management" },
      { label: "المعاينون", icon: UserCheck, path: "/inspectors" },
      { label: "تغطية المعاينين", icon: MapPin, path: "/inspector-coverage" },
    ],
  },
  {
    title: "الذكاء والتحليل",
    items: [
      { label: "قاعدة المعرفة", icon: BookOpen, path: "/knowledge" },
      { label: "بيانات السوق", icon: TrendingUp, path: "/market-data" },
      { label: "التحليلات", icon: BarChart3, path: "/analytics" },
    ],
  },
  {
    title: "المالية والامتثال",
    items: [
      { label: "اللوحة المالية", icon: DollarSign, path: "/cfo-dashboard" },
      { label: "اللوحة التجارية", icon: Briefcase, path: "/commercial" },
      { label: "سجل التدقيق", icon: Shield, path: "/audit-log" },
    ],
  },
  {
    title: "النظام",
    items: [
      { label: "مراقبة النظام", icon: Activity, path: "/system-monitoring" },
      { label: "الإشعارات", icon: Bell, path: "/notifications" },
      { label: "الإعدادات", icon: Settings, path: "/settings" },
    ],
  },
];

const inspectorNavGroups: NavGroup[] = [
  {
    title: "الرئيسية",
    items: [
      { label: "المعاينات", icon: LayoutDashboard, path: "/inspector" },
      { label: "الإشعارات", icon: Bell, path: "/inspector/notifications" },
      { label: "الإعدادات", icon: Settings, path: "/inspector/settings" },
    ],
  },
];

const financialNavGroups: NavGroup[] = [
  {
    title: "الرئيسية",
    items: [
      { label: "اللوحة المالية", icon: LayoutDashboard, path: "/cfo-dashboard" },
      { label: "الإشعارات", icon: Bell, path: "/notifications" },
      { label: "الإعدادات", icon: Settings, path: "/account" },
    ],
  },
];

const clientNavGroups: NavGroup[] = [
  {
    title: "الرئيسية",
    items: [
      { label: "لوحة التحكم", icon: LayoutDashboard, path: "/client" },
      { label: "طلباتي", icon: ClipboardList, path: "/client/requests" },
      { label: "طلب جديد", icon: Briefcase, path: "/client/new-request" },
      { label: "الإشعارات", icon: Bell, path: "/client/notifications" },
      { label: "الإعدادات", icon: Settings, path: "/client/settings" },
    ],
  },
];

const roleKeyMap: Record<string, string> = {
  owner: "المالك",
  financial_manager: "المدير المالي",
  admin_coordinator: "المنسق",
  inspector: "المعاين",
  client: "العميل",
};

function getNavGroupsForRole(role: string | null): NavGroup[] {
  switch (role) {
    case "inspector": return inspectorNavGroups;
    case "financial_manager": return financialNavGroups;
    case "client": return clientNavGroups;
    default: return ownerNavGroups;
  }
}

export default function AppSidebar() {
  const location = useLocation();
  const { user, role } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
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

  const navGroups = getNavGroupsForRole(role);
  const initials = profileName ? profileName.charAt(0) : "م";

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="جساس" className="w-8 h-8 rounded-md bg-white p-0.5 object-contain shrink-0" />
          {!collapsed && (
            <span className="text-sidebar-foreground font-bold text-sm leading-tight truncate">
              جساس للتقييم
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            {!collapsed && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <NavLink
                          to={item.path}
                          end={item.path === "/"}
                          className="hover:bg-sidebar-accent/60"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                        >
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-xs font-medium truncate">
                {profileName || "..."}
              </p>
              <p className="text-muted-foreground text-[10px] truncate">
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
      </SidebarFooter>
    </Sidebar>
  );
}
