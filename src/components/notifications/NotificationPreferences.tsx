import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  NOTIFICATION_TYPES_BY_ROLE,
  NOTIFICATION_CATEGORIES,
} from "@/lib/notification-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Smartphone, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Preference {
  notification_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
}

export default function NotificationPreferences() {
  const { user, role } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, Preference>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const userRole = role || "client";
  const types = NOTIFICATION_TYPES_BY_ROLE[userRole] || [];

  useEffect(() => {
    if (!user) return;
    fetchPreferences();
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notification_preferences")
      .select("notification_type, in_app_enabled, email_enabled, sms_enabled")
      .eq("user_id", user.id);

    const map: Record<string, Preference> = {};
    (data || []).forEach((p: any) => {
      map[p.notification_type] = p;
    });

    // Fill defaults
    types.forEach((t) => {
      if (!map[t.type]) {
        map[t.type] = {
          notification_type: t.type,
          in_app_enabled: true,
          email_enabled: true,
          sms_enabled: false,
        };
      }
    });

    setPrefs(map);
    setLoading(false);
  };

  const togglePref = (type: string, channel: "in_app_enabled" | "email_enabled" | "sms_enabled") => {
    setPrefs((prev) => ({
      ...prev,
      [type]: { ...prev[type], [channel]: !prev[type]?.[channel] },
    }));
  };

  const savePreferences = async () => {
    if (!user) return;
    setSaving(true);

    const upsertData = Object.entries(prefs).map(([type, p]) => ({
      user_id: user.id,
      notification_type: type,
      category: types.find((t) => t.type === type)?.category || "general",
      in_app_enabled: p.in_app_enabled,
      email_enabled: p.email_enabled,
      sms_enabled: p.sms_enabled,
    }));

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(upsertData as any, { onConflict: "user_id,notification_type" });

    setSaving(false);
    if (error) {
      toast.error("فشل في حفظ التفضيلات");
    } else {
      toast.success("تم حفظ تفضيلات الإشعارات بنجاح");
    }
  };

  // Group types by category
  const grouped = types.reduce<Record<string, typeof types>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">تفضيلات الإشعارات</h2>
            <p className="text-sm text-muted-foreground">تحكم في طريقة استقبال الإشعارات</p>
          </div>
        </div>
        <Button onClick={savePreferences} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ
        </Button>
      </div>

      {/* Channel legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Bell className="w-3.5 h-3.5" /> داخل المنصة</span>
        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> بريد إلكتروني</span>
        <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> رسالة نصية</span>
      </div>

      {Object.entries(grouped).map(([category, catTypes]) => {
        const catDef = NOTIFICATION_CATEGORIES[category as keyof typeof NOTIFICATION_CATEGORIES];
        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {catDef?.label || category}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {catTypes.map((t) => {
                const p = prefs[t.type];
                if (!p) return null;
                return (
                  <div key={t.type} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-foreground">{t.label}</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                        <Switch
                          checked={p.in_app_enabled}
                          onCheckedChange={() => togglePref(t.type, "in_app_enabled")}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <Switch
                          checked={p.email_enabled}
                          onCheckedChange={() => togglePref(t.type, "email_enabled")}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                        <Switch
                          checked={p.sms_enabled}
                          onCheckedChange={() => togglePref(t.type, "sms_enabled")}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
