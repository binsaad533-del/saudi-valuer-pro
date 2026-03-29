import { useState } from "react";
import { Plug, CreditCard, Key, ExternalLink, Save, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Integration {
  name: string;
  nameEn: string;
  description: string;
  connected: boolean;
  icon: string;
}

export default function IntegrationSettings() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    { name: "بوابة الدفع", nameEn: "Payment Gateway", description: "ربط بوابة الدفع لتحصيل رسوم التقييم", connected: true, icon: "💳" },
    { name: "خرائط Google", nameEn: "Google Maps", description: "عرض مواقع العقارات والمقارنات على الخريطة", connected: true, icon: "🗺️" },
    { name: "وزارة العدل", nameEn: "MOJ API", description: "الربط مع بيانات الصكوك والملكيات", connected: false, icon: "🏛️" },
    { name: "البريد الإلكتروني", nameEn: "Email Service", description: "إرسال التقارير والإشعارات عبر البريد", connected: true, icon: "📧" },
    { name: "التوقيع الإلكتروني", nameEn: "E-Signature", description: "توقيع التقارير إلكترونياً", connected: false, icon: "✍️" },
  ]);

  const toggleConnection = (index: number) => {
    const updated = [...integrations];
    updated[index].connected = !updated[index].connected;
    setIntegrations(updated);
    toast.success(updated[index].connected ? `تم ربط ${updated[index].name}` : `تم فصل ${updated[index].name}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Plug className="w-5 h-5 text-primary" />
            الأنظمة الخارجية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrations.map((intg, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-4">
                <span className="text-2xl">{intg.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{intg.name}</p>
                    {intg.connected ? (
                      <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px]">
                        <CheckCircle2 className="w-3 h-3 ml-1" /> متصل
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        <XCircle className="w-3 h-3 ml-1" /> غير متصل
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{intg.description}</p>
                </div>
              </div>
              <Button
                variant={intg.connected ? "outline" : "default"}
                size="sm"
                onClick={() => toggleConnection(idx)}
              >
                {intg.connected ? "فصل" : "ربط"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Key className="w-5 h-5 text-primary" />
            مفاتيح API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>مفتاح API للخرائط</Label>
            <div className="flex gap-2">
              <Input type="password" value="••••••••••••••••" readOnly className="flex-1" dir="ltr" />
              <Button variant="outline" size="sm">تعديل</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>مفتاح بوابة الدفع</Label>
            <div className="flex gap-2">
              <Input type="password" value="••••••••••••••••" readOnly className="flex-1" dir="ltr" />
              <Button variant="outline" size="sm">تعديل</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">⚠️ لا تشارك مفاتيح API مع أي شخص. يتم تخزينها بشكل مشفّر.</p>
        </CardContent>
      </Card>
    </div>
  );
}
