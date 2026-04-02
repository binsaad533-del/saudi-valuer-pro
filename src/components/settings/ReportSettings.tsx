import { useState, useEffect } from "react";
import { FileText, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useOrgSettings } from "@/hooks/useOrgSettings";

const defaults = {
  defaultLanguage: "ar",
  validityMonths: "3",
  numberPrefix: "VAL",
  showWatermark: true,
  autoNumber: true,
  defaultTemplate: "standard",
  showQr: true,
  footerText: "هذا التقرير سري ولا يجوز توزيعه أو نسخه دون إذن مسبق من شركة جساس للتقييم",
};

export default function ReportSettings() {
  const { settings, loading, saving, save } = useOrgSettings("reports");
  const [form, setForm] = useState(defaults);

  useEffect(() => {
    if (!loading && Object.keys(settings).length > 0) {
      setForm({ ...defaults, ...settings });
    }
  }, [loading, settings]);

  const handleSave = async () => {
    const ok = await save(form);
    if (ok) toast.success("تم حفظ إعدادات التقارير بنجاح");
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileText className="w-5 h-5 text-primary" />
            إعدادات عامة للتقارير
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اللغة الافتراضية</Label>
              <Select value={form.defaultLanguage} onValueChange={v => setForm({ ...form, defaultLanguage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="both">ثنائي اللغة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>مدة صلاحية التقرير (أشهر)</Label>
              <Select value={form.validityMonths} onValueChange={v => setForm({ ...form, validityMonths: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 أشهر</SelectItem>
                  <SelectItem value="6">6 أشهر</SelectItem>
                  <SelectItem value="12">12 شهراً</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>القالب الافتراضي</Label>
              <Select value={form.defaultTemplate} onValueChange={v => setForm({ ...form, defaultTemplate: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">قالب قياسي</SelectItem>
                  <SelectItem value="bank">قالب بنكي</SelectItem>
                  <SelectItem value="detailed">قالب تفصيلي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>بادئة الترقيم</Label>
              <Input value={form.numberPrefix} onChange={e => setForm({ ...form, numberPrefix: e.target.value })} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">خيارات إضافية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">ترقيم تلقائي للتقارير</p>
              <p className="text-xs text-muted-foreground">إنشاء رقم مرجعي تلقائياً عند إنشاء تقرير جديد</p>
            </div>
            <Switch checked={form.autoNumber} onCheckedChange={v => setForm({ ...form, autoNumber: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">علامة مائية على المسودات</p>
              <p className="text-xs text-muted-foreground">إضافة علامة "مسودة" على التقارير غير النهائية</p>
            </div>
            <Switch checked={form.showWatermark} onCheckedChange={v => setForm({ ...form, showWatermark: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">رمز QR للتحقق</p>
              <p className="text-xs text-muted-foreground">إضافة رمز QR لتحقق الأصالة في كل تقرير</p>
            </div>
            <Switch checked={form.showQr} onCheckedChange={v => setForm({ ...form, showQr: v })} />
          </div>
          <div className="space-y-2">
            <Label>نص الذيل الافتراضي</Label>
            <Input value={form.footerText} onChange={e => setForm({ ...form, footerText: e.target.value })} />
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
