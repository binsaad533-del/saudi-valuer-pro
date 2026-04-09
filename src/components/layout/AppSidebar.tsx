import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  LayoutDashboard, Settings, LogOut, BookOpen, FileText,
  Users, UserCheck, ClipboardList, Archive, BarChart3,
  DollarSign, Shield, Search, Activity, Bell, Briefcase,
  TrendingUp, MapPin, Scale,
  Zap,
} from "lucide-react";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { useState } from "react";

const logo = "/favicon.png";

interface NavItem { label: string; icon: React.ElementType; path: string }
interface NavGroup { id: string; title: string; icon: React.ElementType; items: NavItem[] }

const ownerNavGroups: NavGroup[] = [
  {
    id: "command", title: "القيادة", icon: LayoutDashboard,
    items: [
      { label: "مركز التحكم", icon: LayoutDashboard, path: "/" },
      { label: "البحث", icon: Search, path: "/search" },
    ],
  },
  {
    id: "ops", title: "التشغيل", icon: Zap,
    items: [
      { label: "الطلبات", icon: ClipboardList, path: "/client-requests" },
      { label: "الملفات", icon: Scale, path: "/valuations" },
      { label: "تقييم جديد", icon: Briefcase, path: "/valuations/new" },
      { label: "التقارير", icon: FileText, path: "/reports" },
      { label: "الأرشيف", icon: Archive, path: "/archive" },
    ],
  },
  {
    id: "intel", title: "الذكاء", icon: RaqeemIcon,
    items: [
      { label: "المعرفة", icon: BookOpen, path: "/knowledge" },
      { label: "السوق", icon: TrendingUp, path: "/market-data" },
      { label: "التحليلات", icon: BarChart3, path: "/analytics" },
      { label: "المالية", icon: DollarSign, path: "/cfo-dashboard" },
      { label: "التجارية", icon: Briefcase, path: "/commercial" },
    ],
  },
  {
    id: "system", title: "النظام", icon: Settings,
    items: [
      { label: "العملاء", icon: Users, path: "/clients-management" },
      { label: "المعاينون", icon: UserCheck, path: "/inspectors" },
      { label: "التغطية", icon: MapPin, path: "/inspector-coverage" },
      { label: "الإعدادات", icon: Settings, path: "/settings" },
      { label: "الإشعارات", icon: Bell, path: "/notifications" },
      { label: "التدقيق", icon: Shield, path: "/audit-log" },
      { label: "المراقبة", icon: Activity, path: "/system-monitoring" },
      { label: "الحارس الشامل", icon: Search, path: "/watchdog" },
      { label: "المحرك التقني", icon: Activity, path: "/tech-engine" },
    ],
  },
];

const inspectorNavGroups: NavGroup[] = [
  { id: "main", title: "الرئيسية", icon: LayoutDashboard, items: [
    { label: "المعاينات", icon: LayoutDashboard, path: "/inspector" },
    { label: "الإشعارات", icon: Bell, path: "/inspector/notifications" },
    { label: "الإعدادات", icon: Settings, path: "/inspector/settings" },
  ]},
];

const financialNavGroups: NavGroup[] = [
  { id: "main", title: "الرئيسية", icon: LayoutDashboard, items: [
    { label: "المالية", icon: LayoutDashboard, path: "/cfo-dashboard" },
    { label: "الإشعارات", icon: Bell, path: "/notifications" },
    { label: "الإعدادات", icon: Settings, path: "/account" },
  ]},
];

const clientNavGroups: NavGroup[] = [
  { id: "main", title: "الرئيسية", icon: LayoutDashboard, items: [
    { label: "لوحة التحكم", icon: LayoutDashboard, path: "/client" },
    { label: "طلباتي", icon: ClipboardList, path: "/client/requests" },
    { label: "طلب جديد", icon: Briefcase, path: "/client/new-request" },
    { label: "الإشعارات", icon: Bell, path: "/client/notifications" },
    { label: "الإعدادات", icon: Settings, path: "/client/settings" },
  ]},
];

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
  const { role } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const handleLogout = async () => {
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    toast.success("تم تسجيل الخروج");
    window.location.replace("/login");
  };

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const navGroups = getNavGroupsForRole(role);

  // Auto-detect active group
  const activeGroupId = navGroups.find(g => g.items.some(i => isActive(i.path)))?.id || null;
  const visibleGroup = expandedGroup || activeGroupId;

  return (
    <Sidebar collapsible="icon" side="right">
      {/* Header — compact logo */}
      <SidebarHeader className="border-b border-sidebar-border px-2.5 py-2.5">
        <div className="flex items-center gap-2">
          <img src={logo} alt="جساس" className="w-7 h-7 rounded bg-white/80 p-0.5 object-contain shrink-0" />
          {!collapsed && (
            <span className="text-sidebar-foreground font-semibold text-[13px] tracking-tight truncate">
              جساس
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-2">
        {collapsed ? (
          /* Collapsed: show only group icons */
          <SidebarMenu>
            {navGroups.map((group) => {
              const GIcon = group.icon;
              const groupActive = group.id === activeGroupId;
              return (
                <SidebarMenuItem key={group.id}>
                  <SidebarMenuButton tooltip={group.title} isActive={groupActive} asChild>
                    <NavLink
                      to={group.items[0].path}
                      end={group.items[0].path === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary"
                    >
                      <GIcon className="w-4 h-4" />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        ) : (
          /* Expanded: group tabs + items */
          <>
            {/* Group selectors — horizontal tabs */}
            <div className="flex items-center gap-0.5 px-1 mb-2">
              {navGroups.map((group) => {
                const GIcon = group.icon;
                const isSelected = visibleGroup === group.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => setExpandedGroup(group.id === expandedGroup ? null : group.id)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-md text-[9px] font-medium transition-all",
                      isSelected
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
                    )}
                  >
                    <GIcon className="w-3.5 h-3.5" />
                    <span>{group.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Active group items */}
            <div className="border-t border-sidebar-border/50 pt-1.5">
              <SidebarMenu>
                {navGroups
                  .find(g => g.id === visibleGroup)
                  ?.items.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <NavLink
                            to={item.path}
                            end={item.path === "/"}
                            className="hover:bg-sidebar-accent/40 text-[12px] py-1.5"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <item.icon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                            <span>{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </div>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2.5 py-2">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors text-[11px]",
            collapsed ? "w-full justify-center p-1.5" : "px-2 py-1.5 w-full"
          )}
        >
          <LogOut className="w-3 h-3" />
          {!collapsed && <span>خروج</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
