import { useState } from "react";
import { Monitor, Save, Moon, Sun, Bell, Users, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function SystemSettings() {
  const [form, setForm] = useState({
    language: "ar",
    theme: "light",
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    sessionTimeout: "60",
  });

  const handleSave = () => {
    toast.success("تم حفظ إعدادات النظام بنجاح");
  };

  const roles = [
    { name: "مدير النظام", nameEn: "Super Admin", count: 1, color: "destructive" as const },
    { name: "مقيّم معتمد", nameEn: "Valuer", count: 3, color: "default" as const },
    { name: "مراجع", nameEn: "Reviewer", count: 2, color: "secondary" as const },
    { name: "عميل", nameEn: "Client", count: 15, color: "outline" as const },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Monitor className="w-5 h-5 text-primary" />
            العرض واللغة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="w-4 h-4" /> لغة الواجهة
              </Label>
              <Select value={form.language} onValueChange={v => setForm({ ...form, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {form.theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                المظهر
              </Label>
              <Select value={form.theme} onValueChange={v => setForm({ ...form, theme: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">فاتح</SelectItem>
                  <SelectItem value="dark">داكن</SelectItem>
                  <SelectItem value="auto">تلقائي (حسب النظام)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>مهلة انتهاء الجلسة (دقيقة)</Label>
              <Select value={form.sessionTimeout} onValueChange={v => setForm({ ...form, sessionTimeout: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 دقيقة</SelectItem>
                  <SelectItem value="60">ساعة واحدة</SelectItem>
                  <SelectItem value="120">ساعتان</SelectItem>
                  <SelectItem value="480">8 ساعات</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Bell className="w-5 h-5 text-primary" />
            الإشعارات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">إشعارات البريد الإلكتروني</p>
              <p className="text-xs text-muted-foreground">إرسال تحديثات عبر البريد</p>
            </div>
            <Switch checked={form.emailNotifications} onCheckedChange={v => setForm({ ...form, emailNotifications: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">إشعارات SMS</p>
              <p className="text-xs text-muted-foreground">رسائل نصية للتنبيهات المهمة</p>
            </div>
            <Switch checked={form.smsNotifications} onCheckedChange={v => setForm({ ...form, smsNotifications: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">إشعارات المتصفح</p>
              <p className="text-xs text-muted-foreground">تنبيهات فورية في المتصفح</p>
            </div>
            <Switch checked={form.pushNotifications} onCheckedChange={v => setForm({ ...form, pushNotifications: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5 text-primary" />
            الأدوار والصلاحيات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roles.map(role => (
              <div key={role.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{role.name}</p>
                  <p className="text-xs text-muted-foreground">{role.nameEn}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={role.color}>{role.count} مستخدم</Badge>
                  <Button variant="ghost" size="sm">إدارة</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" />
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
}
