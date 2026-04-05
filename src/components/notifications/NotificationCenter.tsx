import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, CheckCheck, ClipboardList, MapPin, FileText,
  Shield, DollarSign, Monitor, ArrowRight, Filter,
} from "lucide-react";

interface Notification {
  id: string;
  title_ar: string;
  body_ar: string | null;
  category: string;
  priority: string;
  is_read: boolean;
  action_url: string | null;
  notification_type: string | null;
  created_at: string;
  related_assignment_id: string | null;
  related_request_id: string | null;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  workflow: ClipboardList,
  inspection: MapPin,
  report: FileText,
  compliance: Shield,
  financial: DollarSign,
  system: Monitor,
  assignment: ClipboardList,
  payment: DollarSign,
  general: Bell,
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel("notif-center")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true } as any).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true } as any).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleClick = (n: Notification) => {
    markAsRead(n.id);
    if (n.action_url) navigate(n.action_url);
    else if (n.related_assignment_id) navigate(`/assignment/${n.related_assignment_id}`);
    else if (n.related_request_id) navigate(`/client/request/${n.related_request_id}`);
  };

  const filtered = activeTab === "all"
    ? notifications
    : notifications.filter((n) => n.category === activeTab);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  };

  const categories = ["all", ...Object.keys(NOTIFICATION_CATEGORIES)];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">مركز الإشعارات</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : "لا توجد إشعارات جديدة"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4" /> قراءة الكل
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-xl">
          <TabsTrigger value="all" className="text-xs">الكل</TabsTrigger>
          {Object.entries(NOTIFICATION_CATEGORIES).map(([key, cat]) => {
            const count = notifications.filter((n) => n.category === key && !n.is_read).length;
            return (
              <TabsTrigger key={key} value={key} className="text-xs gap-1">
                {cat.label}
                {count > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-4">{count}</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">جاري التحميل...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد إشعارات</p>
            </div>
          ) : (
            filtered.map((n) => {
              const Icon = CATEGORY_ICONS[n.category] || Bell;
              return (
                <Card
                  key={n.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/30 ${!n.is_read ? "border-primary/30 bg-primary/[0.02]" : ""}`}
                  onClick={() => handleClick(n)}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.low}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                        <span className="text-sm font-medium text-foreground truncate">{n.title_ar}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">
                          {n.priority === "critical" ? "حرج" : n.priority === "high" ? "عالي" : n.priority === "medium" ? "متوسط" : "منخفض"}
                        </Badge>
                      </div>
                      {n.body_ar && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.body_ar}</p>
                      )}
                      <span className="text-[10px] text-muted-foreground/60 mt-1 block">{timeAgo(n.created_at)}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-2" />
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </Tabs>
    </div>
  );
}
