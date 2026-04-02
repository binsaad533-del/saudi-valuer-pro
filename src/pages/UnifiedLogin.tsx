import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { extractEdgeFunctionErrorMessage } from "@/lib/edge-function-errors";
import { Mail, Lock, Phone, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";

export default function UnifiedLogin() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading, getRedirectPath } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user && role) {
      navigate(getRedirectPath(role), { replace: true });
    }
  }, [authLoading, user, role, navigate, getRedirectPath]);

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneVerificationToken, setPhoneVerificationToken] = useState("");

  const resolveRedirect = async (userId: string): Promise<string | null> => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.account_status === "suspended") {
      await supabase.auth.signOut();
      toast({ title: "الحساب موقوف", description: "تم إيقاف حسابك. تواصل مع الإدارة.", variant: "destructive" });
      return null;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const r = roleData?.role;
    if (r === "owner" || r === "admin_coordinator" || r === "financial_manager") return "/";
    if (r === "inspector") return "/inspector";
    return "/client/dashboard";
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const path = await resolveRedirect(authData.user.id);
      if (path) navigate(path, { replace: true });
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message.toLowerCase() : "";
      const isEmailNotConfirmed = err?.code === "email_not_confirmed" || message.includes("email not confirmed");

      toast({
        title: isEmailNotConfirmed ? "البريد الإلكتروني غير مؤكد" : "خطأ في تسجيل الدخول",
        description: isEmailNotConfirmed
          ? "تم إنشاء الحساب بنجاح، لكن يلزم تأكيد البريد الإلكتروني أولاً من الرسالة المرسلة إلى بريدك ثم إعادة المحاولة."
          : err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-otp", {
        body: { action: "send", phone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPhoneOtpSent(true);
      toast({ title: "تم إرسال رمز التحقق", description: "يرجى التحقق من رسائل الجوال" });
    } catch (err: unknown) {
      const message = await extractEdgeFunctionErrorMessage(err, "تعذر إرسال رمز التحقق إلى الجوال حالياً");
      toast({ title: "تعذر إرسال الرمز", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-otp", {
        body: { action: "verify", phone, code: phoneOtpCode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.valid && data?.token_hash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: "magiclink",
        });
        if (verifyError) throw verifyError;
        // After OTP verify, auth state change will trigger redirect via useEffect
      } else if (data?.valid && data?.email) {
        toast({ title: "تم التحقق", description: "يرجى تسجيل الدخول بالبريد الإلكتروني" });
      }
    } catch (err: unknown) {
      const message = await extractEdgeFunctionErrorMessage(err, "تعذر التحقق من رمز الجوال حالياً");
      toast({ title: "تعذر التحقق", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="جساس" className="w-28 h-auto mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-extralight text-foreground">جساس للتقييم .. نصنع للأصل قيمة</h1>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <Tabs defaultValue="password" dir="rtl">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="password" className="text-sm">البريد الإلكتروني</TabsTrigger>
              <TabsTrigger value="phone" className="text-sm">رقم الجوال</TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pr-10" required dir="ltr" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Link to="/client/forgot-password" className="text-xs text-primary hover:underline">نسيت كلمة المرور؟</Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="أدخل كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10 pl-10" required dir="ltr" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-3 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  تسجيل الدخول
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="phone">
              {!phoneOtpSent ? (
                <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone-login">رقم الجوال</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="phone-login" type="tel" placeholder="05XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="pr-10" required dir="ltr" />
                    </div>
                    <p className="text-xs text-muted-foreground">سيتم إرسال رمز تحقق إلى جوالك</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    إرسال رمز التحقق
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    تم إرسال رمز التحقق إلى <span className="font-medium text-foreground" dir="ltr">{phone}</span>
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="phone-otp-code">رمز التحقق</Label>
                    <div className="relative">
                      <KeyRound className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="phone-otp-code" type="text" placeholder="123456" value={phoneOtpCode} onChange={(e) => setPhoneOtpCode(e.target.value)} className="pr-10 text-center tracking-widest" required dir="ltr" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    تحقق وسجّل الدخول
                  </Button>
                  <Button type="button" variant="ghost" className="w-full text-sm" onClick={() => setPhoneOtpSent(false)}>تغيير الرقم</Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{" "}
            <Link to="/client/register" className="text-primary font-medium hover:underline">إنشاء حساب جديد</Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} جساس للتقييم - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
