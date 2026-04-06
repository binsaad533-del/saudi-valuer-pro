import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { extractEdgeFunctionErrorMessage } from "@/lib/edge-function-errors";
import { Phone, KeyRound, Loader2, CheckCircle, ArrowRight, AlertTriangle } from "lucide-react";
import logo from "@/assets/logo.png";
import AppFooter from "@/components/layout/AppFooter";
import { useOtpCountries, OtpCountry } from "@/hooks/useOtpCountries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Step = "phone" | "otp" | "redirecting";
const RESEND_COOLDOWN = 60;

export default function ClientAuth() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading, getRedirectPath } = useAuth();
  const { toast } = useToast();
  const { countries, loading: countriesLoading } = useOtpCountries();

  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState("SA");
  const [phone, setPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const selectedCountry: OtpCountry | undefined = useMemo(
    () => countries.find((c) => c.country_code === selectedCountryCode),
    [countries, selectedCountryCode]
  );

  const otpAvailable = selectedCountry?.otp_enabled ?? false;

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && role) {
      navigate(getRedirectPath(role), { replace: true });
    }
  }, [authLoading, user, role, navigate, getRedirectPath]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const fullPhone = useMemo(() => {
    const raw = phone.trim().replace(/^0+/, "");
    return `${selectedCountry?.dial_code ?? "+966"}${raw}`;
  }, [phone, selectedCountry]);

  const handleSendOtp = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!otpAvailable) return;
      if (!phone || phone.trim().length < 5) {
        toast({ title: "أدخل رقم جوال صحيح", variant: "destructive" });
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("phone-otp", {
          body: { action: "send", phone: fullPhone },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setVerificationToken(data?.verification_token || "");
        setStep("otp");
        setResendTimer(RESEND_COOLDOWN);
        setFailedAttempts(0);
        toast({ title: "تم إرسال رمز التحقق" });
      } catch (err: unknown) {
        const message = await extractEdgeFunctionErrorMessage(err, "تعذر إرسال رمز التحقق حالياً");
        toast({ title: "تعذر إرسال الرمز", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [phone, fullPhone, otpAvailable, toast]
  );

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (failedAttempts >= 5) {
      toast({ title: "تم تجاوز عدد المحاولات", description: "أعد طلب رمز جديد", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-otp", {
        body: {
          action: "verify",
          phone: fullPhone,
          code: otpCode,
          verification_token: verificationToken,
          client_name: clientName.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.valid && data?.token_hash) {
        setStep("redirecting");
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: "magiclink",
        });
        if (verifyError) throw verifyError;

        const welcomeMsg = data.is_new_account ? "تم إنشاء حسابك بنجاح" : "تم تسجيل الدخول";
        toast({ title: welcomeMsg });
        navigate("/client/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      setFailedAttempts((v) => v + 1);
      const message = await extractEdgeFunctionErrorMessage(err, "رمز التحقق غير صحيح");
      toast({ title: "تعذر التحقق", description: message, variant: "destructive" });
      if (step === "redirecting") setStep("otp");
    } finally {
      setLoading(false);
    }
  };

  if (step === "redirecting") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-foreground font-medium">جاري تسجيل الدخول...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="جساس" className="w-28 h-auto mx-auto mb-4 object-contain" />
          <h1 className="text-xl font-extralight text-foreground">جساس للتقييم .. نصنع للأصل قيمة</h1>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          {step === "phone" && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-lg font-semibold text-foreground">الدخول أو التسجيل</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  سيتم إنشاء حسابك تلقائيًا أو تسجيل دخولك إذا كنت مسجلاً مسبقًا
                </p>
              </div>

              {/* Country selector */}
              <div className="space-y-2">
                <Label>الدولة</Label>
                <Select
                  value={selectedCountryCode}
                  onValueChange={setSelectedCountryCode}
                  disabled={countriesLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الدولة" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.country_code} value={c.country_code}>
                        <span className="flex items-center gap-2">
                          <span dir="ltr" className="text-muted-foreground text-xs">{c.dial_code}</span>
                          <span>{c.country_name_ar}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Phone input */}
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الجوال</Label>
                <div className="relative flex items-center gap-2">
                  <span className="shrink-0 text-sm text-muted-foreground font-medium min-w-[3.5rem] text-center" dir="ltr">
                    {selectedCountry?.dial_code ?? "+966"}
                  </span>
                  <div className="relative flex-1">
                    <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
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
              </div>

              {/* OTP unavailable warning */}
              {!otpAvailable && !countriesLoading && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">
                    رمز التحقق غير متاح حاليًا لهذه الدولة
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="client-name">الاسم <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                <Input
                  id="client-name"
                  placeholder="اسمك الكامل"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !otpAvailable}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                إرسال رمز التحقق
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center mb-2">
                <CheckCircle className="w-10 h-10 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  تم إرسال رمز التحقق إلى{" "}
                  <span className="font-medium text-foreground" dir="ltr">{fullPhone}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp-code">رمز التحقق</Label>
                <div className="relative">
                  <KeyRound className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="pr-10 text-center tracking-[0.3em] text-lg"
                    required
                    dir="ltr"
                    autoFocus
                    maxLength={6}
                  />
                </div>
                {failedAttempts > 0 && failedAttempts < 5 && (
                  <p className="text-xs text-destructive">محاولات خاطئة: {failedAttempts}/5</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading || failedAttempts >= 5}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                تأكيد
              </Button>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  disabled={resendTimer > 0 || loading}
                  onClick={() => handleSendOtp()}
                >
                  {resendTimer > 0 ? `إعادة الإرسال (${resendTimer})` : "إعادة إرسال الرمز"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => { setStep("phone"); setOtpCode(""); setFailedAttempts(0); }}
                >
                  <ArrowRight className="w-3 h-3 ml-1" />
                  تغيير الرقم
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} جساس للتقييم - جميع الحقوق محفوظة
        </p>
      </div>
      <AppFooter />
    </div>
  );
}
