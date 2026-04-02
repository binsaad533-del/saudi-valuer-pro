import { useState, useEffect } from "react";
import { Database, Download, Shield, Clock, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useOrgSettings } from "@/hooks/useOrgSettings";

const defaults = {
  autoBackup: true,
  backupFrequency: "daily",
  twoFactorAuth: false,
  auditLog: true,
};

export default function BackupSettings() {
  const { settings, loading, saving, save } = useOrgSettings("backup");
  const [form, setForm] = useState(defaults);

  useEffect(() => {
    if (!loading && Object.keys(settings).length > 0) {
      setForm({ ...defaults, ...settings });
    }
  }, [loading, settings]);

  const handleExport = (type: string) => {
    toast.success(`جاري تصدير البيانات بصيغة ${type}...`);
  };

  const handleSave = async () => {
    const ok = await save(form);
    if (ok) toast.success("تم حفظ إعدادات الأمان بنجاح");
  };

  const recentBackups = [
    { date: "2026-03-29", size: "245 MB", status: "success" },
    { date: "2026-03-28", size: "243 MB", status: "success" },
    { date: "2026-03-27", size: "240 MB", status: "success" },
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Database className="w-5 h-5 text-primary" />
            النسخ الاحتياطي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">نسخ احتياطي تلقائي</p>
              <p className="text-xs text-muted-foreground">إنشاء نسخ احتياطية بشكل دوري</p>
            </div>
            <Switch checked={form.autoBackup} onCheckedChange={v => setForm({ ...form, autoBackup: v })} />
          </div>
          {form.autoBackup && (
            <div className="space-y-2">
              <Label>تكرار النسخ</Label>
              <Select value={form.backupFrequency} onValueChange={v => setForm({ ...form, backupFrequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">يومي</SelectItem>
                  <SelectItem value="weekly">أسبوعي</SelectItem>
                  <SelectItem value="monthly">شهري</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="pt-2 space-y-2">
            <p className="text-sm font-medium text-foreground">آخر النسخ الاحتياطية</p>
            {recentBackups.map((b, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground" dir="ltr">{b.date}</span>
                  <span className="text-xs text-muted-foreground">{b.size}</span>
                </div>
                <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-0">مكتمل</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Download className="w-5 h-5 text-primary" />
            تصدير البيانات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => handleExport("CSV")}>
              <Download className="w-4 h-4 ml-2" /> تصدير CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport("Excel")}>
              <Download className="w-4 h-4 ml-2" /> تصدير Excel
            </Button>
            <Button variant="outline" onClick={() => handleExport("PDF")}>
              <Download className="w-4 h-4 ml-2" /> تصدير PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Shield className="w-5 h-5 text-primary" />
            الأمان
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">المصادقة الثنائية (2FA)</p>
              <p className="text-xs text-muted-foreground">طبقة حماية إضافية عند تسجيل الدخول</p>
            </div>
            <Switch checked={form.twoFactorAuth} onCheckedChange={v => setForm({ ...form, twoFactorAuth: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">سجل التدقيق</p>
              <p className="text-xs text-muted-foreground">تسجيل جميع العمليات والتغييرات</p>
            </div>
            <Switch checked={form.auditLog} onCheckedChange={v => setForm({ ...form, auditLog: v })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button onClick={handleSave} className="gap-2" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
}
