import { useState, useEffect } from "react";
import { Monitor, Save, Moon, Sun, Bell, Users, Globe, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "super_admin" | "firm_admin" | "valuer" | "reviewer" | "client" | "auditor" | "inspector";

interface RoleUser {
  user_id: string;
  email: string;
  full_name_ar: string;
}

const roleConfig: { role: AppRole; name: string; nameEn: string; color: "destructive" | "default" | "secondary" | "outline" }[] = [
  { role: "super_admin", name: "مدير النظام", nameEn: "Super Admin", color: "destructive" },
  { role: "firm_admin", name: "مدير الشركة", nameEn: "Firm Admin", color: "default" },
  { role: "valuer", name: "مقيّم معتمد", nameEn: "Valuer", color: "default" },
  { role: "reviewer", name: "مراجع", nameEn: "Reviewer", color: "secondary" },
  { role: "inspector", name: "معاين", nameEn: "Inspector", color: "secondary" },
  { role: "client", name: "عميل", nameEn: "Client", color: "outline" },
  { role: "auditor", name: "مدقق", nameEn: "Auditor", color: "outline" },
];

export default function SystemSettings() {
  const [form, setForm] = useState({
    language: "ar",
    theme: "light",
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    sessionTimeout: "60",
  });

  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [selectedRole, setSelectedRole] = useState<typeof roleConfig[0] | null>(null);
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    fetchRoleCounts();
  }, []);

  const fetchRoleCounts = async () => {
    const { data } = await supabase.from("user_roles").select("role");
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach(r => { counts[r.role] = (counts[r.role] || 0) + 1; });
      setRoleCounts(counts);
    }
  };

  const openRoleDialog = async (role: typeof roleConfig[0]) => {
    setSelectedRole(role);
    setLoadingUsers(true);
    setNewEmail("");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", role.role);

    if (roleData && roleData.length > 0) {
      const userIds = roleData.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name_ar, email")
        .in("user_id", userIds);

      setRoleUsers(
        (profiles || []).map(p => ({
          user_id: p.user_id,
          full_name_ar: p.full_name_ar || "—",
          email: p.email || "—",
        }))
      );
    } else {
      setRoleUsers([]);
    }
    setLoadingUsers(false);
  };

  const handleAddUserToRole = async () => {
    if (!newEmail.trim() || !selectedRole) return;
    setAddingUser(true);
    try {
      // Find user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name_ar, email")
        .eq("email", newEmail.trim())
        .single();

      if (profileError || !profile) {
        toast.error("لم يتم العثور على مستخدم بهذا البريد");
        return;
      }

      // Check if already has this role
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("role", selectedRole.role)
        .maybeSingle();

      if (existing) {
        toast.error("المستخدم لديه هذا الدور بالفعل");
        return;
      }

      const { error } = await supabase.from("user_roles").insert({
        user_id: profile.user_id,
        role: selectedRole.role,
      });

      if (error) throw error;

      toast.success("تمت إضافة الدور بنجاح");
      setNewEmail("");
      await openRoleDialog(selectedRole);
      await fetchRoleCounts();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUserFromRole = async (userId: string) => {
    if (!selectedRole) return;
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", selectedRole.role);

      if (error) throw error;

      toast.success("تم إزالة الدور بنجاح");
      await openRoleDialog(selectedRole);
      await fetchRoleCounts();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    }
  };

  const handleSave = () => {
    toast.success("تم حفظ إعدادات النظام بنجاح");
  };

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
            {roleConfig.map(role => (
              <div key={role.role} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{role.name}</p>
                  <p className="text-xs text-muted-foreground">{role.nameEn}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={role.color}>{roleCounts[role.role] || 0} مستخدم</Badge>
                  <Button variant="ghost" size="sm" onClick={() => openRoleDialog(role)}>إدارة</Button>
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

      {/* Role Management Dialog */}
      <Dialog open={!!selectedRole} onOpenChange={open => !open && setSelectedRole(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إدارة دور: {selectedRole?.name}</DialogTitle>
          </DialogHeader>

          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add user */}
              <div className="flex gap-2">
                <Input
                  placeholder="البريد الإلكتروني للمستخدم"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  dir="ltr"
                  className="flex-1"
                />
                <Button size="sm" onClick={handleAddUserToRole} disabled={addingUser || !newEmail.trim()}>
                  {addingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>

              {/* Users list */}
              {roleUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا يوجد مستخدمون بهذا الدور</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {roleUsers.map(user => (
                    <div key={user.user_id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background">
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.full_name_ar}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{user.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveUserFromRole(user.user_id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
