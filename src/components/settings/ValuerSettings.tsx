import { useState } from "react";
import { UserCircle, Upload, Save, PenTool } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ValuerSettings() {
  const [form, setForm] = useState({
    nameAr: "أحمد المالكي",
    nameEn: "Ahmed Al-Malki",
    taqeemRealEstate: "1200XXXX",
    taqeemMachinery: "1300XXXX",
    specialization: "real_estate",
    phone: "+966 5X XXX XXXX",
    email: "ahmed@jsaas.com",
  });

  const handleSave = () => {
    toast.success("تم حفظ بيانات المقيّم بنجاح");
  };

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
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-border bg-muted flex items-center justify-center">
                <UserCircle className="w-10 h-10 text-muted-foreground" />
              </div>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 ml-2" />
                رفع الصورة
              </Button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-40 h-24 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center">
                <PenTool className="w-8 h-8 text-muted-foreground" />
              </div>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 ml-2" />
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
              <Input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Full Name (English)</Label>
              <Input value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>عضوية تقييم - عقارات</Label>
              <Input value={form.taqeemRealEstate} onChange={e => setForm({ ...form, taqeemRealEstate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>عضوية تقييم - آلات ومعدات</Label>
              <Input value={form.taqeemMachinery} onChange={e => setForm({ ...form, taqeemMachinery: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>التخصص الرئيسي</Label>
              <Select value={form.specialization} onValueChange={v => setForm({ ...form, specialization: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real_estate">تقييم عقاري</SelectItem>
                  <SelectItem value="machinery">آلات ومعدات</SelectItem>
                  <SelectItem value="both">كلاهما</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" />
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
