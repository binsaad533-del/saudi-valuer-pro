import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CalendarDays, Globe, ArrowRight } from "lucide-react";

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [profileName, setProfileName] = useState("");
  const isHome = location.pathname === "/";

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

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        {!isHome && (
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            title="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground mt-0.5">مرحباً، {profileName || "..."}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground">
          <Globe className="w-[18px] h-[18px]" />
        </button>
        <button className="relative p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
        </button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground border-r border-border pr-3 mr-1">
          <CalendarDays className="w-4 h-4" />
          <span>{new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </div>
    </header>
  );
}
