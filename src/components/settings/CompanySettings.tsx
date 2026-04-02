import { useState, useEffect, useRef } from "react";
import { Building2, Upload, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfileSettings, uploadSettingsFile } from "@/hooks/useOrgSettings";

export default function CompanySettings() {
  const { profile, loading: profileLoading, userId } = useProfileSettings();
  const [orgData, setOrgData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      if (!profile.organization_id) { setLoading(false); return; }
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", profile.organization_id)
        .maybeSingle();
      if (data) {
        setOrgData(data);
        setLogoUrl(data.logo_url);
      }
      setLoading(false);
    };
    if (!profileLoading) load();
  }, [profileLoading, profile.organization_id]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("الحد الأقصى 2 ميغابايت"); return; }
    setUploading(true);
    const url = await uploadSettingsFile(file, "logos", userId);
    if (url) {
      setLogoUrl(url);
      toast.success("تم رفع الشعار بنجاح");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!profile.organization_id) return;
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name_ar: orgData.name_ar,
        name_en: orgData.name_en,
        cr_number: orgData.cr_number,
        taqeem_registration: orgData.taqeem_registration,
        phone: orgData.phone,
        email: orgData.email,
        website: orgData.website,
        address_ar: orgData.address_ar,
        address_en: orgData.address_en,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.organization_id);

    setSaving(false);
    if (error) { toast.error("حدث خطأ: " + error.message); return; }
    toast.success("تم حفظ بيانات الشركة بنجاح");
  };

  if (loading || profileLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const update = (key: string, val: string) => setOrgData(prev => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Building2 className="w-5 h-5 text-primary" />
            الهوية والشعار
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="شعار الشركة" className="w-full h-full object-contain" />
              ) : (
                <Upload className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input ref={fileInputRef} type="file" accept=".png,.svg,.jpg,.jpeg" className="hidden" onChange={handleLogoUpload} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Upload className="w-4 h-4 ml-2" />}
                رفع الشعار
              </Button>
              <p className="text-xs text-muted-foreground">PNG أو SVG، بحد أقصى 2 ميغابايت</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">البيانات الأساسية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم الشركة (عربي)</Label>
              <Input value={orgData.name_ar || ""} onChange={e => update("name_ar", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Company Name (English)</Label>
              <Input value={orgData.name_en || ""} onChange={e => update("name_en", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>رقم السجل التجاري</Label>
              <Input value={orgData.cr_number || ""} onChange={e => update("cr_number", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>رقم ترخيص تقييم</Label>
              <Input value={orgData.taqeem_registration || ""} onChange={e => update("taqeem_registration", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input value={orgData.phone || ""} onChange={e => update("phone", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={orgData.email || ""} onChange={e => update("email", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الموقع الإلكتروني</Label>
              <Input value={orgData.website || ""} onChange={e => update("website", e.target.value)} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">العنوان</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>العنوان (عربي)</Label>
              <Textarea value={orgData.address_ar || ""} onChange={e => update("address_ar", e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Address (English)</Label>
              <Textarea value={orgData.address_en || ""} onChange={e => update("address_en", e.target.value)} rows={2} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button onClick={handleSave} className="gap-2" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ البيانات
        </Button>
      </div>
    </div>
  );
}
