import { useState } from "react";
import { Building2, Upload, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function CompanySettings() {
  const [form, setForm] = useState({
    nameAr: "جساس للتقييم",
    nameEn: "Jsaas Valuation",
    crNumber: "1010XXXXXX",
    taqeemLicense: "1200XXXX",
    phone: "+966 11 XXX XXXX",
    email: "info@jsaas.com",
    website: "https://jsaas.com",
    addressAr: "الرياض، المملكة العربية السعودية",
    addressEn: "Riyadh, Saudi Arabia",
  });

  const handleSave = () => {
    toast.success("تم حفظ بيانات الشركة بنجاح");
  };

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
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 ml-2" />
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
              <Input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Company Name (English)</Label>
              <Input value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>رقم السجل التجاري</Label>
              <Input value={form.crNumber} onChange={e => setForm({ ...form, crNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>رقم ترخيص تقييم</Label>
              <Input value={form.taqeemLicense} onChange={e => setForm({ ...form, taqeemLicense: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الموقع الإلكتروني</Label>
              <Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} dir="ltr" />
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
              <Textarea value={form.addressAr} onChange={e => setForm({ ...form, addressAr: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Address (English)</Label>
              <Textarea value={form.addressEn} onChange={e => setForm({ ...form, addressEn: e.target.value })} rows={2} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" />
          حفظ البيانات
        </Button>
      </div>
    </div>
  );
}
