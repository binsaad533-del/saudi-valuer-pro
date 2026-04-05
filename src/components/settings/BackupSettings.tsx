import { useState, useEffect } from "react";
import {
  Database, Download, Shield, Clock, Save, Loader2,
  AlertTriangle, Eye, Smartphone, Lock, Bell, CheckCircle2,
  XCircle, Activity, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const defaults = {
  autoBackup: true,
  backupFrequency: "daily",
  twoFactorAuth: false,
  auditLog: true,
  maxLoginAttempts: 5,
  sessionTimeout: 60,
  softDeleteEnabled: true,
  securityAlerts: true,
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  low: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "حرج",
  high: "مرتفع",
  medium: "متوسط",
  low: "منخفض",
};

export default function BackupSettings() {
  const { settings, loading, saving, save } = useOrgSettings("backup");
  const [form, setForm] = useState(defaults);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!loading && Object.keys(settings).length > 0) {
      setForm({ ...defaults, ...settings });
    }
  }, [loading, settings]);

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    setLoadingData(true);
    try {
      const [alertsRes, loginsRes, sessionsRes] = await Promise.all([
        supabase.from("security_alerts").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("login_attempts").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("active_sessions").select("*").order("last_active_at", { ascending: false }).limit(20),
      ]);
      setAlerts(alertsRes.data ?? []);
      setLoginAttempts(loginsRes.data ?? []);
      setSessions(sessionsRes.data ?? []);
    } catch {
      // Silently fail if tables not accessible
    } finally {
      setLoadingData(false);
    }
  };

  const handleExport = (type: string) => {
    toast.success(`جاري تصدير البيانات بصيغة ${type}...`);
  };

  const handleSave = async () => {
    const ok = await save(form);
    if (ok) toast.success("تم حفظ إعدادات الأمان بنجاح");
  };

  const markAlertRead = async (alertId: string) => {
    await supabase.from("security_alerts").update({ is_read: true }).eq("id", alertId);
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)));
  };

  const terminateSession = async (sessionId: string) => {
    await supabase.from("active_sessions").delete().eq("id", sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast.success("تم إنهاء الجلسة");
  };

  const recentBackups = [
    { date: "2026-04-05", size: "248 MB", type: "incremental", status: "success" },
    { date: "2026-04-04", size: "245 MB", type: "incremental", status: "success" },
    { date: "2026-03-30", size: "1.2 GB", type: "full", status: "success" },
    { date: "2026-03-29", size: "243 MB", type: "incremental", status: "success" },
  ];

  const unreadAlerts = alerts.filter((a) => !a.is_read).length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">تنبيهات</span>
          </div>
          <p className="text-2xl font-bold mt-1">{unreadAlerts}</p>
          <p className="text-xs text-muted-foreground">غير مقروءة</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm">
            <Lock className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">محاولات</span>
          </div>
          <p className="text-2xl font-bold mt-1">{loginAttempts.filter((l) => !l.success).length}</p>
          <p className="text-xs text-muted-foreground">فاشلة</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm">
            <Smartphone className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">جلسات</span>
          </div>
          <p className="text-2xl font-bold mt-1">{sessions.length}</p>
          <p className="text-xs text-muted-foreground">نشطة</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">نسخ</span>
          </div>
          <p className="text-2xl font-bold mt-1">{recentBackups.length}</p>
          <p className="text-xs text-muted-foreground">احتياطية</p>
        </Card>
      </div>

      <Tabs defaultValue="backup" dir="rtl">
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50">
          <TabsTrigger value="backup" className="text-xs gap-1"><Database className="w-3.5 h-3.5" /> النسخ الاحتياطي</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs gap-1">
            <Bell className="w-3.5 h-3.5" /> التنبيهات
            {unreadAlerts > 0 && <Badge variant="destructive" className="h-4 px-1 text-[10px]">{unreadAlerts}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="logins" className="text-xs gap-1"><Activity className="w-3.5 h-3.5" /> سجل الدخول</TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs gap-1"><Smartphone className="w-3.5 h-3.5" /> الجلسات</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs gap-1"><Shield className="w-3.5 h-3.5" /> الإعدادات</TabsTrigger>
        </TabsList>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" /> إدارة النسخ الاحتياطي
                </CardTitle>
                <Button size="sm" variant="outline" className="text-xs gap-1">
                  <RefreshCw className="w-3 h-3" /> نسخ يدوي الآن
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">نسخ احتياطي تلقائي</p>
                  <p className="text-xs text-muted-foreground">يومي تزايدي + أسبوعي كامل</p>
                </div>
                <Switch checked={form.autoBackup} onCheckedChange={(v) => setForm({ ...form, autoBackup: v })} />
              </div>
              {form.autoBackup && (
                <div className="space-y-2">
                  <Label className="text-xs">تكرار النسخ الكامل</Label>
                  <Select value={form.backupFrequency} onValueChange={(v) => setForm({ ...form, backupFrequency: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="weekly">أسبوعي</SelectItem>
                      <SelectItem value="monthly">شهري</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="pt-2 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">آخر النسخ الاحتياطية</p>
                {recentBackups.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span dir="ltr">{b.date}</span>
                      <span className="text-muted-foreground">{b.size}</span>
                      <Badge variant="outline" className="text-[10px] h-4">{b.type === "full" ? "كامل" : "تزايدي"}</Badge>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600 border-0 text-[10px]">مكتمل</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" /> تصدير البيانات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleExport("CSV")}>
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleExport("Excel")}>
                  <Download className="w-3.5 h-3.5" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleExport("PDF")}>
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-3 mt-4">
          {alerts.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد تنبيهات أمنية</p>
            </Card>
          ) : (
            alerts.map((alert) => (
              <Card key={alert.id} className={`border ${alert.is_read ? "opacity-60" : ""}`}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                        alert.severity === "critical" ? "text-destructive" :
                        alert.severity === "high" ? "text-orange-500" : "text-amber-500"
                      }`} />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{alert.title}</p>
                          <Badge variant="outline" className={`text-[10px] h-4 ${SEVERITY_STYLES[alert.severity] || ""}`}>
                            {SEVERITY_LABELS[alert.severity] || alert.severity}
                          </Badge>
                        </div>
                        {alert.description && (
                          <p className="text-xs text-muted-foreground">{alert.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(alert.created_at), "dd MMM yyyy HH:mm", { locale: ar })}
                        </p>
                      </div>
                    </div>
                    {!alert.is_read && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markAlertRead(alert.id)}>
                        <Eye className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Login Attempts Tab */}
        <TabsContent value="logins" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loginAttempts.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">لا توجد محاولات دخول مسجلة</div>
              ) : (
                <div className="divide-y">
                  {loginAttempts.map((attempt) => (
                    <div key={attempt.id} className="flex items-center justify-between p-3 text-xs">
                      <div className="flex items-center gap-2">
                        {attempt.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                        <span className="font-medium" dir="ltr">{attempt.email}</span>
                        {attempt.ip_address && (
                          <span className="text-muted-foreground" dir="ltr">{attempt.ip_address}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!attempt.success && attempt.failure_reason && (
                          <Badge variant="outline" className="text-[10px] text-destructive">{attempt.failure_reason}</Badge>
                        )}
                        <span className="text-muted-foreground">
                          {format(new Date(attempt.created_at), "dd/MM HH:mm")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-3 mt-4">
          {sessions.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">لا توجد جلسات نشطة</Card>
          ) : (
            sessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">{session.device_info || "جهاز غير معروف"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {session.ip_address && <span dir="ltr">{session.ip_address} · </span>}
                        آخر نشاط: {format(new Date(session.last_active_at), "dd MMM HH:mm", { locale: ar })}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs text-destructive h-7" onClick={() => terminateSession(session.id)}>
                    إنهاء
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Security Settings Tab */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> إعدادات الأمان
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">المصادقة الثنائية (OTP)</p>
                  <p className="text-xs text-muted-foreground">رمز تحقق إضافي عبر الهاتف عند الدخول</p>
                </div>
                <Switch checked={form.twoFactorAuth} onCheckedChange={(v) => setForm({ ...form, twoFactorAuth: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">سجل التدقيق</p>
                  <p className="text-xs text-muted-foreground">تسجيل جميع العمليات والتغييرات</p>
                </div>
                <Switch checked={form.auditLog} onCheckedChange={(v) => setForm({ ...form, auditLog: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">تنبيهات أمنية</p>
                  <p className="text-xs text-muted-foreground">إشعار المالك عند أحداث أمنية مشبوهة</p>
                </div>
                <Switch checked={form.securityAlerts} onCheckedChange={(v) => setForm({ ...form, securityAlerts: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">الحذف الناعم</p>
                  <p className="text-xs text-muted-foreground">أرشفة البيانات بدلاً من الحذف النهائي</p>
                </div>
                <Switch checked={form.softDeleteEnabled} onCheckedChange={(v) => setForm({ ...form, softDeleteEnabled: v })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">مهلة الجلسة (دقائق)</Label>
                <Select value={String(form.sessionTimeout)} onValueChange={(v) => setForm({ ...form, sessionTimeout: Number(v) })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 دقيقة</SelectItem>
                    <SelectItem value="60">ساعة</SelectItem>
                    <SelectItem value="120">ساعتان</SelectItem>
                    <SelectItem value="480">8 ساعات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-start">
            <Button onClick={handleSave} className="gap-2 text-sm" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ الإعدادات
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
