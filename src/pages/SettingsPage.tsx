import { Settings, Building2, UserCircle, FileText, Monitor, Database, Plug } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompanySettings from "@/components/settings/CompanySettings";
import ValuerSettings from "@/components/settings/ValuerSettings";
import ReportSettings from "@/components/settings/ReportSettings";
import SystemSettings from "@/components/settings/SystemSettings";
import BackupSettings from "@/components/settings/BackupSettings";
import IntegrationSettings from "@/components/settings/IntegrationSettings";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SettingsPage() {
  const { role, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isOwner = role === "owner";

  const ownerTabs = [
    { value: "company", label: t("companyData"), icon: Building2 },
    { value: "valuer", label: t("valuerData"), icon: UserCircle },
    { value: "reports", label: t("reportsSettings"), icon: FileText },
    { value: "system", label: t("system"), icon: Monitor },
    { value: "backup", label: t("backupSecurity"), icon: Database },
    { value: "integrations", label: t("integrations"), icon: Plug },
  ];

  const adminTabs = [
    { value: "valuer", label: t("myProfileTitle"), icon: UserCircle },
  ];

  const tabs = isOwner ? ownerTabs : adminTabs;
  const defaultTab = isOwner ? "company" : "valuer";
  const pageTitle = isOwner ? t("settingsTitle") : t("myProfileTitle");
  const pageDesc = isOwner ? t("settingsDesc") : t("myProfileDesc");

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

        <TabsContent value="valuer"><ValuerSettings /></TabsContent>
        {isOwner && (
          <>
            <TabsContent value="company"><CompanySettings /></TabsContent>
            <TabsContent value="reports"><ReportSettings /></TabsContent>
            <TabsContent value="system"><SystemSettings /></TabsContent>
            <TabsContent value="backup"><BackupSettings /></TabsContent>
            <TabsContent value="integrations"><IntegrationSettings /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
