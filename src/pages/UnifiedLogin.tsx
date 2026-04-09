import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { extractEdgeFunctionErrorMessage } from "@/lib/edge-function-errors";
import { Mail, Lock, Phone, KeyRound, Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";

type LoginMode = "choice" | "email" | "phone" | "phone-otp";

export default function UnifiedLogin() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading, getRedirectPath } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user && role) {
      navigate(getRedirectPath(role), { replace: true });
    }
  }, [authLoading, user, role, navigate, getRedirectPath]);

  const [mode, setMode] = useState<LoginMode>("choice");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
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

  const logLoginAttempt = async (identifier: string, userId: string | null, success: boolean, reason?: string) => {
    try {
      await supabase.functions.invoke("security-monitor", {
        body: {
          action: "log_login",
          payload: {
            email: identifier,
            user_id: userId,
            user_agent: navigator.userAgent,
            success,
            failure_reason: reason || null,
          },
        },
      });
    } catch { /* non-blocking */ }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await logLoginAttempt(email, authData.user.id, true);
      const path = await resolveRedirect(authData.user.id);
      if (path) navigate(path, { replace: true });
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message.toLowerCase() : "";
      const isEmailNotConfirmed = err?.code === "email_not_confirmed" || message.includes("email not confirmed");
      await logLoginAttempt(email, null, false, isEmailNotConfirmed ? "email_not_confirmed" : "invalid_credentials");
      toast({
        title: isEmailNotConfirmed ? "البريد الإلكتروني غير مؤكد" : "خطأ في تسجيل الدخول",
        description: isEmailNotConfirmed
          ? "يلزم تأكيد البريد الإلكتروني أولاً من الرسالة المرسلة إلى بريدك."
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
      setPhoneVerificationToken(data?.verification_token || "");
      setMode("phone-otp");
      toast({ title: "تم إرسال رمز التحقق" });
    } catch (err: unknown) {
      const message = await extractEdgeFunctionErrorMessage(err, "تعذر إرسال رمز التحقق");
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
        body: { action: "verify", phone, code: phoneOtpCode, verification_token: phoneVerificationToken },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.valid && data?.token_hash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: "magiclink",
        });
        if (verifyError) throw verifyError;
      } else if (data?.valid && data?.email) {
        toast({ title: "تم التحقق", description: "يرجى تسجيل الدخول بالبريد الإلكتروني" });
      }
    } catch (err: unknown) {
      const message = await extractEdgeFunctionErrorMessage(err, "تعذر التحقق من الرمز");
      toast({ title: "تعذر التحقق", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setMode("choice");
    setPhoneOtpCode("");
    setPhoneVerificationToken("");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Header — animated logo only */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <RaqeemAnimatedLogo size={80} />
          </div>
          <h1 className="text-xl font-light text-foreground tracking-wide">
            جساس للتقييم
          </h1>
          <p className="text-xs text-muted-foreground mt-1">نصنع للأصل قيمة</p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
          {/* Choice Screen */}
          {mode === "choice" && (
            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground mb-4">اختر طريقة الدخول</p>
              <Button
                variant="outline"
                className="w-full h-12 justify-start gap-3 text-sm font-medium"
                onClick={() => setMode("email")}
              >
                <Mail className="w-4 h-4 text-primary shrink-0" />
                الدخول بالبريد الإلكتروني
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 justify-start gap-3 text-sm font-medium"
                onClick={() => setMode("phone")}
              >
                <Phone className="w-4 h-4 text-primary shrink-0" />
                الدخول برقم الجوال
              </Button>
            </div>
          )}

          {/* Email Login */}
          {mode === "email" && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
                رجوع
              </button>

              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pr-10"
                    required
                    dir="ltr"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Link to="/client/forgot-password" className="text-[11px] text-primary/80 hover:text-primary hover:underline">
                    نسيت كلمة المرور؟
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10"
                    required
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                تسجيل الدخول
              </Button>
            </form>
          )}

          {/* Phone Login */}
          {mode === "phone" && (
            <form onSubmit={handleSendPhoneOtp} className="space-y-4">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
                رجوع
              </button>

              <div className="space-y-2">
                <Label htmlFor="phone-login">رقم الجوال</Label>
                <div className="relative flex items-center gap-2">
                  <span className="shrink-0 text-sm text-muted-foreground font-medium min-w-[3rem] text-center" dir="ltr">
                    +966
                  </span>
                  <div className="relative flex-1">
                    <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone-login"
                      type="tel"
                      placeholder="5XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pr-10"
                      required
                      dir="ltr"
                      autoFocus
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">سيتم إرسال رمز تحقق إلى جوالك</p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                إرسال رمز التحقق
              </Button>
            </form>
          )}

          {/* Phone OTP Verification */}
          {mode === "phone-otp" && (
            <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
              <button
                type="button"
                onClick={() => setMode("phone")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
                تغيير الرقم
              </button>

              <p className="text-sm text-muted-foreground text-center">
                أدخل الرمز المرسل إلى <span className="font-medium text-foreground" dir="ltr">{phone}</span>
              </p>

              <div className="space-y-2">
                <Label htmlFor="phone-otp-code">رمز التحقق</Label>
                <div className="relative">
                  <KeyRound className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone-otp-code"
                    type="text"
                    placeholder="------"
                    value={phoneOtpCode}
                    onChange={(e) => setPhoneOtpCode(e.target.value)}
                    className="pr-10 text-center tracking-[0.4em] font-mono"
                    required
                    dir="ltr"
                    autoFocus
                    maxLength={6}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                تحقق وسجّل الدخول
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/60 mt-8">
          © {new Date().getFullYear()} جساس للتقييم — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}