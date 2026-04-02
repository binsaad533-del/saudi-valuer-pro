import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Settings, User, Lock, Save, Loader2, ArrowRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function UserSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile fields
  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userType, setUserType] = useState("external");

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [userId, setUserId] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name_ar, full_name_en, phone, user_type")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setFullNameAr(profile.full_name_ar || "");
        setFullNameEn(profile.full_name_en || "");
        setPhone(profile.phone || "");
        setUserType(profile.user_type || "external");
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSaveProfile = async () => {
    if (!fullNameAr.trim()) {
      toast.error("الاسم بالعربي مطلوب");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name_ar: fullNameAr.trim(),
          full_name_en: fullNameEn.trim() || null,
          phone: phone.trim() || null,
          user_type: userType,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;
      toast.success("تم حفظ البيانات بنجاح");
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ في الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmail = async () => {
    const newEmail = prompt("أدخل البريد الإلكتروني الجديد:");
    if (!newEmail || !newEmail.includes("@")) return;
    
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success("تم إرسال رابط التأكيد إلى بريدك الجديد");
    } catch (err: any) {
      toast.error(err.message || "فشل في تحديث البريد");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمات المرور غير متطابقة");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("تم تغيير كلمة المرور بنجاح");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "فشل في تغيير كلمة المرور");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 sm:p-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">إعدادات الحساب</h1>
          <p className="text-sm text-muted-foreground">تعديل المعلومات الشخصية وكلمة المرور</p>
        </div>
      </div>

      {/* Personal Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            المعلومات الشخصية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الاسم بالعربي *</Label>
              <Input value={fullNameAr} onChange={e => setFullNameAr(e.target.value)} placeholder="الاسم الكامل" />
            </div>
            <div className="space-y-2">
              <Label>الاسم بالإنجليزي</Label>
              <Input value={fullNameEn} onChange={e => setFullNameEn(e.target.value)} placeholder="Full Name" dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <div className="flex gap-2">
                <Input value={email} readOnly className="bg-muted" dir="ltr" />
                <Button variant="outline" size="sm" onClick={handleUpdateEmail} className="shrink-0">
                  تغيير
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>رقم الجوال</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>نوع الحساب</Label>
            <Select value={userType} onValueChange={setUserType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="external">فرد</SelectItem>
                <SelectItem value="corporate">شركة / مؤسسة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
            حفظ التغييرات
          </Button>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            تغيير كلمة المرور
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>تأكيد كلمة المرور</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" dir="ltr" />
            </div>
          </div>

          <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} variant="outline" className="w-full sm:w-auto">
            {changingPassword ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Lock className="w-4 h-4 ml-2" />}
            تغيير كلمة المرور
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
