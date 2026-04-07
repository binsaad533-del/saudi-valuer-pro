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
import { PasswordStrengthMessage } from "@/components/ui/password-strength-message";

interface Props {
  onCreated: () => void;
}

const CITIES = [
  "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام",
  "الخبر", "الظهران", "الطائف", "تبوك", "بريدة", "حائل", "أبها", "جازان", "نجران",
];

const SPECIALIZATIONS = [
  "عقارات", "آلات ومعدات", "عقارات وآلات ومعدات",
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
      const { data, error } = await supabase.functions.invoke("create-staff-account", {
        body: {
          email,
          password,
          full_name_ar: fullName,
          phone: phone || null,
          role: "inspector",
          city: city || null,
          specialization: specialization || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

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
            <PasswordStrengthMessage password={password} />
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
