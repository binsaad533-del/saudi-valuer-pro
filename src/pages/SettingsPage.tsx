import { Settings, User, Shield, FileText, Bell, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MyAccountSettings from "@/components/settings/MyAccountSettings";
import CompanySettings from "@/components/settings/CompanySettings";
import ValuerSettings from "@/components/settings/ValuerSettings";
import ReportSettings from "@/components/settings/ReportSettings";
import SystemSettings from "@/components/settings/SystemSettings";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import NotificationDeliveryLog from "@/components/notifications/NotificationDeliveryLog";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isOwner = role === "owner";

  if (!isOwner) {
    navigate("/account", { replace: true });
    return null;
  }

  const tabs = [
    { value: "account", label: "حسابي والمستخدمين", icon: User },
    { value: "company", label: "بيانات المنشأة", icon: Shield },
    { value: "templates", label: "القوالب والتقارير", icon: FileText },
    { value: "notifications", label: "الإشعارات", icon: Bell },
    { value: "system", label: "النظام", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
          <p className="text-sm text-muted-foreground">إدارة المستخدمين والقوالب والإشعارات والنظام</p>
        </div>
      </div>

      <Tabs defaultValue="account" dir="rtl">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-xl">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-2"
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Users & Roles */}
        <TabsContent value="account" className="space-y-6">
          <MyAccountSettings />
          <ValuerSettings isOwnerView={true} />
          <CompanySettings />
        </TabsContent>

        {/* Templates & Reports */}
        <TabsContent value="templates">
          <ReportSettings />
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <NotificationPreferences />
          <NotificationDeliveryLog />
        </TabsContent>

        {/* Company / Status */}
        <TabsContent value="company">
          <CompanySettings />
        </TabsContent>

        {/* System */}
        <TabsContent value="system">
          <SystemSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
