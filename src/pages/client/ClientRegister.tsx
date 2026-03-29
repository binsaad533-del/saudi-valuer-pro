import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Lock, Loader2, CheckCircle, KeyRound, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";

export default function ClientRegister() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "verify-phone" | "done">("form");
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");

  const formatPhone = (p: string) => p.startsWith("+") ? p : `+966${p.replace(/^0/, "")}`;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/client",
          data: { full_name: fullName, phone: formatPhone(phone), role: "client" },
        },
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from("profiles").insert({
          user_id: data.user.id,
          full_name_ar: fullName,
          email,
          phone: formatPhone(phone),
          preferred_language: "ar",
          account_status: "active",
          user_type: "external",
        });
        await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "client" as any,
        });
      }

      // Send phone OTP via Twilio
      try {
        const { data: otpData, error: otpError } = await supabase.functions.invoke("phone-otp", {
          body: { action: "send", phone },
        });
        if (otpError) throw otpError;
        if (otpData?.error) throw new Error(otpData.error);
        setStep("verify-phone");
        toast({ title: "تم إرسال رمز التحقق إلى جوالك" });
      } catch {
        setStep("done");
      }
    } catch (err: any) {
      toast({ title: "خطأ في التسجيل", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-otp", {
        body: { action: "verify", phone, code: phoneOtp },
      });
      if (error) throw error;
      if (!data?.valid) throw new Error(data?.error || "رمز غير صحيح");
      toast({ title: "تم التحقق من رقم الجوال بنجاح" });
      setStep("done");
    } catch (err: any) {
      toast({ title: "رمز غير صحيح", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-otp", {
        body: { action: "send", phone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "تم إعادة إرسال رمز التحقق" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">تم إنشاء حسابك بنجاح</h2>
            <p className="text-muted-foreground text-sm mb-6">يرجى التحقق من بريدك الإلكتروني لتأكيد حسابك، ثم يمكنك تسجيل الدخول.</p>
            <Button onClick={() => navigate("/client/login")} className="w-full">الذهاب لتسجيل الدخول</Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "verify-phone") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={logo} alt="جساس" className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground">التحقق من رقم الجوال</h1>
            <p className="text-muted-foreground text-sm mt-1">أدخل الرمز المرسل إلى <span className="font-medium text-foreground" dir="ltr">{phone}</span></p>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <form onSubmit={handleVerifyPhone} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone-otp">رمز التحقق</Label>
                <div className="relative">
                  <KeyRound className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="phone-otp" type="text" placeholder="123456" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} className="pr-10 text-center tracking-widest" required dir="ltr" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                تحقق
              </Button>
              <Button type="button" variant="ghost" className="w-full text-sm" onClick={handleResendOtp} disabled={loading}>إعادة إرسال الرمز</Button>
              <Button type="button" variant="link" className="w-full text-xs text-muted-foreground" onClick={() => setStep("done")}>تخطي التحقق</Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="جساس" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-extralight text-foreground">جساس للتقييم .. نصنع للأصل قيمة</h1>
          
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">الاسم الكامل</Label>
              <div className="relative">
                <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="fullName" placeholder="محمد أحمد" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pr-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="phone" type="tel" placeholder="05XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="pr-10" required dir="ltr" />
              </div>
              <p className="text-xs text-muted-foreground">سيتم إرسال رمز تحقق بعد التسجيل</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="reg-email" type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pr-10" required dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="reg-password" type={showPassword ? "text" : "password"} placeholder="أدخل كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10 pl-10" required dir="ltr" minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-3 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              إنشاء الحساب
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            لديك حساب بالفعل؟{" "}
            <Link to="/client/login" className="text-primary font-medium hover:underline">تسجيل الدخول</Link>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">© {new Date().getFullYear()} جساس للتقييم - جميع الحقوق محفوظة</p>
      </div>
    </div>
  );
}
