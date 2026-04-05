import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import NotificationDeliveryLog from "@/components/notifications/NotificationDeliveryLog";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotificationSettingsPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isOwner = role === "owner";

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">إعدادات الإشعارات</h1>
          <p className="text-sm text-muted-foreground">تحكم في الإشعارات وقنوات التوصيل</p>
        </div>
      </div>

      <NotificationPreferences />

      {isOwner && (
        <div className="pt-4">
          <NotificationDeliveryLog />
        </div>
      )}
    </div>
  );
}
