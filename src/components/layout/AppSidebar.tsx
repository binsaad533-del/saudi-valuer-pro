import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  LayoutDashboard, Settings, LogOut, BookOpen, FileText,
  Users, UserCheck, ClipboardList, Archive, BarChart3,
  DollarSign, Shield, Search, Activity, Bell, Briefcase,
  TrendingUp, MapPin, Scale, ChevronDown,
  Brain, Zap,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const logo = "/favicon.png";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

interface NavGroup {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
}

const ownerNavGroups: NavGroup[] = [
  {
    title: "القيادة",
    icon: LayoutDashboard,
    items: [
      { label: "لوحة التحكم", icon: LayoutDashboard, path: "/" },
      { label: "البحث الذكي", icon: Search, path: "/search" },
    ],
  },
  {
    title: "التشغيل",
    icon: Zap,
    items: [
      { label: "الطلبات", icon: ClipboardList, path: "/client-requests" },
      { label: "ملفات التقييم", icon: Scale, path: "/valuations" },
      { label: "تقييم جديد", icon: Briefcase, path: "/valuations/new" },
      { label: "التقارير", icon: FileText, path: "/reports" },
      { label: "الأرشيف", icon: Archive, path: "/archive" },
    ],
  },
  {
    title: "الذكاء",
    icon: Brain,
    items: [
      { label: "قاعدة المعرفة", icon: BookOpen, path: "/knowledge" },
      { label: "السوق والتحليلات", icon: TrendingUp, path: "/market-data" },
      { label: "التحليلات", icon: BarChart3, path: "/analytics" },
      { label: "اللوحة المالية", icon: DollarSign, path: "/cfo-dashboard" },
      { label: "اللوحة التجارية", icon: Briefcase, path: "/commercial" },
    ],
  },
  {
    title: "النظام",
    icon: Settings,
    items: [
      { label: "العملاء", icon: Users, path: "/clients-management" },
      { label: "المعاينون", icon: UserCheck, path: "/inspectors" },
      { label: "التغطية", icon: MapPin, path: "/inspector-coverage" },
      { label: "الإعدادات", icon: Settings, path: "/settings" },
      { label: "الإشعارات", icon: Bell, path: "/notifications" },
      { label: "سجل التدقيق", icon: Shield, path: "/audit-log" },
      { label: "مراقبة النظام", icon: Activity, path: "/system-monitoring" },
    ],
  },
];

const inspectorNavGroups: NavGroup[] = [
  { title: "الرئيسية", icon: LayoutDashboard, items: [
    { label: "المعاينات", icon: LayoutDashboard, path: "/inspector" },
    { label: "الإشعارات", icon: Bell, path: "/inspector/notifications" },
    { label: "الإعدادات", icon: Settings, path: "/inspector/settings" },
  ]},
];

const financialNavGroups: NavGroup[] = [
  { title: "الرئيسية", icon: LayoutDashboard, items: [
    { label: "اللوحة المالية", icon: LayoutDashboard, path: "/cfo-dashboard" },
    { label: "الإشعارات", icon: Bell, path: "/notifications" },
    { label: "الإعدادات", icon: Settings, path: "/account" },
  ]},
];

const clientNavGroups: NavGroup[] = [
  { title: "الرئيسية", icon: LayoutDashboard, items: [
    { label: "لوحة التحكم", icon: LayoutDashboard, path: "/client" },
    { label: "طلباتي", icon: ClipboardList, path: "/client/requests" },
    { label: "طلب جديد", icon: Briefcase, path: "/client/new-request" },
    { label: "الإشعارات", icon: Bell, path: "/client/notifications" },
    { label: "الإعدادات", icon: Settings, path: "/client/settings" },
  ]},
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

  const handleLogout = async () => {
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    toast.success("تم تسجيل الخروج");
    window.location.replace("/login");
  };

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const navGroups = getNavGroupsForRole(role);

  // Determine which group is active
  const activeGroupIndex = navGroups.findIndex(g => g.items.some(i => isActive(i.path)));

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
        {navGroups.map((group, gi) => {
          const isGroupActive = gi === activeGroupIndex;
          const GroupIcon = group.icon;

          if (collapsed) {
            return (
              <SidebarGroup key={group.title}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const active = isActive(item.path);
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                            <NavLink to={item.path} end={item.path === "/"} className="hover:bg-sidebar-accent/60" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <item.icon className="w-4 h-4 shrink-0" />
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <Collapsible key={group.title} defaultOpen={isGroupActive} className="group/collapsible">
              <SidebarGroup>
                <CollapsibleTrigger className="w-full">
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer select-none",
                    isGroupActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-muted hover:text-sidebar-foreground"
                  )}>
                    <div className="flex items-center gap-2">
                      <GroupIcon className="w-3.5 h-3.5" />
                      <span>{group.title}</span>
                    </div>
                    <ChevronDown className="w-3 h-3 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        const active = isActive(item.path);
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                              <NavLink
                                to={item.path}
                                end={item.path === "/"}
                                className="hover:bg-sidebar-accent/60 text-[13px]"
                                activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                              >
                                <item.icon className="w-3.5 h-3.5 shrink-0" />
                                <span>{item.label}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors text-xs",
            collapsed ? "w-full justify-center p-1.5" : "px-3 py-2 w-full"
          )}
          title="تسجيل الخروج"
        >
          <LogOut className="w-3.5 h-3.5" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
