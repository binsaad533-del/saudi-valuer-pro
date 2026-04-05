import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, CreditCard, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface GatewaySettings {
  id: string;
  provider: string;
  is_active: boolean;
  environment: string;
  entity_id: string | null;
  entity_id_mada: string | null;
  entity_id_applepay: string | null;
  access_token: string | null;
  enabled_methods: string[];
  callback_url: string | null;
  return_url: string | null;
  failure_url: string | null;
}

const ALL_METHODS = [
  { value: "mada", label: "مدى (Mada)" },
  { value: "visa", label: "فيزا (Visa)" },
  { value: "mastercard", label: "ماستركارد (Mastercard)" },
  { value: "applepay", label: "آبل باي (Apple Pay)" },
  { value: "stcpay", label: "STC Pay" },
];

export default function PaymentGatewaySettings() {
  const [settings, setSettings] = useState<GatewaySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("payment_gateway_settings" as any)
      .select("*")
      .eq("provider", "hyperpay")
      .single();
    if (data) {
      setSettings(data as unknown as GatewaySettings);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("payment_gateway_settings" as any)
      .update({
        is_active: settings.is_active,
        environment: settings.environment,
        entity_id: settings.entity_id,
        entity_id_mada: settings.entity_id_mada,
        entity_id_applepay: settings.entity_id_applepay,
        access_token: settings.access_token,
        enabled_methods: settings.enabled_methods,
        callback_url: settings.callback_url,
        return_url: settings.return_url,
        failure_url: settings.failure_url,
      } as any)
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast.error("فشل في حفظ الإعدادات");
    } else {
      toast.success("تم حفظ إعدادات بوابة الدفع");
    }
  };

  const toggleMethod = (method: string) => {
    if (!settings) return;
    const methods = settings.enabled_methods.includes(method)
      ? settings.enabled_methods.filter((m) => m !== method)
      : [...settings.enabled_methods, method];
    setSettings({ ...settings, enabled_methods: methods });
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        لم يتم العثور على إعدادات بوابة الدفع
      </div>
    );
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/hyperpay-webhook`;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.is_active ? "bg-green-500/10" : "bg-muted"}`}>
                <CreditCard className={`w-5 h-5 ${settings.is_active ? "text-green-500" : "text-muted-foreground"}`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">HyperPay</h3>
                <p className="text-xs text-muted-foreground">بوابة الدفع الإلكتروني</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={settings.is_active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}>
                {settings.is_active ? "نشط" : "معطل"}
              </Badge>
              <Switch
                checked={settings.is_active}
                onCheckedChange={(v) => setSettings({ ...settings, is_active: v })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            إعدادات الاتصال
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>البيئة</Label>
            <Select
              value={settings.environment}
              onValueChange={(v) => setSettings({ ...settings, environment: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">تجريبي (Test)</SelectItem>
                <SelectItem value="production">إنتاج (Production)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Access Token</Label>
            <Input
              type="password"
              value={settings.access_token || ""}
              onChange={(e) => setSettings({ ...settings, access_token: e.target.value })}
              placeholder="OGE4Mjp..."
              dir="ltr"
              className="text-left font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Entity ID (عام)</Label>
              <Input
                value={settings.entity_id || ""}
                onChange={(e) => setSettings({ ...settings, entity_id: e.target.value })}
                placeholder="8ac7a4c..."
                dir="ltr"
                className="text-left font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Entity ID (مدى)</Label>
              <Input
                value={settings.entity_id_mada || ""}
                onChange={(e) => setSettings({ ...settings, entity_id_mada: e.target.value })}
                placeholder="8ac7a4c..."
                dir="ltr"
                className="text-left font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Entity ID (Apple Pay)</Label>
              <Input
                value={settings.entity_id_applepay || ""}
                onChange={(e) => setSettings({ ...settings, entity_id_applepay: e.target.value })}
                placeholder="8ac7a4c..."
                dir="ltr"
                className="text-left font-mono text-xs"
              />
            </div>
          </div>

          {settings.environment === "test" && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>الوضع التجريبي - لا يتم خصم مبالغ حقيقية</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            وسائل الدفع المفعلة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ALL_METHODS.map((method) => (
              <label
                key={method.value}
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                  settings.enabled_methods.includes(method.value)
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <Checkbox
                  checked={settings.enabled_methods.includes(method.value)}
                  onCheckedChange={() => toggleMethod(method.value)}
                />
                <span className="text-sm">{method.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* URLs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">روابط التكامل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                dir="ltr"
                className="text-left font-mono text-xs bg-muted/50"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("تم النسخ"); }}
              >
                نسخ
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">أضف هذا الرابط في إعدادات HyperPay كـ Webhook URL</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Return URL (نجاح)</Label>
              <Input
                value={settings.return_url || ""}
                onChange={(e) => setSettings({ ...settings, return_url: e.target.value })}
                placeholder="https://yourapp.com/payment/success"
                dir="ltr"
                className="text-left text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Failure URL (فشل)</Label>
              <Input
                value={settings.failure_url || ""}
                onChange={(e) => setSettings({ ...settings, failure_url: e.target.value })}
                placeholder="https://yourapp.com/payment/failed"
                dir="ltr"
                className="text-left text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        حفظ إعدادات بوابة الدفع
      </Button>
    </div>
  );
}
