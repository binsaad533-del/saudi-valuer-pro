import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ClientNotificationsBell from "@/components/client/ClientNotificationsBell";
import AppFooter from "@/components/layout/AppFooter";
import logo from "@/assets/logo.png";
import {
  LayoutDashboard, FolderOpen, PlusCircle, Settings, LogOut, Bell, MessageSquare,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/client/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { path: "/client/chat", label: "مركز التشغيل", icon: MessageSquare },
  { path: "/client/requests", label: "طلباتي", icon: FolderOpen },
  { path: "/client/new-request", label: "طلب جديد", icon: PlusCircle },
  { path: "/client/notifications", label: "الإشعارات", icon: Bell },
  { path: "/client/settings", label: "الإعدادات", icon: Settings },
];

export default function ClientLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Sticky Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/client/dashboard")}>
            <img src={logo} alt="جساس" className="w-7 h-7" />
            <span className="text-sm font-bold text-foreground hidden sm:inline">جساس للتقييم</span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
              <Button
                key={path}
                variant={isActive(path) ? "default" : "ghost"}
                size="sm"
                className={`text-xs gap-1.5 h-8 ${isActive(path) ? "" : "text-muted-foreground"}`}
                onClick={() => navigate(path)}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{label}</span>
              </Button>
            ))}
          </nav>

          {/* Logout */}
          <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج</span>
          </Button>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
