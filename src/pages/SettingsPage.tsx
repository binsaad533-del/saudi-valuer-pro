import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">صفحة الإعدادات العامة - قيد التطوير</p>
      </div>
    </div>
  );
}
