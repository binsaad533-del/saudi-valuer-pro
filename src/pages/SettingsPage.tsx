import { Settings, Building2, UserCircle, FileText, Monitor, Database, Plug } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompanySettings from "@/components/settings/CompanySettings";
import ValuerSettings from "@/components/settings/ValuerSettings";
import ReportSettings from "@/components/settings/ReportSettings";
import SystemSettings from "@/components/settings/SystemSettings";
import BackupSettings from "@/components/settings/BackupSettings";
import IntegrationSettings from "@/components/settings/IntegrationSettings";
import { useAuth } from "@/hooks/useAuth";

const ownerTabs = [
  { value: "company", label: "بيانات الشركة", icon: Building2 },
  { value: "valuer", label: "بيانات المقيّم", icon: UserCircle },
  { value: "reports", label: "التقارير", icon: FileText },
  { value: "system", label: "النظام", icon: Monitor },
  { value: "backup", label: "النسخ والأمان", icon: Database },
  { value: "integrations", label: "التكاملات", icon: Plug },
];

const adminTabs = [
  { value: "valuer", label: "بياناتي", icon: UserCircle },
];

export default function SettingsPage() {
  const { role } = useAuth();
  const isOwner = role === "super_admin";
  const tabs = isOwner ? ownerTabs : adminTabs;
  const defaultTab = isOwner ? "company" : "valuer";
  const pageTitle = isOwner ? "الإعدادات" : "إعدادات الحساب";
  const pageDesc = isOwner ? "إدارة إعدادات المنصة والشركة والتقارير" : "تعديل بياناتك الشخصية";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{pageDesc}</p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} dir="rtl">
        {tabs.length > 1 && (
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
        )}

        <TabsContent value="company"><CompanySettings /></TabsContent>
        <TabsContent value="valuer"><ValuerSettings /></TabsContent>
        <TabsContent value="reports"><ReportSettings /></TabsContent>
        <TabsContent value="system"><SystemSettings /></TabsContent>
        <TabsContent value="backup"><BackupSettings /></TabsContent>
        <TabsContent value="integrations"><IntegrationSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
