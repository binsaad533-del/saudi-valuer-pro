import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";

interface Props {
  onCreated: () => void;
}

const CITIES = [
  "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام",
  "الخبر", "الظهران", "الطائف", "تبوك", "بريدة", "حائل", "أبها", "جازان", "نجران",
];

const SPECIALIZATIONS = [
  "سكني", "تجاري", "صناعي", "أراضي", "زراعي", "آلات ومعدات",
];

export default function AddInspectorDialog({ onCreated }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("123456");
  const [city, setCity] = useState("");
  const [specialization, setSpecialization] = useState("");

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("123456");
    setCity("");
    setSpecialization("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      toast({ title: "خطأ", description: "يرجى تعبئة الحقول المطلوبة", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name_ar: fullName },
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("فشل إنشاء المستخدم");

      const userId = authData.user.id;

      // 2. Create profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: userId,
        full_name_ar: fullName,
        email,
        phone: phone || null,
        user_type: "inspector",
        account_status: "active",
        is_active: true,
      }, { onConflict: "user_id" });
      if (profileError) console.error("Profile error:", profileError);

      // 3. Assign inspector role
      const { error: roleError } = await supabase.from("user_roles").upsert({
        user_id: userId,
        role: "inspector" as any,
      }, { onConflict: "user_id,role" });
      if (roleError) console.error("Role error:", roleError);

      // 4. Create inspector profile
      const { error: inspError } = await supabase.from("inspector_profiles").insert({
        user_id: userId,
        is_active: true,
        availability_status: "available",
        cities_ar: city ? [city] : [],
        specializations: specialization ? [specialization] : [],
      });
      if (inspError) console.error("Inspector profile error:", inspError);

      toast({ title: "تم بنجاح", description: `تم إنشاء حساب المعاين ${fullName}` });
      resetForm();
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          إضافة معاين
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة معاين جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>الاسم الكامل *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="أدخل اسم المعاين" required />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="inspector@example.com" required dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>رقم الجوال</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>كلمة المرور *</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور الأولية" required dir="ltr" />
            <p className="text-xs text-muted-foreground">سيُطلب من المعاين تغييرها عند أول دخول</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>المدينة</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                <SelectContent>
                  {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التخصص</Label>
              <Select value={specialization} onValueChange={setSpecialization}>
                <SelectTrigger><SelectValue placeholder="اختر التخصص" /></SelectTrigger>
                <SelectContent>
                  {SPECIALIZATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              إنشاء الحساب
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
