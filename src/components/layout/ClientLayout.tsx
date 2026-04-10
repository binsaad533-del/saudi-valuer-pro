import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import AppFooter from "@/components/layout/AppFooter";
import RaqeemSmartPresence from "@/components/client/RaqeemSmartPresence";

import { LayoutDashboard, FolderOpen, PlusCircle, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { path: "/client/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { path: "/client/requests", label: "طلباتي", icon: FolderOpen },
  { path: "/client/new-request", label: "طلب جديد", icon: PlusCircle },
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
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* Right: Raqeem */}
          <RaqeemSmartPresence />

          {/* Center: Nav */}
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

          {/* Left: Logout */}
          <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج</span>
          </Button>
        </div>
      </header>
    </div>
  );
}
