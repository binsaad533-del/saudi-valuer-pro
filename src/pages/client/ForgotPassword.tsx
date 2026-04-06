import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, CheckCircle, RefreshCw } from "lucide-react";
import logo from "@/assets/logo.png";
import { buildRecoveryRedirectUrl } from "@/lib/auth-recovery";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendResetEmail = async () => {
    setLoading(true);
    try {
      const redirectTo = buildRecoveryRedirectUrl();
      console.info("[ForgotPassword] Sending recovery email", {
        email,
        redirectTo,
        currentOrigin: window.location.origin,
      });

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;

      console.info("[ForgotPassword] Recovery email request accepted", {
        email,
        redirectTo,
      });

      setSent(true);
      startCooldown();
      toast({ title: "تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني" });
    } catch (err: any) {
      console.error("[ForgotPassword] Recovery email request failed", err);
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResetEmail();
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await sendResetEmail();
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني</h2>
            <p className="text-muted-foreground text-sm mb-6">
              يرجى التحقق من بريدك الإلكتروني <span className="font-medium text-foreground" dir="ltr">{email}</span> واتبع الرابط لإعادة تعيين كلمة المرور.
            </p>
            <p className="text-xs text-muted-foreground mb-4">تحقق من مجلد البريد غير المرغوب فيه إذا لم تجد الرسالة</p>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {resendCooldown > 0
                  ? `إعادة الإرسال بعد ${resendCooldown} ثانية`
                  : "إعادة إرسال الرابط"}
              </Button>
              <Link to="/login">
                <Button variant="ghost" className="w-full">العودة لتسجيل الدخول</Button>
              </Link>
            </div>
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
          <h1 className="text-2xl font-bold text-foreground">استرجاع كلمة المرور</h1>
          <p className="text-muted-foreground text-sm mt-1">أدخل بريدك الإلكتروني لإرسال رابط الاسترجاع</p>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="forgot-email" type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pr-10" required dir="ltr" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              إرسال رابط الاسترجاع
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-primary hover:underline">العودة لتسجيل الدخول</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
