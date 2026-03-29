import { Shield } from "lucide-react";

export default function CompliancePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">الامتثال</h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">صفحة الامتثال والتوافق التنظيمي - قيد التطوير</p>
      </div>
    </div>
  );
}
