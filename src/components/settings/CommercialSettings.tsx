import { useState, useEffect } from "react";
import { getCommercialSettings, updateCommercialSettings, type CommercialSettings as CS } from "@/lib/commercial-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Settings } from "lucide-react";
import { toast } from "sonner";

export default function CommercialSettingsPanel() {
  const [settings, setSettings] = useState<CS | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCommercialSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await updateCommercialSettings(settings);
    setSaving(false);
    if (error) {
      toast.error("فشل في حفظ الإعدادات");
    } else {
      toast.success("تم حفظ الإعدادات التجارية");
    }
  };

  if (loading || !settings) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          الإعدادات التجارية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>سياسة إصدار التقرير</Label>
          <Select
            value={settings.report_release_policy}
            onValueChange={(v) => setSettings({ ...settings, report_release_policy: v as CS["report_release_policy"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anytime">إصدار في أي وقت (بدون شرط دفع)</SelectItem>
              <SelectItem value="require_payment">يتطلب الدفع الكامل قبل الإصدار</SelectItem>
              <SelectItem value="require_approval">يتطلب موافقة المالك قبل الإصدار</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            تحدد هذه السياسة متى يمكن إصدار التقرير النهائي
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>نسبة ضريبة القيمة المضافة (%)</Label>
            <Input
              type="number"
              value={settings.vat_percentage}
              onChange={(e) => setSettings({ ...settings, vat_percentage: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label>صلاحية عرض السعر (أيام)</Label>
            <Input
              type="number"
              value={settings.default_validity_days}
              onChange={(e) => setSettings({ ...settings, default_validity_days: parseInt(e.target.value) || 14 })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label>السماح بالدفع الجزئي</Label>
            <p className="text-[10px] text-muted-foreground">تفعيل الدفع على مراحل</p>
          </div>
          <Switch
            checked={settings.allow_partial_payment}
            onCheckedChange={(v) => setSettings({ ...settings, allow_partial_payment: v })}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ الإعدادات التجارية
        </Button>
      </CardContent>
    </Card>
  );
}
