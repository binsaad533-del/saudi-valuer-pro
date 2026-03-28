import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  FolderPlus,
  Search,
  Users,
  Settings,
  Building2,
  ClipboardCheck,
  Archive,
  BarChart3,
  Shield,
  ChevronDown,
  ChevronLeft,
  Menu,
  X,
  Home,
  Cog,
  Brain,
  MapPin,
} from "lucide-react";
import logo from "@/assets/logo.png";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: "لوحة التحكم", icon: LayoutDashboard, path: "/" },
  {
    label: "التقييمات",
    icon: FileText,
    path: "/valuations",
    children: [
      { label: "جميع التقييمات", path: "/valuations" },
      { label: "طلب تقييم جديد", path: "/valuations/new" },
      { label: "قيد المراجعة", path: "/valuations/review" },
      { label: "المكتملة", path: "/valuations/completed" },
    ],
  },
  { label: "طلب جديد", icon: FolderPlus, path: "/valuations/new" },
  { label: "المقارنات السوقية", icon: Building2, path: "/comparables" },
  { label: "المراجعة والجودة", icon: ClipboardCheck, path: "/review" },
  { label: "الأرشيف", icon: Archive, path: "/archive" },
  { label: "البحث", icon: Search, path: "/search" },
  { label: "التقارير", icon: BarChart3, path: "/reports/generate" },
  { label: "طلبات العملاء", icon: Users, path: "/client-requests" },
  { label: "محرك التقييم", icon: Brain, path: "/valuation-production" },
  { label: "الامتثال", icon: Shield, path: "/compliance" },
  { label: "الإعدادات", icon: Settings, path: "/settings" },
];

export default function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  const sidebarContent = (
    <div className="flex flex-col h-full gradient-sidebar border-l border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <img src={logo} alt="جساس" className="w-10 h-10 object-contain" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-primary font-bold text-lg leading-tight">
              jsaas-valuation
            </span>
            <span className="text-sidebar-muted text-[11px]">التقييم العقاري</span>
          </div>
        )}
      </div>

      {/* Department Switcher */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-sidebar-border">
          <div className="flex gap-1.5">
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 transition-colors">
              <Home className="w-3.5 h-3.5" />
              التقييم العقاري
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-muted hover:bg-muted/50 border border-transparent transition-colors cursor-not-allowed opacity-50" title="قريباً">
              <Cog className="w-3.5 h-3.5" />
              الآلات والمعدات
            </button>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const expanded = expandedItems.includes(item.label);

          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleExpand(item.label)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                    ${active ? "bg-sidebar-accent text-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-right">{item.label}</span>
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
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                ${active ? "bg-sidebar-accent text-primary font-medium shadow-blue" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-5 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              أ
            </div>
            <div className="flex flex-col">
              <span className="text-sidebar-foreground text-sm font-medium">أحمد المالكي</span>
              <span className="text-sidebar-muted text-[11px]">مقيّم معتمد</span>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center py-3 border-t border-sidebar-border text-sidebar-muted hover:text-primary transition-colors"
      >
        <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
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
          ${mobileOpen ? "translate-x-0" : "translate-x-full"} lg:translate-x-0 lg:static
          ${collapsed ? "w-[68px]" : "w-[260px]"}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
