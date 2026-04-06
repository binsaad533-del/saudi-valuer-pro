import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import { PasswordStrengthMessage } from "@/components/ui/password-strength-message";
import { hasRecoveryParams, readRecoveryParamsFromLocation, RECOVERY_CALLBACK_PATH } from "@/lib/auth-recovery";

type RecoveryStatus = "checking" | "ready" | "invalid";

const SESSION_POLL_INTERVAL = 500;
const SESSION_POLL_MAX_ATTEMPTS = 12;

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const recoveryParams = useMemo(() => readRecoveryParamsFromLocation(), []);
  const recoverySignalsDetected = useMemo(() => hasRecoveryParams(recoveryParams), [recoveryParams]);

  useEffect(() => {
    if (!recoverySignalsDetected) return;
    console.info("[ResetPassword] Recovery parameters detected on reset route, redirecting to callback", {
      href: window.location.href,
      target: `${RECOVERY_CALLBACK_PATH}${window.location.search}${window.location.hash}`,
    });
    navigate(`${RECOVERY_CALLBACK_PATH}${window.location.search}${window.location.hash}`, { replace: true });
  }, [navigate, recoverySignalsDetected]);

  useEffect(() => {
    let isActive = true;
    let resolved = false;

    const markReady = (source: string) => {
      if (!isActive || resolved) return;
      resolved = true;
      console.info("[ResetPassword] Recovery session ready", {
        source,
        href: window.location.href,
        state: location.state,
      });
      setStatus("ready");
    };

    const markInvalid = (reason: string, error?: unknown) => {
      if (!isActive || resolved) return;
      resolved = true;
      console.error("[ResetPassword] Recovery session missing", {
        reason,
        error,
        href: window.location.href,
        state: location.state,
      });
      setStatus("invalid");
    };

    const checkSession = async (label: string) => {
      const { data, error } = await supabase.auth.getSession();

      console.info(`[ResetPassword] Session check (${label})`, {
        hasSession: Boolean(data.session),
        hasUser: Boolean(data.session?.user),
        userId: data.session?.user?.id ?? null,
        error: error?.message ?? null,
        href: window.location.href,
        state: location.state,
      });

      if (error) {
        console.error(`[ResetPassword] getSession error (${label})`, error);
      }

      if (data.session?.user) {
        markReady(label);
        return true;
      }

      return false;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.info("[ResetPassword] onAuthStateChange", {
        event,
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });

      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        markReady(`auth-event:${event}`);
      }
    });

    const run = async () => {
      try {
        if (await checkSession("initial")) return;

        for (let attempt = 1; attempt <= SESSION_POLL_MAX_ATTEMPTS; attempt++) {
          if (!isActive || resolved) return;

          await new Promise((resolve) => setTimeout(resolve, SESSION_POLL_INTERVAL));

          if (await checkSession(`poll-${attempt}`)) {
            return;
          }
        }

        markInvalid("session-not-found-after-polling");
      } catch (error) {
        console.error("[ResetPassword] Failed to resolve recovery session", error);
        markInvalid("exception", error);
      }
    };

    void run();

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [location.state]);

  useEffect(() => {
    if (!done) return;

    const redirectTimer = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 1500);

    return () => window.clearTimeout(redirectTimer);
  }, [done, navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "كلمات المرور غير متطابقة", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setDone(true);
    } catch (err: any) {
      console.error("[ResetPassword] Password update failed", err);
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">تم تغيير كلمة المرور</h2>
            <p className="text-muted-foreground text-sm mb-6">تم تحديث كلمة المرور بنجاح، وسيتم تحويلك الآن.</p>
            <Button onClick={() => navigate("/login")} className="w-full">
              تسجيل الدخول
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">جاري التحقق من الرابط...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-3">تعذر التحقق من رابط الاستعادة</h1>
            <p className="text-muted-foreground text-sm leading-7 mb-6">
              الرابط غير صالح أو منتهي الصلاحية، يرجى طلب رابط جديد
            </p>
            <div className="space-y-3">
              <Button className="w-full" onClick={() => navigate("/client/forgot-password", { replace: true })}>
                طلب رابط جديد
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate("/login", { replace: true })}>
                العودة لتسجيل الدخول
              </Button>
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
          <h1 className="text-2xl font-bold text-foreground">إعادة تعيين كلمة المرور</h1>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="new-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" required dir="ltr" minLength={6} />
              </div>
              <PasswordStrengthMessage password={password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">تأكيد كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="confirm-new-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pr-10" required dir="ltr" minLength={6} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              تغيير كلمة المرور
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
