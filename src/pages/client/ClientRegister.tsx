import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { extractEdgeFunctionErrorMessage } from "@/lib/edge-function-errors";
import { User, Mail, Phone, Lock, Loader2, CheckCircle, KeyRound, Eye, EyeOff, Building2, CreditCard, UserCheck } from "lucide-react";
import logo from "@/assets/logo.png";

type ClientType = "individual" | "company";

export default function ClientRegister() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "verify-phone" | "done">("form");
  const [showPassword, setShowPassword] = useState(false);
  const [clientType, setClientType] = useState<ClientType>("individual");

  // Common
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerificationToken, setPhoneVerificationToken] = useState("");

  // Individual
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");

  // Company
  const [companyName, setCompanyName] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  const formatPhone = (p: string) => p.startsWith("+") ? p : `+966${p.replace(/^0/, "")}`;

  const getDisplayName = () => clientType === "individual" ? fullName : contactPerson;

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
          data: {
            full_name: getDisplayName(),
            phone: formatPhone(phone),
            role: "client",
            client_type: clientType,
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from("profiles").insert({
          user_id: data.user.id,
          full_name_ar: getDisplayName(),
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
        setPhoneVerificationToken(otpData?.verification_token || "");
        setStep("verify-phone");
        toast({ title: "تم إرسال رمز التحقق إلى جوالك" });
      } catch (otpError: unknown) {
        const message = await extractEdgeFunctionErrorMessage(otpError, "تعذر إرسال رمز التحقق إلى الجوال حالياً");
        toast({ title: "تم إنشاء الحساب", description: `${message} يمكنك حالياً إكمال الدخول عبر البريد الإلكتروني بعد تأكيده.`, variant: "destructive" });
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
        body: { action: "verify", phone, code: phoneOtp, verification_token: phoneVerificationToken },
      });
      if (error) throw error;
      if (!data?.valid) throw new Error(data?.error || "رمز غير صحيح");
      toast({ title: "تم التحقق من رقم الجوال بنجاح" });
      setStep("done");
    } catch (err: unknown) {
      const message = await extractEdgeFunctionErrorMessage(err, "تعذر التحقق من رقم الجوال حالياً");
      toast({ title: "تعذر التحقق", description: message, variant: "destructive" });
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
      setPhoneVerificationToken(data?.verification_token || "");
      toast({ title: "تم إعادة إرسال رمز التحقق" });
    } catch (err: unknown) {
      const message = await extractEdgeFunctionErrorMessage(err, "تعذر إعادة إرسال رمز التحقق حالياً");
      toast({ title: "تعذر إعادة الإرسال", description: message, variant: "destructive" });
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
            <Button onClick={() => navigate("/login")} className="w-full">الذهاب لتسجيل الدخول</Button>
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
          {/* Client Type Toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden mb-6">
            <button
              type="button"
              onClick={() => setClientType("individual")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                clientType === "individual"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <User className="h-4 w-4" />
              فرد
            </button>
            <button
              type="button"
              onClick={() => setClientType("company")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                clientType === "company"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Building2 className="h-4 w-4" />
              شركة
            </button>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {clientType === "individual" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">الاسم الكامل</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="fullName" placeholder="محمد أحمد" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pr-10" required />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="companyName">اسم الشركة</Label>
                  <div className="relative">
                    <Building2 className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="companyName" placeholder="شركة المثال للتطوير" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="pr-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">اسم المفوض</Label>
                  <div className="relative">
                    <UserCheck className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="contactPerson" placeholder="محمد أحمد" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="pr-10" required />
                  </div>
                </div>
              </>
            )}

            {/* Common fields */}
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
            <Link to="/login" className="text-primary font-medium hover:underline">تسجيل الدخول</Link>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">© {new Date().getFullYear()} جساس للتقييم - جميع الحقوق محفوظة</p>
      </div>
    </div>
  );
}
