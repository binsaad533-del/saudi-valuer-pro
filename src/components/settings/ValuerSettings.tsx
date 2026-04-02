import { useState, useRef } from "react";
import { UserCircle, Upload, Save, PenTool, Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfileSettings, uploadSettingsFile } from "@/hooks/useOrgSettings";

interface ValuerSettingsProps {
  isOwnerView?: boolean;
}

export default function ValuerSettings({ isOwnerView = true }: ValuerSettingsProps) {
  const { profile, loading, saving, save, userId } = useProfileSettings();
  const [localProfile, setLocalProfile] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Sync once from DB
  if (!initialized && !loading && profile.user_id) {
    setLocalProfile(profile);
    setInitialized(true);
  }

  const update = (key: string, val: string) => setLocalProfile(prev => ({ ...prev, [key]: val }));

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    folder: string,
    field: string,
    setUploading: (v: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("الحد الأقصى 2 ميغابايت"); return; }
    setUploading(true);
    const url = await uploadSettingsFile(file, folder, userId);
    if (url) {
      setLocalProfile(prev => ({ ...prev, [field]: url }));
      toast.success("تم الرفع بنجاح");
    }
    setUploading(false);
  };

  const handleSaveAll = async () => {
    // Save password if provided (for non-owner view)
    if (!isOwnerView && newPassword) {
      if (newPassword.length < 6) {
        toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("كلمتا المرور غير متطابقتين");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error("فشل تحديث كلمة المرور");
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
    }

    if (isOwnerView) {
      const ok = await save({
        full_name_ar: localProfile.full_name_ar,
        full_name_en: localProfile.full_name_en,
        taqeem_membership: localProfile.taqeem_membership,
        taqeem_membership_machinery: localProfile.taqeem_membership_machinery,
        specialization: localProfile.specialization,
        phone: localProfile.phone,
        email: localProfile.email,
        avatar_url: localProfile.avatar_url,
        signature_url: localProfile.signature_url,
      });
      if (ok) toast.success("تم حفظ بيانات المقيّم بنجاح");
    } else {
      const ok = await save({
        full_name_ar: localProfile.full_name_ar,
        full_name_en: localProfile.full_name_en,
        phone: localProfile.phone,
      });
      if (ok) toast.success("تم حفظ البيانات بنجاح");
    }
  };


  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  // Simplified view for non-owner roles (coordinator, financial manager)
  if (!isOwnerView) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <UserCircle className="w-5 h-5 text-primary" />
              البيانات الشخصية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم الكامل (عربي)</Label>
                <Input value={localProfile.full_name_ar || ""} onChange={e => update("full_name_ar", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Full Name (English)</Label>
                <Input value={localProfile.full_name_en || ""} onChange={e => update("full_name_en", e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input value={localProfile.phone || ""} onChange={e => update("phone", e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input value={localProfile.email || ""} disabled dir="ltr" className="bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Lock className="w-5 h-5 text-primary" />
              تغيير كلمة المرور
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>كلمة المرور الجديدة</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} dir="ltr" placeholder="••••••••" />
              </div>
              <div className="space-y-2">
                <Label>تأكيد كلمة المرور</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} dir="ltr" placeholder="••••••••" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-start">
          <Button onClick={handleSaveAll} className="gap-2" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ البيانات
          </Button>
        </div>
      </div>
    );
  }

  // Full view for owner
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <UserCircle className="w-5 h-5 text-primary" />
            الصورة الشخصية والتوقيع
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden">
                {localProfile.avatar_url ? (
                  <img src={localProfile.avatar_url} alt="صورة شخصية" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <input ref={avatarRef} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={e => handleFileUpload(e, "avatars", "avatar_url", setUploadingAvatar)} />
              <Button variant="outline" size="sm" onClick={() => avatarRef.current?.click()} disabled={uploadingAvatar}>
                {uploadingAvatar ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Upload className="w-4 h-4 ml-2" />}
                رفع الصورة
              </Button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-40 h-24 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden">
                {localProfile.signature_url ? (
                  <img src={localProfile.signature_url} alt="التوقيع" className="w-full h-full object-contain" />
                ) : (
                  <PenTool className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <input ref={signatureRef} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={e => handleFileUpload(e, "signatures", "signature_url", setUploadingSignature)} />
              <Button variant="outline" size="sm" onClick={() => signatureRef.current?.click()} disabled={uploadingSignature}>
                {uploadingSignature ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Upload className="w-4 h-4 ml-2" />}
                رفع التوقيع الرقمي
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">البيانات المهنية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الاسم الكامل (عربي)</Label>
              <Input value={localProfile.full_name_ar || ""} onChange={e => update("full_name_ar", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Full Name (English)</Label>
              <Input value={localProfile.full_name_en || ""} onChange={e => update("full_name_en", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>عضوية تقييم - عقارات</Label>
              <Input value={localProfile.taqeem_membership || ""} onChange={e => update("taqeem_membership", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>عضوية تقييم - آلات ومعدات</Label>
              <Input value={localProfile.taqeem_membership_machinery || ""} onChange={e => update("taqeem_membership_machinery", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>التخصص الرئيسي</Label>
              <Select value={localProfile.specialization || "real_estate"} onValueChange={v => update("specialization", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="real_estate">تقييم عقاري</SelectItem>
                  <SelectItem value="machinery">آلات ومعدات</SelectItem>
                  <SelectItem value="both">كلاهما</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input value={localProfile.phone || ""} onChange={e => update("phone", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={localProfile.email || ""} onChange={e => update("email", e.target.value)} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button onClick={handleSaveAll} className="gap-2" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ البيانات
        </Button>
      </div>
    </div>
  );
}
